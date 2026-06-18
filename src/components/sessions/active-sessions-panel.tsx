"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useQueue } from "@/hooks/use-queue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Timer,
  Clock,
  Trophy,
  LogOut,
  ChevronRight,
  Loader2,
  Zap,
} from "lucide-react";
import type { Court, CourtSession, QueueEntry } from "@/lib/supabase/types";
import { AuthModal } from "@/components/auth/auth-modal";

interface ActiveEntry {
  entry: QueueEntry;
  session: CourtSession | null;
  court: Court;
}

// Live countdown badge
function Countdown({ expiresAt }: { expiresAt: string }) {
  const [display, setDisplay] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setDisplay("Expired"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(`${m}:${s.toString().padStart(2, "0")}`);
      setUrgent(diff < 5 * 60 * 1000);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <span
      className={`font-mono font-bold tabular-nums text-sm ${
        urgent ? "text-red-400 animate-pulse" : "text-primary"
      }`}
    >
      {display}
    </span>
  );
}

export function ActiveSessionsPanel() {
  const { user } = useAuth();
  const router = useRouter();
  const { endSession, leaveQueue } = useQueue();
  const supabase = createClient();

  const [items, setItems] = useState<ActiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const fetchActive = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    // Sweep expired sessions first so DB state is consistent
    await supabase.rpc("expire_old_sessions");

    // Fetch all of this user's active/waiting entries with court info
    const { data: entries } = await supabase
      .from("queue_entries")
      .select("*, queue:queues(court:courts(*))")
      .eq("user_id", user.id)
      .in("status", ["waiting", "notified", "playing"])
      .order("joined_at", { ascending: false });

    if (!entries) { setLoading(false); return; }

    const results: ActiveEntry[] = [];
    for (const e of entries) {
      const court = (e.queue as { court: Court } | null)?.court;
      if (!court) continue;

      let session: CourtSession | null = null;
      if (e.status === "playing") {
        const { data: s } = await supabase
          .from("court_sessions")
          .select("*")
          .eq("queue_entry_id", e.id)
          .eq("status", "active")
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        session = s ?? null;

        // Entry claims "playing" but session is gone — mark it expired and skip
        if (!session) {
          await supabase
            .from("queue_entries")
            .update({ status: "expired" })
            .eq("id", e.id);
          continue;
        }
      }

      results.push({ entry: e as QueueEntry, session, court });
    }

    setItems(results);
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  // Realtime updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("active-sessions-panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries" },
        () => fetchActive()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "court_sessions" },
        () => fetchActive()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, supabase, fetchActive]);

  const handleEnd = async (item: ActiveEntry) => {
    setActionLoading(item.entry.id);
    if (item.session) {
      await endSession(item.session.id);
    } else {
      // Session already gone — mark expired so it disappears
      await supabase
        .from("queue_entries")
        .update({ status: "expired" })
        .eq("id", item.entry.id);
    }
    setActionLoading(null);
    fetchActive();
  };

  const handleLeave = async (item: ActiveEntry) => {
    setActionLoading(item.entry.id);
    await leaveQueue(item.entry.id);
    setActionLoading(null);
    fetchActive();
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 px-4 text-center">
        <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
          <Timer className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">Sign in to see your sessions</p>
          <p className="text-sm text-muted-foreground mt-1">
            Track your queue position and timer here.
          </p>
        </div>
        <Button
          size="sm"
          className="rounded-2xl h-10 px-5 gradient-primary text-primary-foreground font-semibold"
          onClick={() => setAuthOpen(true)}
        >
          <Zap className="w-4 h-4 mr-2" />
          Sign In
        </Button>
        <AuthModal
          open={authOpen}
          onOpenChange={setAuthOpen}
          onSuccess={() => { setAuthOpen(false); fetchActive(); }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
        <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">No active sessions</p>
          <p className="text-sm text-muted-foreground mt-1">
            Join a queue on a court to see it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 pt-1 space-y-2.5">
      {items.map((item, i) => {
        const isPlaying = item.entry.status === "playing";
        const isNotified = item.entry.status === "notified";
        const busy = actionLoading === item.entry.id;

        return (
          <div
            key={item.entry.id}
            style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
            className={`fade-in-up rounded-2xl border p-4 space-y-3 transition-all ${
              isNotified
                ? "border-green-500/50 bg-green-500/[0.07] shadow-[0_0_24px_-6px_rgba(34,197,94,0.25)]"
                : isPlaying
                ? "border-primary/30 bg-primary/[0.06]"
                : "border-white/[0.07] bg-white/[0.03]"
            }`}
          >
            {/* Court name + status */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{item.court.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {item.court.address ?? item.court.court_type}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`shrink-0 text-xs rounded-lg ${
                  isNotified
                    ? "bg-green-500/20 text-green-400 border-green-500/40"
                    : isPlaying
                    ? "bg-primary/20 text-primary border-primary/30"
                    : "bg-white/[0.06] text-muted-foreground border-white/[0.08]"
                }`}
              >
                {isNotified ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse inline-block" />Spot open!</>
                ) : isPlaying ? (
                  <><Trophy className="w-3 h-3 mr-1" />Playing</>
                ) : (
                  <><Clock className="w-3 h-3 mr-1" />#{item.entry.position} in queue</>
                )}
              </Badge>
            </div>

            {/* Timer (playing) */}
            {isPlaying && item.session && (
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Time left:</span>
                <Countdown expiresAt={item.session.expires_at} />
              </div>
            )}

            {/* Spot open notification */}
            {isNotified && (
              <p className="text-sm text-green-400 font-medium">
                A court is available — head over now!
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs h-9 rounded-xl border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]"
                onClick={() => router.push(`/queue/${item.court.id}`)}
              >
                View
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>

              {isPlaying ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs h-9 rounded-xl"
                  onClick={() => handleEnd(item)}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5" />
                  )}
                  Leave Early
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs h-9 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleLeave(item)}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5" />
                  )}
                  Cancel
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
