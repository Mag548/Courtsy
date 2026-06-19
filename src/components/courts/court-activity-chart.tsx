"use client";

import { useMemo } from "react";
import { BarChart2 } from "lucide-react";
import {
  CHART_HOURS,
  formatHourLabel,
  type HourlyActivity,
} from "@/lib/court-traffic";

interface CourtActivityChartProps {
  hourlyActivity: HourlyActivity[];
  totalReports: number;
  recentOccupied: number;
  numCourts: number;
}

export function CourtActivityChart({
  hourlyActivity,
  totalReports,
  recentOccupied,
  numCourts,
}: CourtActivityChartProps) {
  const currentHour = new Date().getHours();

  const chartData = useMemo(() => {
    const byHour = new Map(hourlyActivity.map((h) => [h.hour, h]));
    const visible = CHART_HOURS.map((hour) => {
      const data = byHour.get(hour);
      return {
        hour,
        reportCount: data?.reportCount ?? 0,
        avgOccupancy: data?.avgOccupancy ?? 0,
      };
    });
    const maxCount = Math.max(1, ...visible.map((v) => v.reportCount));
    return { visible, maxCount };
  }, [hourlyActivity]);

  const busyLabel = useMemo(() => {
    if (totalReports === 0) return "No reports yet — be the first!";
    const peak = [...chartData.visible].sort(
      (a, b) => b.reportCount - a.reportCount
    )[0];
    if (peak.reportCount === 0) return "Usually not too busy";
    return `Busiest around ${formatHourLabel(peak.hour)}`;
  }, [chartData.visible, totalReports]);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-primary" />
            Court activity
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{busyLabel}</p>
        </div>
        {recentOccupied > 0 && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 shrink-0">
            {recentOccupied}/{numCourts} occupied now
          </span>
        )}
      </div>

      {/* Bar chart — Google popular-times style */}
      <div className="flex items-end gap-[3px] h-16 px-0.5">
        {chartData.visible.map(({ hour, reportCount }) => {
          const heightPct = (reportCount / chartData.maxCount) * 100;
          const isNow = hour === currentHour;
          const hasData = reportCount > 0;

          return (
            <div
              key={hour}
              className="flex-1 flex flex-col items-center justify-end h-full group relative"
              title={`${formatHourLabel(hour)}: ${reportCount} report${reportCount !== 1 ? "s" : ""}`}
            >
              <div
                className={`w-full rounded-sm transition-all ${
                  isNow
                    ? "bg-primary shadow-sm shadow-primary/40"
                    : hasData
                    ? "bg-white/25 group-hover:bg-white/40"
                    : "bg-white/[0.06]"
                }`}
                style={{
                  height: hasData ? `${Math.max(heightPct, 8)}%` : "4%",
                  minHeight: hasData ? "4px" : "2px",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Hour labels */}
      <div className="flex justify-between text-[9px] text-muted-foreground/70 px-0.5">
        {[6, 9, 12, 15, 18, 21].map((h) => (
          <span key={h}>{formatHourLabel(h)}</span>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/60 text-center">
        {totalReports === 0
          ? "Report traffic to help build this chart"
          : `${totalReports} report${totalReports !== 1 ? "s" : ""} in the last 7 days`}
      </p>
    </div>
  );
}
