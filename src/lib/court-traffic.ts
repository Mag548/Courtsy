export type TrafficReport = {
  occupied_courts: number;
  reported_at: string;
};

export type HourlyActivity = {
  hour: number;
  reportCount: number;
  avgOccupancy: number;
};

const SESSION_MINUTES = 30;
const RECENT_REPORT_MS = 2 * 60 * 60 * 1000;

/** Most recent community report within the last 2 hours. */
export function getRecentReportedOccupancy(
  reports: TrafficReport[],
  maxAgeMs = RECENT_REPORT_MS
): number {
  const cutoff = Date.now() - maxAgeMs;
  const latest = reports.find(
    (r) => new Date(r.reported_at).getTime() >= cutoff
  );
  return latest?.occupied_courts ?? 0;
}

/** Estimate wait time factoring in app queue + non-app occupied courts. */
export function estimateWaitMinutes(params: {
  numCourts: number;
  queueLength: number;
  hasActiveSession: boolean;
  reportedOccupied: number;
  sessionMinutes?: number;
}): number {
  const {
    numCourts,
    queueLength,
    hasActiveSession,
    reportedOccupied,
    sessionMinutes = SESSION_MINUTES,
  } = params;

  const appOccupied = hasActiveSession ? 1 : 0;
  const totalOccupied = Math.min(numCourts, appOccupied + reportedOccupied);
  const freeCourts = numCourts - totalOccupied;

  if (queueLength === 0 && freeCourts > 0) return 0;

  const effectiveFree = Math.max(1, freeCourts);
  let wait = Math.ceil(queueLength / effectiveFree) * sessionMinutes;

  if (freeCourts <= 0) {
    wait = Math.max(wait, sessionMinutes);
  }

  return wait;
}

/** Wait for a specific queue position (1 = next up). */
export function estimateWaitForPosition(
  position: number,
  numCourts: number,
  hasActiveSession: boolean,
  reportedOccupied: number
): number {
  return estimateWaitMinutes({
    numCourts,
    queueLength: Math.max(0, position - 1),
    hasActiveSession,
    reportedOccupied,
  });
}

export function formatWaitMinutes(mins: number): string {
  if (mins === 0) return "~0m";
  if (mins < 60) return `~${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

/** Aggregate reports into 24 hourly buckets (local time). */
export function buildHourlyActivity(reports: TrafficReport[]): HourlyActivity[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    reportCount: 0,
    occupancySum: 0,
  }));

  for (const r of reports) {
    const h = new Date(r.reported_at).getHours();
    buckets[h].reportCount++;
    buckets[h].occupancySum += r.occupied_courts;
  }

  return buckets.map((b) => ({
    hour: b.hour,
    reportCount: b.reportCount,
    avgOccupancy: b.reportCount > 0 ? b.occupancySum / b.reportCount : 0,
  }));
}

/** Hours to show on the chart (6am – 10pm). */
export const CHART_HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

export function formatHourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return "12a";
  if (hour === 12) return "12p";
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
}
