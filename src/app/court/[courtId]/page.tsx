"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useQueue } from "@/hooks/use-queue";
import { AuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";
import {
  Zap,
  MapPin,
  Users,
  Clock,
  Trophy,
  Timer,
  ChevronRight,
  Loader2,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import type { Court, QueueEntry, CourtSession } from "@/lib/supabase/types";
import { useCourtTraffic } from "@/hooks/use-court-traffic";
import { CourtActivityChart } from "@/components/courts/court-activity-chart";
import {
  estimateWaitMinutes,
  estimateWaitForPosition,
  formatWaitMinutes,
} from "@/lib/court-traffic";

// ── Types ─────────────────────────────────────────────────────────────────────
type PageState = "loading" | "auth" | "queue" | "session" | "join" | "start";

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [display, setDisplay] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setDisplay("00:00"); return; }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setDisplay(`${mins}:${secs.toString().padStart(2, "0")}`);
      setUrgent(diff < 5 * 60 * 1000);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <span className={`font-mono text-7xl font-bold tracking-tighter tabular-nums ${urgent ? "text-red-400 animate-pulse" : "text-primary"}`}>
      {display}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CourtScanPage() {
  const { courtId } = useParams<{ courtId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { joinQueue, startSession, endSession, loading: queueLoading } = useQueue();
  const supabase = createClient();

  const [court, setCourt] = useState<Court | null>(null);
  const [queueLen, setQueueLen] = useState(0);
  const [userEntry, setUserEntry] = useState<QueueEntry | null>(null);
  const [activeSession, setActiveSession] = useState<CourtSession | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [authOpen, setAuthOpen] = useState(false);
  const [partySize, setPartySize] = useState(1);
  const [sport, setSport] = useState<"tennis" | "pickleball">("tennis");
  const actionInFlight = useRef(false);
  const { recentOccupied, hourlyActivity, totalReports } = useCourtTraffic(courtId);

  const estimatedWait = court
    ? estimateWaitMinutes({
        numCourts: court.num_courts,
        queueLength: queueLen,
        hasActiveSession: !!activeSession,
        reportedOccupied: recentOccupied,
      })
    : 0;

  const fetchData = useCallback(async () => {
    const { data: courtData } = await supabase
      .from("courts")
      .select("*")
      .eq("id", courtId)
      .single();
    if (!courtData) { toast.error("Court not found"); return; }
    setCourt(courtData);
    if (courtData.court_type === "pickleball") setSport("pickleball");

    // Expire old sessions
    await supabase.rpc("expire_old_sessions");

    // Active session?
    const { data: session } = await supabase
      .from("court_sessions")
      .select("*")
      .eq("court_id", courtId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    setActiveSession(session);

    // Queue length
    const { data: queue } = await supabase
      .from("queues")
      .select("id")
      .eq("court_id", courtId)
      .single();
    if (queue) {
      const { count } = await supabase
        .from("queue_entries")
        .select("*", { count: "exact", head: true })
        .eq("queue_id", queue.id)
        .eq("status", "waiting");
      setQueueLen(count ?? 0);

      // Current user's entry
      if (user) {
        const { data: entry } = await supabase
          .from("queue_entries")
          .select("*")
          .eq("queue_id", queue.id)
          .eq("user_id", user.id)
          .in("status", ["waiting", "notified", "playing"])
          .order("joined_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setUserEntry(entry);
      }
    }
  }, [supabase, courtId, user]);

  // Compute page state after data loads
  useEffect(() => {
    if (authLoading) { setPageState("loading"); return; }
    if (!user) { setPageState("auth"); return; }
    if (!court) return; // still fetching

    if (userEntry?.status === "playing") {
      setPageState("session");
    } else if (userEntry) {
      setPageState("queue");
    } else if (queueLen > 0) {
      setPageState("join");
    } else {
      setPageState("start");
    }
  }, [authLoading, user, court, userEntry, activeSession, queueLen]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!user || actionInFlight.current) return;
    actionInFlight.current = true;
    const entry = await joinQueue(courtId, user.id, sport, partySize);
    actionInFlight.current = false;
    if (entry) router.push(`/queue/${courtId}`);
  };

  const handleStart = async () => {
    if (!user || actionInFlight.current) return;
    actionInFlight.current = true;
    // Need a queue entry first (position 1 or only player)
    const { data: queue } = await supabase
      .from("queues").select("id").eq("court_id", courtId).single();
    if (!queue) { toast.error("Queue not found"); actionInFlight.current = false; return; }

    const entry = await joinQueue(courtId, user.id, sport, partySize);
    if (entry) {
      await startSession(courtId, entry.id, user.id);
      router.push(`/queue/${courtId}`);
    }
    actionInFlight.current = false;
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pb-12">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/6 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <QrCode className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold gradient-text">CourtQueue</span>
          </div>
          {court ? (
            <>
              <h1 className="text-2xl font-bold">{court.name}</h1>
              {court.address && (
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />{court.address}
                </p>
              )}
            </>
          ) : (
            <div className="h-8 w-48 mx-auto bg-white/[0.06] rounded-xl animate-pulse" />
          )}
        </div>

        {/* Stats strip */}
        {court && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Trophy, label: "Courts", value: court.num_courts },
              { icon: Users,  label: "Waiting", value: queueLen },
              { icon: Clock,  label: "Est. wait", value: formatWaitMinutes(estimatedWait) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-3 text-center">
                <Icon className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
                <p className="text-lg font-bold">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}

        {court && (
          <CourtActivityChart
            hourlyActivity={hourlyActivity}
            totalReports={totalReports}
            recentOccupied={recentOccupied}
            numCourts={court.num_courts}
          />
        )}

        {/* ── Page states ── */}

        {/* LOADING */}
        {pageState === "loading" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading court…</p>
          </div>
        )}

        {/* AUTH */}
        {pageState === "auth" && (
          <div className="space-y-4 text-center">
            <div className="rounded-3xl bg-white/[0.04] border border-white/[0.07] p-6 space-y-3">
              <p className="text-base font-semibold">Sign in to join the court</p>
              <p className="text-sm text-muted-foreground">
                {queueLen > 0
                  ? `${queueLen} player${queueLen !== 1 ? "s" : ""} waiting — sign in to grab your spot`
                  : "Courts are free — sign in to start your session"}
              </p>
              <Button
                className="w-full h-12 rounded-2xl gradient-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20"
                onClick={() => setAuthOpen(true)}
              >
                <Zap className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            </div>
            <AuthModal
              open={authOpen}
              onOpenChange={setAuthOpen}
              onSuccess={() => { setAuthOpen(false); fetchData(); }}
            />
          </div>
        )}

        {/* ALREADY IN QUEUE */}
        {pageState === "queue" && userEntry && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-primary/10 border border-primary/25 p-6 text-center space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Your position</p>
              <p className="text-7xl font-black text-primary">#{userEntry.position}</p>
              {userEntry.position === 1 && (
                <p className="text-sm text-primary/80 flex items-center justify-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> You&apos;re up next!
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Est. wait: {formatWaitMinutes(
                  estimateWaitForPosition(
                    userEntry.position,
                    court?.num_courts ?? 1,
                    !!activeSession,
                    recentOccupied
                  )
                )}
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full h-11 rounded-2xl border-white/[0.08]"
              onClick={() => router.push(`/queue/${courtId}`)}
            >
              View full queue details
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          </div>
        )}

        {/* ACTIVE SESSION */}
        {pageState === "session" && userEntry && activeSession && (
          <div className="space-y-4 text-center">
            <div className="rounded-3xl bg-orange-500/10 border border-orange-500/25 p-6 space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-orange-400 text-sm font-medium mb-3">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                Session in progress
              </div>
              <CountdownTimer expiresAt={activeSession.expires_at} />
              <p className="text-xs text-muted-foreground">Time remaining</p>
            </div>
            <Button
              variant="outline"
              className="w-full h-11 rounded-2xl border-white/[0.08]"
              onClick={() => router.push(`/queue/${courtId}`)}
            >
              Manage session
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          </div>
        )}

        {/* JOIN QUEUE (people already waiting) */}
        {pageState === "join" && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-white/[0.04] border border-white/[0.07] p-5 space-y-4">
              <p className="text-center text-sm font-medium text-muted-foreground">
                {queueLen} player{queueLen !== 1 ? "s" : ""} ahead · {formatWaitMinutes(estimatedWait)} wait
              </p>

              {/* Sport selector */}
              {court?.court_type === "both" && (
                <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                  {(["tennis", "pickleball"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSport(s)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                        sport === s ? "bg-white/[0.08] text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {s === "tennis" ? "🎾 Tennis" : "🏓 Pickleball"}
                    </button>
                  ))}
                </div>
              )}

              {/* Party size */}
              <div className="flex items-center justify-between bg-white/[0.04] rounded-2xl px-4 py-2.5 border border-white/[0.05]">
                <span className="text-sm text-muted-foreground">Party size</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setPartySize(Math.max(1, partySize - 1))} className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-lg font-bold">−</button>
                  <span className="text-base font-bold w-5 text-center">{partySize}</span>
                  <button onClick={() => setPartySize(Math.min(8, partySize + 1))} className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-lg font-bold">+</button>
                </div>
              </div>
            </div>

            <Button
              className="w-full h-14 rounded-2xl gradient-primary font-bold text-primary-foreground text-base shadow-lg shadow-primary/20"
              onClick={handleJoin}
              disabled={queueLoading}
            >
              {queueLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Users className="w-5 h-5 mr-2" />}
              Join Queue
            </Button>
          </div>
        )}

        {/* START SESSION (courts free) */}
        {pageState === "start" && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-primary/8 border border-primary/20 p-5 space-y-4">
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-primary text-sm font-semibold">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Courts are free!
                </div>
                <p className="text-xs text-muted-foreground">Start your 30-minute session now</p>
              </div>

              {/* Sport selector */}
              {court?.court_type === "both" && (
                <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                  {(["tennis", "pickleball"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSport(s)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                        sport === s ? "bg-white/[0.08] text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {s === "tennis" ? "🎾 Tennis" : "🏓 Pickleball"}
                    </button>
                  ))}
                </div>
              )}

              {/* Party size */}
              <div className="flex items-center justify-between bg-white/[0.04] rounded-2xl px-4 py-2.5 border border-white/[0.05]">
                <span className="text-sm text-muted-foreground">Party size</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setPartySize(Math.max(1, partySize - 1))} className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-lg font-bold">−</button>
                  <span className="text-base font-bold w-5 text-center">{partySize}</span>
                  <button onClick={() => setPartySize(Math.min(8, partySize + 1))} className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-lg font-bold">+</button>
                </div>
              </div>
            </div>

            <Button
              className="w-full h-14 rounded-2xl gradient-primary font-bold text-primary-foreground text-base shadow-lg shadow-primary/20"
              onClick={handleStart}
              disabled={queueLoading}
            >
              {queueLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Zap className="w-5 h-5 mr-2" />}
              Start My Session
            </Button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/50">
          Scanned at {court?.name ?? "this court"} · CourtQueue
        </p>
      </div>
    </div>
  );
}
