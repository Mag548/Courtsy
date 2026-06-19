import { isSessionActive } from "@/lib/court-availability";
import type { CourtSession } from "@/lib/supabase/types";

export type CourtSlotStatus = "open" | "busy";

export type CourtSlot = {
  number: number;
  status: CourtSlotStatus;
  minutesLeft?: number;
};

export function getCourtSlots(
  numCourts: number,
  activeSessions: CourtSession[]
): CourtSlot[] {
  const slots: CourtSlot[] = [];

  for (let n = 1; n <= numCourts; n++) {
    const session = activeSessions.find(
      (s) => s.court_number === n && isSessionActive(s)
    );

    if (!session) {
      slots.push({ number: n, status: "open" });
      continue;
    }

    if (!session.expires_at) {
      slots.push({ number: n, status: "open" });
      continue;
    }

    const diff = new Date(session.expires_at).getTime() - Date.now();
    const minutesLeft = Math.max(1, Math.ceil(diff / 60000));
    slots.push({ number: n, status: "busy", minutesLeft });
  }

  return slots;
}
