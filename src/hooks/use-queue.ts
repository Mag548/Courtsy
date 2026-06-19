"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { QueueEntry } from "@/lib/supabase/types";
import { toast } from "sonner";

const ACTIVE_QUEUE_STATUSES = ["waiting", "notified", "playing"] as const;

type ActiveQueueEntry = QueueEntry & {
  queue: { court_id: string; court: { id: string; name: string } | null } | null;
};

async function getUserActiveQueueEntries(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<ActiveQueueEntry[]> {
  const { data, error } = await supabase
    .from("queue_entries")
    .select("*, queue:queues(court_id, court:courts(id, name))")
    .eq("user_id", userId)
    .in("status", [...ACTIVE_QUEUE_STATUSES]);

  if (error) throw error;
  return (data ?? []) as ActiveQueueEntry[];
}

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

        const activeEntries = await getUserActiveQueueEntries(supabase, userId);
        const sameCourtEntry = activeEntries.find(
          (entry) => entry.queue?.court_id === courtId
        );
        if (sameCourtEntry) {
          toast.info("You're already in this queue!");
          return sameCourtEntry;
        }

        const otherCourtEntry = activeEntries.find(
          (entry) => entry.queue?.court_id !== courtId
        );
        if (otherCourtEntry) {
          const courtName =
            otherCourtEntry.queue?.court?.name ?? "another court";
          toast.error(
            `You're already in the queue at ${courtName}. Leave that queue before joining another.`
          );
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
            position: (count ?? 0) + 1,
            status: "waiting",
          })
          .select()
          .single();

        if (error) {
          if (error.code === "23505") {
            toast.error(
              "You're already in a queue at another court. Leave it before joining another."
            );
            return null;
          }
          throw error;
        }

        const { data: result, error: rpcError } = await supabase.rpc(
          "process_after_queue_join",
          { p_entry_id: entry.id }
        );
        if (rpcError) throw rpcError;

        const { data: updated } = await supabase
          .from("queue_entries")
          .select("*")
          .eq("id", entry.id)
          .single();

        const payload = result as {
          assigned?: boolean;
          court_number?: number;
          position?: number;
        };

        if (payload?.assigned && payload.court_number) {
          toast.success(
            `You're on Court ${payload.court_number}! No time limit while nobody is waiting in line.`
          );
        } else {
          toast.success(
            `You're #${payload?.position ?? updated?.position ?? "?"} in the queue!`
          );
        }

        return updated ?? entry;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to join queue");
        return null;
      } finally {
        setLoading(false);
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
          .select("queue_id, status, queue:queues(court_id)")
          .eq("id", entryId)
          .single();

        if (entry?.status === "playing") {
          const { data: sess } = await supabase
            .from("court_sessions")
            .select("id")
            .eq("queue_entry_id", entryId)
            .eq("status", "active")
            .maybeSingle();

          if (sess) {
            await supabase
              .from("court_sessions")
              .update({ status: "completed" })
              .eq("id", sess.id);
          }

          await supabase
            .from("queue_entries")
            .update({ status: "left" })
            .eq("id", entryId);

          const courtId = (entry?.queue as { court_id: string } | null)?.court_id;
          if (courtId) {
            await supabase.rpc("promote_waiting_player", { p_court_id: courtId });
          }

          toast.success("You've left the court.");
          return;
        }

        const { error } = await supabase
          .from("queue_entries")
          .update({ status: "left" })
          .eq("id", entryId);

        if (error) throw error;

        if (entry?.queue_id) {
          await supabase.rpc("reorder_queue", { p_queue_id: entry.queue_id });
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
    [supabase]
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
        .in("status", ["waiting", "notified", "playing"])
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return data;
    },
    [supabase]
  );

  /** @deprecated Sessions start automatically on join or when promoted. */
  const startSession = useCallback(
    async (_courtId: string, _entryId: string, _userId: string) => {
      toast.info("Sessions start automatically when you join or when a court opens.");
    },
    []
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

        if (sess?.court_id) {
          await supabase.rpc("promote_waiting_player", {
            p_court_id: sess.court_id,
          });
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
    [supabase]
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
        if (!session.expires_at) {
          toast.info("Your open session has no timer yet.");
          return false;
        }
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
