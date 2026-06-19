"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useQueue } from "@/hooks/use-queue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  Copy,
  Check,
  Navigation,
  Zap,
  PlusCircle,
  Trophy,
  LogOut,
  ExternalLink,
} from "lucide-react";
import type { Court, QueueEntry, CourtSession } from "@/lib/supabase/types";
import { toast } from "sonner";
import { AuthModal } from "@/components/auth/auth-modal";
import { useCourtTraffic } from "@/hooks/use-court-traffic";
import { estimateWaitForPosition, formatWaitMinutes } from "@/lib/court-traffic";
import {
  countActiveSessions,
  courtAssignmentMessage,
  isSessionActive,
} from "@/lib/court-availability";
import { useCourtTimerAlerts } from "@/hooks/use-court-timer-alerts";

// ─── Countdown display ────────────────────────────────────────────────────────
function CountdownTimer({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire?: () => void;
}) {
  const [display, setDisplay] = useState("");
  const [urgent, setUrgent] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setDisplay("00:00");
        if (!calledRef.current) {
          calledRef.current = true;
          onExpire?.();
        }
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setDisplay(`${mins}:${secs.toString().padStart(2, "0")}`);
      setUrgent(diff < 5 * 60 * 1000);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  return (
    <span
      className={`font-mono text-6xl font-bold tracking-tighter tabular-nums ${
        urgent ? "text-error animate-pulse" : "text-primary-fixed"
      }`}
    >
      {display}
    </span>
  );
}

// ─── Invite box ───────────────────────────────────────────────────────────────
function InviteBox({
  entryId,
  existingCode,
  courtId,
  onCodeGenerated,
}: {
  entryId: string;
  existingCode: string | null;
  courtId: string;
  onCodeGenerated: (code: string) => void;
}) {
  const { generateInviteCode } = useQueue();
  const [code, setCode] = useState(existingCode);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    const newCode = await generateInviteCode(entryId);
    setLoading(false);
    if (newCode) {
      setCode(newCode);
      onCodeGenerated(newCode);
    }
  };

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/queue/${courtId}?invite=${code}`
      : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Invite link copied!");
  };

  return (
    <div className="frosted-surface rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Invite Others</h3>
      </div>

      {code ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-background/60 rounded-xl px-4 py-2.5 font-mono text-lg font-bold tracking-widest text-primary text-center border border-primary/20">
              {code}
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Share this code or link so others can join your booking
          </p>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? "Copied!" : "Copy invite link"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Generate a code so friends can join your spot in the queue.
          </p>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleGenerate}
            disabled={loading}
          >
            <PlusCircle className="w-4 h-4" />
            {loading ? "Generating…" : "Generate invite code"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function QueuePage() {
  const { courtId } = useParams<{ courtId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteParam = searchParams.get("invite");

  const { user } = useAuth();
  const { leaveQueue, endSession, joinByInvite } = useQueue();

  const supabase = createClient();
  const { recentOccupied } = useCourtTraffic(courtId);

  const [court, setCourt] = useState<Court | null>(null);
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [activeSessions, setActiveSessions] = useState<CourtSession[]>([]);
  const [queueAhead, setQueueAhead] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  // ── Load court info ──────────────────────────────────────────────────────────
  const fetchCourt = useCallback(async () => {
    const { data } = await supabase
      .from("courts")
      .select("*")
      .eq("id", courtId)
      .single();
    if (data) setCourt(data);
  }, [supabase, courtId]);

  // ── Load user entry ──────────────────────────────────────────────────────────
  const fetchEntry = useCallback(async () => {
    if (!user) return;

    const { data: queue } = await supabase
      .from("queues")
      .select("id")
      .eq("court_id", courtId)
      .single();

    if (!queue) return;

    // Use limit(1) + order so a stale duplicate never causes maybeSingle to return null
    const { data } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("queue_id", queue.id)
      .eq("user_id", user.id)
      .in("status", ["waiting", "playing", "notified"])
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setEntry(data ?? null);

    // Count people ahead
    if (data?.status === "waiting") {
      const { count } = await supabase
        .from("queue_entries")
        .select("*", { count: "exact", head: true })
        .eq("queue_id", queue.id)
        .eq("status", "waiting")
        .lt("position", data.position);
      setQueueAhead(count ?? 0);
    }
  }, [user, supabase, courtId]);

  // ── Load active session ──────────────────────────────────────────────────────
  const fetchSession = useCallback(async () => {
    await supabase.rpc("sync_court_timers", { p_court_id: courtId });
    const { data } = await supabase
      .from("court_sessions")
      .select("*")
      .eq("court_id", courtId)
      .eq("status", "active");
    setActiveSessions((data ?? []).filter(isSessionActive));
  }, [supabase, courtId]);

  const session =
    entry?.status === "playing"
      ? activeSessions.find((s) => s.queue_entry_id === entry.id) ?? null
      : null;

  const userCourtNumber =
    entry?.assigned_court_number ?? session?.court_number ?? null;
  useCourtTimerAlerts(activeSessions, userCourtNumber, entry?.id ?? null);

  // ── Handle invite param ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!inviteParam) return;
    if (!user) {
      setAuthOpen(true);
      return;
    }
    joinByInvite(inviteParam, user.id).then(({ success, courtId: cId }) => {
      if (success && cId) {
        router.replace(`/queue/${cId}`);
        fetchEntry();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteParam, user]);

  useEffect(() => {
    fetchCourt();
  }, [fetchCourt]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession, entry]);

  // ── Realtime subscription ────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`queue-page-${courtId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries" },
        () => fetchEntry()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "court_sessions" },
        () => fetchSession()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, courtId, fetchEntry, fetchSession]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleLeave = async () => {
    if (!entry) return;
    setLeaveLoading(true);
    await leaveQueue(entry.id);
    setLeaveLoading(false);
    router.push("/app");
  };

  const handleEnd = async () => {
    if (!session) return;
    await endSession(session.id);
    router.push("/app");
  };

  const handleDirections = () => {
    if (!court) return;
    const dest = `${court.latitude},${court.longitude}`;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
      "_blank"
    );
  };

  // ── Auth guard ───────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
        <p className="text-muted-foreground text-center">
          Sign in to view your queue status.
        </p>
        <Button onClick={() => setAuthOpen(true)}>
          <Zap className="w-4 h-4 mr-2" />
          Sign In
        </Button>
        <AuthModal
          open={authOpen}
          onOpenChange={setAuthOpen}
          onSuccess={() => {
            setAuthOpen(false);
            fetchEntry();
          }}
        />
      </div>
    );
  }

  const isPlaying = entry?.status === "playing";
  const isUntimedSession = isPlaying && session && !session.expires_at;
  const isTimedPlay = isPlaying && session?.expires_at;
  const isNotified = entry?.status === "notified";
  const isWaiting = entry?.status === "waiting";
  const appOccupiedCount = countActiveSessions(activeSessions);

  const sportLabel = entry?.sport ?? court?.court_type ?? "court";

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Blurred map backdrop */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10" />
        <div className="w-full h-full scale-110 opacity-30 bg-surface-container-high" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-4">
        <div className="rounded-full bg-surface/80 backdrop-blur-xl border border-white/10 shadow-[0px_40px_40px_-10px_rgba(19,19,19,0.4)] flex items-center gap-2 px-4 py-3 max-w-md mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-9 w-9 p-0 shrink-0"
            onClick={() => router.push("/app")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0 text-center">
            <h1 className="font-semibold truncate text-primary-fixed text-sm">
              {court?.name ?? "Court"}
            </h1>
            {court?.address && (
              <p className="text-[10px] text-on-surface-variant truncate">{court.address}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-9 w-9 p-0 shrink-0"
            onClick={handleDirections}
          >
            <Navigation className="w-4 h-4 text-primary-fixed" />
          </Button>
        </div>
      </div>

      {/* ── Spot-open banner ── */}
      {isNotified && (
        <div className="bg-green-500/10 border-b border-green-500/30 px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-400">
              A court is open — your turn!
            </p>
            <p className="text-xs text-green-400/70">
              Head to your assigned court — you&apos;ll be on shortly.
            </p>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-start px-container-padding py-8 pb-40 gap-6 max-w-md mx-auto w-full">
        {/* Status badge */}
        <Badge
          className={`text-sm px-4 py-1.5 rounded-full font-medium ${
            isPlaying
              ? "bg-green-500/20 text-green-400 border-green-500/30"
              : isNotified
              ? "bg-green-500/20 text-green-400 border-green-500/30"
              : "bg-primary/20 text-primary border-primary/30"
          }`}
          variant="outline"
        >
          {isPlaying ? (
            <><Trophy className="w-3.5 h-3.5 mr-1.5" />On Court</>
          ) : isNotified ? (
            <><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse mr-1.5 inline-block" />Spot Open!</>
          ) : (
            <><Clock className="w-3.5 h-3.5 mr-1.5" />In Queue</>
          )}
        </Badge>

        {/* ── No timer while queue is empty ── */}
        {isUntimedSession && entry && (
          <div className="w-full space-y-6 slide-up">
            <div className="glass-panel rounded-3xl p-8 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground uppercase tracking-widest">
                Your court
              </p>
              <p className="text-6xl font-black text-primary-fixed">
                Court {entry.assigned_court_number ?? session?.court_number ?? "—"}
              </p>
              <p className="text-sm font-semibold text-primary-fixed">Enjoy your time!</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                {courtAssignmentMessage(
                  userCourtNumber ?? 1,
                  appOccupiedCount
                )}
              </p>
            </div>
            <Button
              variant="destructive"
              className="w-full h-12 rounded-2xl gap-2"
              onClick={handleEnd}
            >
              <LogOut className="w-4 h-4" />
              Leave Court
            </Button>
          </div>
        )}

        {/* ── Timed session ── */}
        {isTimedPlay && session && (
          <div className="w-full space-y-6 slide-up">
            <div className="glass-panel rounded-3xl p-8 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground uppercase tracking-widest">
                Court {entry?.assigned_court_number ?? session.court_number} · Time remaining
              </p>
              <CountdownTimer
                expiresAt={session.expires_at!}
                onExpire={async () => {
                  toast.info("Your session has ended.");
                  // End the session in DB so the court clears and next player is notified
                  await endSession(session.id);
                  router.push("/app");
                }}
              />
              <p className="text-xs text-muted-foreground">
                {sportLabel} · {court?.name}
              </p>
            </div>

            <Separator className="opacity-30" />

            {entry && (
              <InviteBox
                entryId={entry.id}
                existingCode={entry.invite_code ?? null}
                courtId={courtId}
                onCodeGenerated={() => fetchEntry()}
              />
            )}

            <Button
              variant="destructive"
              className="w-full h-12 rounded-2xl gap-2"
              onClick={handleEnd}
            >
              <LogOut className="w-4 h-4" />
              End Session
            </Button>
          </div>
        )}

        {(isWaiting || isNotified) && entry && (
          <div className="w-full space-y-8 slide-up">
            {(() => {
              const waitMins = estimateWaitForPosition(
                entry.position ?? 1,
                court?.num_courts ?? 1,
                appOccupiedCount,
                recentOccupied
              );
              const progress = Math.min(
                95,
                Math.max(10, 100 - (entry.position ?? 1) * 20)
              );
              return (
                <>
                  <div className="text-center">
                    <div className="relative inline-block mb-4">
                      <div className="absolute inset-0 bg-primary-container/20 rounded-full blur-3xl scale-150 pulse-dot" />
                      <h2 className="text-[72px] leading-none font-bold text-primary-fixed relative">
                        {waitMins}
                        <span className="text-2xl ml-2 font-semibold">min</span>
                      </h2>
                    </div>
                    <p className="label-caps text-on-surface-variant tracking-widest">
                      Estimated Wait Time
                    </p>
                  </div>

                  <div className="bg-surface-container-high/60 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/10 flex items-center justify-center gap-2 mx-auto w-fit">
                    <span className="w-2 h-2 rounded-full bg-primary-fixed animate-pulse" />
                    <span className="text-lg font-semibold text-primary">
                      Position #{entry.position}
                    </span>
                    <span className="text-sm text-on-surface-variant">in line</span>
                  </div>

                  <div className="w-full space-y-4">
                    <div className="relative h-1 bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className="absolute left-0 top-0 bottom-0 progress-gradient transition-all duration-1000"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-center text-sm text-on-surface-variant">
                      {queueAhead === 0
                        ? "You're up next when a court opens"
                        : `${queueAhead} ${queueAhead === 1 ? "player" : "players"} ahead of you`}
                    </p>
                  </div>
                </>
              );
            })()}

            {entry && (
              <InviteBox
                entryId={entry.id}
                existingCode={entry.invite_code ?? null}
                courtId={courtId}
                onCodeGenerated={() => fetchEntry()}
              />
            )}

            <div className="fixed bottom-0 left-0 right-0 z-30 p-container-padding pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <div className="max-w-md mx-auto glass-panel rounded-3xl p-4">
                <Button
                  variant="ghost"
                  className="w-full h-12 rounded-2xl gap-2 text-error hover:text-error hover:bg-error-container/20 label-caps"
                  onClick={handleLeave}
                  disabled={leaveLoading}
                >
                  <LogOut className="w-4 h-4" />
                  {leaveLoading ? "Leaving…" : "Leave Queue"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {!isPlaying && !isWaiting && !isNotified && (
          /* ── Not in queue ── */
          <div className="frosted-surface rounded-3xl p-8 flex flex-col items-center gap-4 w-full text-center">
            <p className="text-muted-foreground">
              You don&apos;t have an active booking for this court.
            </p>
            <Button
              className="rounded-2xl h-11 px-5 gradient-primary text-primary-foreground font-semibold"
              onClick={() => router.push("/app")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to map
            </Button>
          </div>
        )}
      </div>

      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        onSuccess={() => {
          setAuthOpen(false);
          fetchEntry();
        }}
      />
    </div>
  );
}
