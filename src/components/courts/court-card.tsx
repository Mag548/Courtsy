"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Users,
  Clock,
  Zap,
  ChevronRight,
  Timer,
  X,
  Trophy,
  Navigation,
  ExternalLink,
  QrCode,
  BarChart2,
  Check,
} from "lucide-react";
import type { CourtWithQueue, QueueEntry } from "@/lib/supabase/types";
import { useAuth } from "@/components/providers/auth-provider";
import { useQueue } from "@/hooks/use-queue";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { AuthModal } from "@/components/auth/auth-modal";
import QRCode from "react-qr-code";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CourtActivityChart } from "@/components/courts/court-activity-chart";
import { useCourtTraffic } from "@/hooks/use-court-traffic";
import {
  estimateWaitMinutes,
  estimateWaitForPosition,
  formatWaitMinutes,
} from "@/lib/court-traffic";

interface CourtCardProps {
  court: CourtWithQueue;
  onClose: () => void;
  onDirections?: (lat: number, lng: number, name: string) => void;
}

function SessionTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const expires = new Date(expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
      setIsUrgent(diff < 5 * 60 * 1000);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div
      className={`flex items-center gap-1.5 text-sm font-mono font-bold ${
        isUrgent ? "text-red-400 pulse-green" : "text-primary"
      }`}
    >
      <Timer className="w-4 h-4" />
      {timeLeft}
    </div>
  );
}

function QueueEntryRow({
  entry,
  index,
  isCurrentUser,
  numCourts,
  hasActiveSession,
  reportedOccupied,
}: {
  entry: QueueEntry & { user?: { full_name: string | null; avatar_url: string | null } };
  index: number;
  isCurrentUser: boolean;
  numCourts: number;
  hasActiveSession: boolean;
  reportedOccupied: number;
}) {
  const waitMins = estimateWaitForPosition(
    index + 1,
    numCourts,
    hasActiveSession,
    reportedOccupied
  );

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
        isCurrentUser ? "bg-primary/10 border border-primary/30" : "hover:bg-white/[0.04]"
      }`}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          index === 0
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {index + 1}
      </div>
      <Avatar className="w-7 h-7">
        <AvatarImage src={entry.user?.avatar_url || undefined} />
        <AvatarFallback className="text-xs bg-secondary">
          {entry.user?.full_name?.[0]?.toUpperCase() ?? "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {isCurrentUser ? "You" : entry.user?.full_name || "Player"}
        </p>
        <p className="text-xs text-muted-foreground">
          {entry.party_size > 1 ? `${entry.party_size} players` : "1 player"} ·{" "}
          {entry.joined_at ? formatDistanceToNow(new Date(entry.joined_at), { addSuffix: true }) : ""}
        </p>
      </div>
      {waitMins > 0 && (
        <span className="text-xs text-muted-foreground">{formatWaitMinutes(waitMins)}</span>
      )}
    </div>
  );
}

// ── Traffic report panel ──────────────────────────────────────────────────────
function TrafficReportPanel({ courtId, numCourts, onClose, onSubmitted }: {
  courtId: string; numCourts: number; onClose: () => void; onSubmitted?: () => void;
}) {
  const { user } = useAuth();
  const supabase = createClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (selected === null || !user) return;
    setLoading(true);
    const { error } = await supabase.from("court_traffic_reports").insert({
      court_id: courtId,
      user_id: user.id,
      occupied_courts: selected,
    });
    setLoading(false);
    if (error) { toast.error("Failed to submit report"); return; }
    setSubmitted(true);
    toast.success("Thanks for reporting court traffic!");
    onSubmitted?.();
    setTimeout(onClose, 1500);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Check className="w-5 h-5 text-primary" />
        </div>
        <p className="text-sm font-medium">Report submitted!</p>
        <p className="text-xs text-muted-foreground">This helps others plan their visit.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold">How many courts are occupied</p>
        <p className="text-xs text-muted-foreground">by players not using the app?</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: numCourts + 1 }, (_, i) => i).map((n) => (
          <button
            key={n}
            onClick={() => setSelected(n)}
            className={`py-3 rounded-2xl text-sm font-bold border transition-all ${
              selected === n
                ? "border-primary bg-primary/20 text-primary"
                : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        0 = all courts free for queue · {numCourts} = all courts occupied
      </p>
      <Button
        className="w-full h-11 rounded-2xl gradient-primary text-primary-foreground font-semibold"
        onClick={handleSubmit}
        disabled={selected === null || loading}
      >
        {loading ? "Submitting…" : "Submit Report"}
      </Button>
    </div>
  );
}

export function CourtCard({ court, onClose, onDirections }: CourtCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { joinQueue, leaveQueue, getUserQueueEntry, startSession, endSession, loading } =
    useQueue();
  const [userEntry, setUserEntry] = useState<QueueEntry | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [sport, setSport] = useState<"tennis" | "pickleball">(
    court.court_type === "pickleball" ? "pickleball" : "tennis"
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [queueWithUsers, setQueueWithUsers] = useState<
    (QueueEntry & { user?: { full_name: string | null; avatar_url: string | null } })[]
  >([]);
  const [showTrafficReport, setShowTrafficReport] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const supabase = createClient();
  const { recentOccupied, hourlyActivity, totalReports, refetch: refetchTraffic } =
    useCourtTraffic(court.id);

  const waitingEntries = court.queue?.queue_entries?.filter(
    (e) => e.status === "waiting"
  ) ?? [];

  const hasActiveSession = !!court.active_session;
  const estimatedWait = estimateWaitMinutes({
    numCourts: court.num_courts,
    queueLength: waitingEntries.length,
    hasActiveSession,
    reportedOccupied: recentOccupied,
  });

  const fetchUserEntry = useCallback(async () => {
    if (!user) return;
    const entry = await getUserQueueEntry(court.id, user.id);
    setUserEntry(entry);
  }, [user, court.id, getUserQueueEntry]);

  const fetchQueueWithUsers = useCallback(async () => {
    if (!court.queue) return;

    const { data } = await supabase
      .from("queue_entries")
      .select("*, user:users(full_name, avatar_url)")
      .eq("queue_id", court.queue.id)
      .eq("status", "waiting")
      .order("position");

    if (data) setQueueWithUsers(data as typeof queueWithUsers);
  }, [supabase, court.queue]);

  useEffect(() => {
    fetchUserEntry();
    fetchQueueWithUsers();
  }, [fetchUserEntry, fetchQueueWithUsers]);

  const handleJoin = async () => {
    if (!user) return;
    const entry = await joinQueue(court.id, user.id, sport, partySize);
    if (entry) {
      setUserEntry(entry);
      router.push(`/queue/${court.id}`);
    }
    fetchQueueWithUsers();
  };

  const handleDirections = () => {
    if (onDirections) {
      onDirections(court.latitude, court.longitude, court.name);
    } else {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${court.latitude},${court.longitude}`,
        "_blank"
      );
    }
  };

  const handleLeave = async () => {
    if (!userEntry) return;
    await leaveQueue(userEntry.id);
    setUserEntry(null);
    fetchQueueWithUsers();
  };

  const handleStartSession = async () => {
    if (!user || !userEntry) return;
    await startSession(court.id, userEntry.id, user.id);
    fetchUserEntry();
  };

  const handleEndSession = async () => {
    if (!court.active_session) return;
    await endSession(court.active_session.id);
  };

  const courtTypeLabel = {
    tennis: "Tennis",
    pickleball: "Pickleball",
    both: "Tennis & Pickleball",
  }[court.court_type];

  const courtTypeBadgeColor = {
    tennis: "bg-green-500/20 text-green-400 border-green-500/30",
    pickleball: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    both: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  }[court.court_type];

  return (
    <Card className="scale-in border-0 ring-0 rounded-3xl surface-elevated shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className={`text-xs rounded-lg ${courtTypeBadgeColor}`}
              >
                {courtTypeLabel}
              </Badge>
              {court.active_session && (
                <Badge className="text-xs rounded-lg bg-orange-500/20 text-orange-400 border-orange-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mr-1 pulse-green" />
                  Court Active
                </Badge>
              )}
            </div>
            <CardTitle className="text-xl leading-tight font-bold">{court.name}</CardTitle>
            {court.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                <MapPin className="w-3 h-3 shrink-0" />
                {court.address}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-full shrink-0 -mt-1 -mr-1 bg-white/[0.04] hover:bg-white/[0.08]"
            title="Back"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Directions CTAs */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-2xl gap-2 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]"
            onClick={handleDirections}
          >
            <Navigation className="w-4 h-4 text-primary" />
            Directions
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-2xl gap-2 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]"
            onClick={() =>
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  court.name + ", " + (court.address ?? "")
                )}&query_place_id=&center=${court.latitude},${court.longitude}`,
                "_blank"
              )
            }
          >
            <ExternalLink className="w-4 h-4 text-primary" />
            Google Maps
          </Button>
        </div>

        {/* QR + Traffic row */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 h-10 rounded-2xl gap-2 text-xs border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]"
            onClick={() => setShowQR(true)}
          >
            <QrCode className="w-3.5 h-3.5 text-primary" />
            Court QR Code
          </Button>
          {user && (
            <Button
              variant="outline"
              className="flex-1 h-10 rounded-2xl gap-2 text-xs border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]"
              onClick={() => setShowTrafficReport(true)}
            >
              <BarChart2 className="w-3.5 h-3.5 text-yellow-400" />
              Report Traffic
            </Button>
          )}
        </div>

        {/* QR Code Dialog */}
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="sm:max-w-[320px] p-6 rounded-3xl border-white/[0.08] bg-[#0a0a0a]">
            <DialogTitle className="text-center font-bold">{court.name}</DialogTitle>
            <div className="flex flex-col items-center gap-4 mt-2">
              <div className="bg-white p-4 rounded-2xl">
                <QRCode
                  value={`${typeof window !== "undefined" ? window.location.origin : "https://courtqueue.vercel.app"}/court/${court.id}`}
                  size={180}
                  style={{ display: "block" }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Scan to instantly join the queue or start a session at this court
              </p>
              <Button
                variant="outline"
                className="w-full rounded-2xl border-white/[0.08]"
                onClick={() => {
                  const url = `${window.location.origin}/court/${court.id}`;
                  navigator.clipboard.writeText(url);
                  toast.success("Link copied!");
                }}
              >
                Copy Link
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Traffic Report Dialog */}
        <Dialog open={showTrafficReport} onOpenChange={setShowTrafficReport}>
          <DialogContent className="sm:max-w-[340px] p-6 rounded-3xl border-white/[0.08] bg-[#0a0a0a]">
            <DialogTitle className="text-center font-bold mb-2">Report Court Traffic</DialogTitle>
            <TrafficReportPanel
              courtId={court.id}
              numCourts={court.num_courts}
              onClose={() => setShowTrafficReport(false)}
              onSubmitted={refetchTraffic}
            />
          </DialogContent>
        </Dialog>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.05] p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Trophy className="w-3 h-3" />
              <span className="text-xs">Courts</span>
            </div>
            <p className="text-xl font-bold">{court.num_courts}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.05] p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Users className="w-3 h-3" />
              <span className="text-xs">Queue</span>
            </div>
            <p className="text-xl font-bold">{waitingEntries.length}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.05] p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Clock className="w-3 h-3" />
              <span className="text-xs">Wait</span>
            </div>
            <p className="text-xl font-bold">
              {formatWaitMinutes(estimatedWait)}
            </p>
          </div>
        </div>

        <CourtActivityChart
          hourlyActivity={hourlyActivity}
          totalReports={totalReports}
          recentOccupied={recentOccupied}
          numCourts={court.num_courts}
        />

        {/* Active Session Timer */}
        {court.active_session && (
          <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 rounded-2xl px-4 py-3">
            <span className="text-sm text-orange-400">Current session</span>
            <SessionTimer expiresAt={court.active_session.expires_at} />
          </div>
        )}

        <Separator className="bg-white/[0.06]" />

        {/* Queue List */}
        {queueWithUsers.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Current Queue
            </h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {queueWithUsers.map((entry, i) => (
                <QueueEntryRow
                  key={entry.id}
                  entry={entry}
                  index={i}
                  isCurrentUser={entry.user_id === user?.id}
                  numCourts={court.num_courts}
                  hasActiveSession={hasActiveSession}
                  reportedOccupied={recentOccupied}
                />
              ))}
            </div>
          </div>
        )}

        {/* Action Section */}
        {user ? (
          userEntry ? (
            <div className="space-y-3">
              <div className="bg-primary/10 border border-primary/25 rounded-2xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">
                  Your position
                </p>
                <p className="text-3xl font-bold text-primary">
                  #{userEntry.position}
                </p>
                {userEntry.position === 1 && (
                  <p className="text-xs text-primary/80 mt-1 flex items-center justify-center gap-1">
                    <Zap className="w-3 h-3" />
                    You&apos;re up next!
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {userEntry.position === 1 && !court.active_session && (
                  <Button
                    className="flex-1 h-11 rounded-2xl gradient-primary text-primary-foreground font-semibold"
                    onClick={handleStartSession}
                    disabled={loading}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Start Playing
                  </Button>
                )}
                {court.active_session?.user_id === user.id && (
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-2xl border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                    onClick={handleEndSession}
                    disabled={loading}
                  >
                    End Session
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-2xl border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={handleLeave}
                  disabled={loading}
                >
                  Leave Queue
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Sport Selector */}
              {court.court_type === "both" && (
                <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                  <button
                    onClick={() => setSport("tennis")}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      sport === "tennis"
                        ? "bg-white/[0.08] text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🎾 Tennis
                  </button>
                  <button
                    onClick={() => setSport("pickleball")}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      sport === "pickleball"
                        ? "bg-white/[0.08] text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🏓 Pickleball
                  </button>
                </div>
              )}

              {/* Party Size */}
              <div className="flex items-center justify-between bg-white/[0.04] border border-white/[0.05] rounded-2xl px-4 py-2.5">
                <span className="text-sm text-muted-foreground">
                  Party size
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl bg-white/[0.04]"
                    onClick={() => setPartySize(Math.max(1, partySize - 1))}
                  >
                    −
                  </Button>
                  <span className="text-base font-bold w-5 text-center">
                    {partySize}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl bg-white/[0.04]"
                    onClick={() => setPartySize(Math.min(8, partySize + 1))}
                  >
                    +
                  </Button>
                </div>
              </div>

              <Button
                className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20"
                onClick={handleJoin}
                disabled={loading}
              >
                <Zap className="w-4 h-4 mr-2" />
                Join Queue
                {waitingEntries.length > 0 && (
                  <ChevronRight className="w-4 h-4 ml-auto" />
                )}
              </Button>
            </div>
          )
        ) : (
          <>
            <Button
              className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20"
              onClick={() => setAuthModalOpen(true)}
            >
              <Zap className="w-4 h-4 mr-2" />
              Join Queue
            </Button>
            <AuthModal
              open={authModalOpen}
              onOpenChange={setAuthModalOpen}
              onSuccess={() => {
                // After sign-in, the auth state will update and re-render with join UI
              }}
            />
          </>
        )}

        {/* Amenities */}
        {court.amenities && court.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {court.amenities.map((a) => (
              <span
                key={a}
                className="text-xs px-2.5 py-1 bg-white/[0.05] border border-white/[0.05] rounded-full text-muted-foreground capitalize"
              >
                {a.replace("_", " ")}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
