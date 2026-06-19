"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import { getCourtSlots } from "@/lib/court-slots";
import {
  countActiveSessions,
  getAvailableCourts,
} from "@/lib/court-availability";
import { estimateWaitMinutes, formatWaitMinutes } from "@/lib/court-traffic";
import type { CourtWithQueue } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface CourtListCardProps {
  court: CourtWithQueue;
  distanceLabel?: string;
  onClick: () => void;
  className?: string;
}

export function CourtListCard({
  court,
  distanceLabel,
  onClick,
  className,
}: CourtListCardProps) {
  const waiting =
    court.queue?.queue_entries?.filter((e) => e.status === "waiting").length ??
    0;
  const playing = countActiveSessions(court.active_sessions);
  const available = getAvailableCourts(
    court.num_courts,
    court.active_sessions,
    0
  );
  const slots = getCourtSlots(court.num_courts, court.active_sessions);
  const isAvailable = available > 0;
  const estWait = estimateWaitMinutes({
    numCourts: court.num_courts,
    queueLength: waiting,
    appOccupiedCount: playing,
    reportedOccupied: 0,
  });

  const sportIcon =
    court.court_type === "pickleball"
      ? "sports_volleyball"
      : "sports_tennis";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full text-left glass-panel rounded-3xl p-5",
        "hover:bg-white/10 transition-all duration-300 active:scale-[0.98] cursor-pointer shadow-xl",
        className
      )}
    >
      <div className="flex justify-between items-start mb-4 gap-3">
        <div className="flex gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-white/10 bg-surface-container-high flex items-center justify-center">
            <MaterialIcon
              name={sportIcon}
              filled
              className="text-2xl text-primary-fixed"
            />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-primary truncate">
              {court.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <MaterialIcon
                name="location_on"
                className="text-primary-fixed text-base shrink-0"
              />
              <span className="text-sm text-on-surface-variant truncate">
                {distanceLabel ?? court.address ?? court.court_type}
              </span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full border shrink-0",
            isAvailable
              ? "bg-primary-container/20 border-primary-container/30"
              : "bg-secondary-container/10 border-secondary-container/30"
          )}
        >
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              isAvailable
                ? "bg-primary-fixed animate-pulse"
                : "bg-secondary"
            )}
          />
          <span
            className={cn(
              "label-caps",
              isAvailable ? "text-primary-fixed" : "text-secondary"
            )}
          >
            {isAvailable ? "Available" : "Busy"}
          </span>
        </div>
      </div>

      {court.num_courts <= 6 ? (
        <div
          className={cn(
            "grid gap-2 mt-2",
            court.num_courts <= 4 ? "grid-cols-4" : "grid-cols-3"
          )}
        >
          {slots.map((slot) => (
            <div
              key={slot.number}
              className={cn(
                "bg-surface-container-high rounded-xl p-2.5 sm:p-3 flex flex-col items-center justify-center border border-white/5",
                slot.status === "busy" && "opacity-60"
              )}
            >
              <span className="label-caps text-on-surface-variant text-[10px]">
                C{slot.number}
              </span>
              <span
                className={cn(
                  "text-sm font-medium mt-0.5",
                  slot.status === "open"
                    ? "text-primary-fixed"
                    : "text-error"
                )}
              >
                {slot.status === "open"
                  ? "Open"
                  : `${slot.minutesLeft}m`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant mt-1">
          {available}/{court.num_courts} courts available
          {waiting > 0 && ` · ${waiting} waiting`}
        </p>
      )}

      {!isAvailable && waiting > 0 && (
        <div className="space-y-3 mt-4">
          <div className="flex justify-between items-center">
            <span className="label-caps text-on-surface-variant uppercase tracking-widest">
              Wait Time Progress
            </span>
            <span className="text-sm text-secondary">
              Est. {formatWaitMinutes(estWait)}
            </span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-secondary-container to-secondary rounded-full shadow-[0_0_10px_rgba(75,142,255,0.5)] transition-all"
              style={{
                width: `${Math.min(95, Math.max(15, (waiting / (court.num_courts + waiting)) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
