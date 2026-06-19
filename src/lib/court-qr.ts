/** Build the URL encoded in park signage QR codes. */
export function getCourtScanUrl(courtId: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/court/${courtId}`;
}

/** Extract court id from a scanned QR payload (full URL or path). */
export function parseCourtIdFromScan(text: string): string | null {
  const trimmed = text.trim();
  const match = trimmed.match(/\/court\/([0-9a-f-]{36})/i);
  return match?.[1] ?? null;
}
