"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { parseCourtIdFromScan } from "@/lib/court-qr";

const SCANNER_ID_PREFIX = "courtqueue-qr-scanner";

interface QrScannerProps {
  onScan?: (courtId: string) => void;
  className?: string;
}

export function QrScanner({ onScan, className }: QrScannerProps) {
  const router = useRouter();
  const scannerId = useId().replace(/:/g, "");
  const elementId = `${SCANNER_ID_PREFIX}-${scannerId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handledRef.current = false;
    setError(null);
    setStarting(true);

    let cancelled = false;

    const start = () => {
      if (cancelled) return;

      const scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          (decoded) => {
            if (handledRef.current) return;
            const courtId = parseCourtIdFromScan(decoded);
            if (!courtId) {
              toast.error("That QR code isn't for a CourtQueue court.");
              return;
            }
            handledRef.current = true;
            scanner
              .stop()
              .then(() => scanner.clear())
              .catch(() => {});
            if (onScan) {
              onScan(courtId);
            } else {
              router.push(`/court/${courtId}`);
            }
          },
          () => {}
        )
        .catch((err: unknown) => {
          const msg =
            err instanceof Error ? err.message : "Camera access denied";
          setError(msg);
        })
        .finally(() => setStarting(false));
    };

    const frame = requestAnimationFrame(start);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      const s = scannerRef.current;
      scannerRef.current = null;
      if (!s) return;
      s.stop()
        .then(() => s.clear())
        .catch(() => {});
    };
  }, [onScan, router, elementId]);

  return (
    <div className={className}>
      <div className="relative bg-black min-h-[min(70vh,520px)] flex items-center justify-center rounded-3xl overflow-hidden border border-white/[0.08]">
        <div id={elementId} className="w-full" />

        {starting && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Starting camera…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 bg-black/90 text-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">
              Allow camera access in your browser settings and reload this page.
            </p>
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground justify-center">
        <Camera className="w-3.5 h-3.5 shrink-0 text-primary" />
        Point at the QR code on the park sign to check in
      </div>
    </div>
  );
}
