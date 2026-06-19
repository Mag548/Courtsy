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
  Timer,
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
        urgent ? "text-red-400 animate-pulse" : "text-primary"
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
  const { leaveQueue, startSession, endSession, extendSession, joinByInvite } =
    useQueue();

  const supabase = createClient();
  const { recentOccupied } = useCourtTraffic(courtId);

  const [court, setCourt] = useState<Court | null>(null);
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [session, setSession] = useState<CourtSession | null>(null);
  const [queueAhead, setQueueAhead] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [extendLoading, setExtendLoading] = useState(false);
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
    if (!entry) return;
    const { data } = await supabase
      .from("court_sessions")
      .select("*")
      .eq("court_id", courtId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    setSession(data ?? null);
  }, [supabase, courtId, entry]);

  // ── Pending queue people (to decide if extend is allowed) ────────────────────
  const [othersWaiting, setOthersWaiting] = useState(0);
  const fetchOthersWaiting = useCallback(async () => {
    if (!user) return;
    const { data: queue } = await supabase
      .from("queues")
      .select("id")
      .eq("court_id", courtId)
      .single();
    if (!queue) return;
    const { count } = await supabase
      .from("queue_entries")
      .select("*", { count: "exact", head: true })
      .eq("queue_id", queue.id)
      .eq("status", "waiting")
      .neq("user_id", user.id);
    setOthersWaiting(count ?? 0);
  }, [supabase, courtId, user]);

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
  }, [fetchSession]);

  useEffect(() => {
    fetchOthersWaiting();
  }, [fetchOthersWaiting]);

  // ── Realtime subscription ────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`queue-page-${courtId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries" },
        () => {
          fetchEntry();
          fetchOthersWaiting();
        }
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
  }, [supabase, courtId, fetchEntry, fetchSession, fetchOthersWaiting]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleLeave = async () => {
    if (!entry) return;
    setLeaveLoading(true);
    await leaveQueue(entry.id);
    setLeaveLoading(false);
    router.push("/app");
  };

  const handleStart = async () => {
    if (!user || !entry) return;
    await startSession(courtId, entry.id, user.id);
    fetchEntry();
    fetchSession();
  };

  const handleEnd = async () => {
    if (!session) return;
    await endSession(session.id);
    setSession(null);
    router.push("/app");
  };

  const handleExtend = async () => {
    if (!session) return;
    setExtendLoading(true);
    await extendSession(session.id);
    setExtendLoading(false);
    fetchSession();
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

  const isPlaying = entry?.status === "playing" || session !== null;
  const isNotified = entry?.status === "notified";
  const isWaiting = entry?.status === "waiting";
  const canExtend =
    isPlaying && session && !session.extended && othersWaiting === 0;

  const sportLabel = entry?.sport ?? court?.court_type ?? "court";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 frosted-surface border-b border-white/[0.06] px-3 sm:px-4 py-3 flex items-center gap-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-2xl gap-1.5 shrink-0 bg-white/[0.04] hover:bg-white/[0.08] h-10 px-3"
          onClick={() => router.push("/app")}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">{court?.name ?? "Court"}</h1>
          {court?.address && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              {court.address}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0 rounded-2xl h-10 px-3.5 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]"
          onClick={handleDirections}
        >
          <Navigation className="w-3.5 h-3.5 text-primary" />
          Directions
        </Button>
        {court && (
          <Button
            variant="ghost"
            size="icon"
            title="Open in Google Maps"
            className="shrink-0 rounded-2xl h-10 w-10 bg-white/[0.03] hover:bg-white/[0.07]"
            onClick={() =>
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  court.name + ", " + (court.address ?? "")
                )}&center=${court.latitude},${court.longitude}`,
                "_blank"
              )
            }
          >
            <ExternalLink className="w-4 h-4 text-primary" />
          </Button>
        )}
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
              Head to the court and tap &quot;Start Session&quot; to claim your spot.
            </p>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="fade-in-up flex-1 flex flex-col items-center justify-start px-4 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] gap-6 max-w-md mx-auto w-full">
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

        {/* ── Playing view ── */}
        {isPlaying && session ? (
          <div className="w-full space-y-6">
            <div className="frosted-surface rounded-3xl p-8 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground uppercase tracking-widest">
                Time Remaining
              </p>
              <CountdownTimer
                expiresAt={session.expires_at}
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

            {canExtend && (
              <Button
                variant="outline"
                className="w-full h-12 rounded-2xl gap-2 border-primary/40 text-primary hover:bg-primary/10"
                onClick={handleExtend}
                disabled={extendLoading}
              >
                <Timer className="w-4 h-4" />
                {extendLoading ? "Extending…" : "+15 min (no one waiting)"}
              </Button>
            )}

            {session.extended && (
              <p className="text-center text-xs text-muted-foreground">
                Session already extended — can only extend once.
              </p>
            )}

            {othersWaiting > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                {othersWaiting} {othersWaiting === 1 ? "person" : "people"}{" "}
                waiting — extension unavailable.
              </p>
            )}

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
        ) : isWaiting || isNotified ? (
          /* ── Waiting / notified view ── */
          <div className="w-full space-y-6">
            <div className="frosted-surface rounded-3xl p-8 flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                <span className="text-4xl font-bold text-primary">
                  {entry?.position ?? "—"}
                </span>
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">
                  {entry?.position === 1
                    ? "You're next!"
                    : `#${entry?.position} in queue`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {queueAhead === 0
                    ? "No one ahead of you"
                    : `${queueAhead} ${queueAhead === 1 ? "person" : "people"} ahead`}
                </p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">
                  {formatWaitMinutes(
                    estimateWaitForPosition(
                      entry?.position ?? 1,
                      court?.num_courts ?? 1,
                      !!session,
                      recentOccupied
                    )
                  )}{" "}
                  estimated wait
                </span>
              </div>
              {entry?.party_size && entry.party_size > 1 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">{entry.party_size} players</span>
                </div>
              )}
            </div>

            {(entry?.position === 1 || isNotified) && (
              <Button
                className={`w-full h-12 rounded-2xl gap-2 font-semibold shadow-lg ${
                  isNotified
                    ? "bg-green-500 hover:bg-green-600 text-white shadow-green-500/20"
                    : "gradient-primary text-primary-foreground shadow-primary/20"
                }`}
                onClick={handleStart}
              >
                <Zap className="w-4 h-4" />
                {isNotified ? "Claim court now!" : "Start Session"}
              </Button>
            )}

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
              variant="ghost"
              className="w-full h-12 rounded-2xl gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLeave}
              disabled={leaveLoading}
            >
              <LogOut className="w-4 h-4" />
              {leaveLoading ? "Leaving…" : "Leave Queue"}
            </Button>
          </div>
        ) : (
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
