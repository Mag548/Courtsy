"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { QueueEntry } from "@/lib/supabase/types";
import { toast } from "sonner";

export function useQueue() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const joinQueue = useCallback(
    async (
      courtId: string,
      userId: string,
      sport: "tennis" | "pickleball",
      partySize: number = 1
    ) => {
      setLoading(true);
      try {
        // Get the queue for this court
        const { data: queue, error: queueError } = await supabase
          .from("queues")
          .select("id")
          .eq("court_id", courtId)
          .single();

        if (queueError || !queue) throw new Error("Queue not found");

        // Check if already in queue
        const { data: existing } = await supabase
          .from("queue_entries")
          .select("id")
          .eq("queue_id", queue.id)
          .eq("user_id", userId)
          .eq("status", "waiting")
          .maybeSingle();

        if (existing) {
          toast.info("You're already in this queue!");
          return null;
        }

        // Get next position
        const { count } = await supabase
          .from("queue_entries")
          .select("*", { count: "exact", head: true })
          .eq("queue_id", queue.id)
          .eq("status", "waiting");

        const position = (count ?? 0) + 1;

        const { data: entry, error } = await supabase
          .from("queue_entries")
          .insert({
            queue_id: queue.id,
            user_id: userId,
            party_size: partySize,
            sport,
            position,
            status: "waiting",
          })
          .select()
          .single();

        if (error) throw error;

        toast.success(`You're #${position} in the queue!`);
        return entry;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to join queue");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  // Notify the next waiting entry for a given queue
  const notifyNext = useCallback(
    async (queueId: string) => {
      const { data: next } = await supabase
        .from("queue_entries")
        .select("id")
        .eq("queue_id", queueId)
        .eq("status", "waiting")
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (next) {
        await supabase
          .from("queue_entries")
          .update({ status: "notified", notified_at: new Date().toISOString() })
          .eq("id", next.id);
      }
    },
    [supabase]
  );

  const leaveQueue = useCallback(
    async (entryId: string) => {
      setLoading(true);
      try {
        const { data: entry } = await supabase
          .from("queue_entries")
          .select("queue_id")
          .eq("id", entryId)
          .single();

        const { error } = await supabase
          .from("queue_entries")
          .update({ status: "left" })
          .eq("id", entryId);

        if (error) throw error;

        if (entry?.queue_id) {
          await supabase.rpc("reorder_queue", { p_queue_id: entry.queue_id });
          await notifyNext(entry.queue_id);
        }

        toast.success("You've left the queue.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to leave queue"
        );
      } finally {
        setLoading(false);
      }
    },
    [supabase, notifyNext]
  );

  const getUserQueueEntry = useCallback(
    async (courtId: string, userId: string): Promise<QueueEntry | null> => {
      const { data: queue } = await supabase
        .from("queues")
        .select("id")
        .eq("court_id", courtId)
        .single();

      if (!queue) return null;

      const { data } = await supabase
        .from("queue_entries")
        .select("*")
        .eq("queue_id", queue.id)
        .eq("user_id", userId)
        .in("status", ["waiting", "notified"])
        .maybeSingle();

      return data;
    },
    [supabase]
  );

  const startSession = useCallback(
    async (courtId: string, entryId: string, userId: string) => {
      setLoading(true);
      try {
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        const { error: sessionError } = await supabase
          .from("court_sessions")
          .insert({
            court_id: courtId,
            queue_entry_id: entryId,
            user_id: userId,
            expires_at: expiresAt,
            status: "active",
          });

        if (sessionError) throw sessionError;

        await supabase
          .from("queue_entries")
          .update({
            status: "playing",
            started_playing_at: new Date().toISOString(),
          })
          .eq("id", entryId);

        toast.success("Court session started! You have 30 minutes.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to start session"
        );
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const endSession = useCallback(
    async (sessionId: string) => {
      setLoading(true);
      try {
        // Grab court_id and queue_entry_id before ending
        const { data: sess } = await supabase
          .from("court_sessions")
          .select("court_id, queue_entry_id")
          .eq("id", sessionId)
          .single();

        const { error } = await supabase
          .from("court_sessions")
          .update({ status: "completed" })
          .eq("id", sessionId);

        if (error) throw error;

        // Mark the queue entry as expired
        if (sess?.queue_entry_id) {
          await supabase
            .from("queue_entries")
            .update({ status: "expired" })
            .eq("id", sess.queue_entry_id);
        }

        // Notify next player
        if (sess?.court_id) {
          const { data: queue } = await supabase
            .from("queues")
            .select("id")
            .eq("court_id", sess.court_id)
            .single();
          if (queue) await notifyNext(queue.id);
        }

        toast.success("Session ended. Thanks for playing!");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to end session"
        );
      } finally {
        setLoading(false);
      }
    },
    [supabase, notifyNext]
  );

  const extendSession = useCallback(
    async (sessionId: string) => {
      setLoading(true);
      try {
        const { data: session, error: fetchErr } = await supabase
          .from("court_sessions")
          .select("expires_at, extended")
          .eq("id", sessionId)
          .single();

        if (fetchErr || !session) throw new Error("Session not found");
        if (session.extended) {
          toast.info("You can only extend once.");
          return false;
        }

        const newExpiry = new Date(
          new Date(session.expires_at).getTime() + 15 * 60 * 1000
        ).toISOString();

        const { error } = await supabase
          .from("court_sessions")
          .update({ expires_at: newExpiry, extended: true })
          .eq("id", sessionId);

        if (error) throw error;
        toast.success("Session extended by 15 minutes!");
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to extend session"
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const generateInviteCode = useCallback(
    async (entryId: string): Promise<string | null> => {
      try {
        const { data: code, error: fnErr } = await supabase.rpc(
          "generate_invite_code"
        );
        if (fnErr || !code) throw fnErr ?? new Error("No code returned");

        const { error } = await supabase
          .from("queue_entries")
          .update({ invite_code: code })
          .eq("id", entryId);

        if (error) throw error;
        return code;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to generate invite code"
        );
        return null;
      }
    },
    [supabase]
  );

  const joinByInvite = useCallback(
    async (
      inviteCode: string,
      userId: string
    ): Promise<{ success: boolean; courtId?: string }> => {
      setLoading(true);
      try {
        const { data: entry, error: entryErr } = await supabase
          .from("queue_entries")
          .select("id, queue_id, party_size, status, queue:queues(court_id)")
          .eq("invite_code", inviteCode.toUpperCase())
          .maybeSingle();

        if (entryErr || !entry) throw new Error("Invalid invite code");
        if (entry.status !== "waiting" && entry.status !== "playing") {
          throw new Error("This booking is no longer active");
        }

        // Bump party size by 1
        const { error: updateErr } = await supabase
          .from("queue_entries")
          .update({ party_size: entry.party_size + 1 })
          .eq("id", entry.id);

        if (updateErr) throw updateErr;

        const courtId = (entry.queue as { court_id: string } | null)?.court_id;
        toast.success("You've joined the booking!");
        return { success: true, courtId };
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to join by invite"
        );
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  return {
    joinQueue,
    leaveQueue,
    getUserQueueEntry,
    startSession,
    endSession,
    extendSession,
    generateInviteCode,
    joinByInvite,
    loading,
  };
}
