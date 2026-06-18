"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CourtWithQueue, Court } from "@/lib/supabase/types";

export function useCourts() {
  const [courts, setCourts] = useState<CourtWithQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchCourts = useCallback(async () => {
    // Sweep expired sessions before fetching so the UI is always consistent
    await supabase.rpc("expire_old_sessions");

    const { data, error } = await supabase
      .from("courts")
      .select(
        `
        *,
        queue:queues(
          *,
          queue_entries(*)
        )
      `
      )
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching courts:", error);
      return;
    }

    const now = new Date().toISOString();

    const courtsWithSessions = await Promise.all(
      (data || []).map(async (court) => {
        const { data: session } = await supabase
          .from("court_sessions")
          .select("*")
          .eq("court_id", court.id)
          .eq("status", "active")
          .gt("expires_at", now)          // never return an expired session
          .maybeSingle();

        const queue = Array.isArray(court.queue) ? court.queue[0] : court.queue;

        return {
          ...court,
          queue: queue
            ? {
                ...queue,
                queue_entries: (queue.queue_entries || []).filter(
                  (e: { status: string }) => e.status === "waiting"
                ),
              }
            : null,
          active_session: session,
        } as CourtWithQueue;
      })
    );

    setCourts(courtsWithSessions);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchCourts();

    const channel = supabase
      .channel("courts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries" },
        () => fetchCourts()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "court_sessions" },
        () => fetchCourts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchCourts]);

  return { courts, loading, refetch: fetchCourts };
}

export function useCourt(courtId: string) {
  const [court, setCourt] = useState<CourtWithQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchCourt = useCallback(async () => {
    const { data, error } = await supabase
      .from("courts")
      .select(
        `
        *,
        queue:queues(
          *,
          queue_entries(*)
        )
      `
      )
      .eq("id", courtId)
      .single();

    if (error || !data) return;

    const { data: session } = await supabase
      .from("court_sessions")
      .select("*")
      .eq("court_id", courtId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    const queue = Array.isArray(data.queue) ? data.queue[0] : data.queue;

    setCourt({
      ...data,
      queue: queue
        ? {
            ...queue,
            queue_entries: (queue.queue_entries || []).filter(
              (e: { status: string }) => e.status === "waiting"
            ),
          }
        : null,
      active_session: session,
    } as CourtWithQueue);
    setLoading(false);
  }, [supabase, courtId]);

  useEffect(() => {
    fetchCourt();

    const channel = supabase
      .channel(`court-${courtId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
        },
        () => fetchCourt()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "court_sessions",
          filter: `court_id=eq.${courtId}`,
        },
        () => fetchCourt()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, courtId, fetchCourt]);

  return { court, loading, refetch: fetchCourt };
}

export function useCourtSearch(courts: Court[]) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "tennis" | "pickleball">("all");

  const filtered = courts.filter((court) => {
    const matchesQuery =
      query === "" ||
      court.name.toLowerCase().includes(query.toLowerCase()) ||
      court.address?.toLowerCase().includes(query.toLowerCase());

    const matchesFilter =
      filter === "all" ||
      court.court_type === filter ||
      court.court_type === "both";

    return matchesQuery && matchesFilter;
  });

  return { filtered, query, setQuery, filter, setFilter };
}
