"use client";

import Link from "next/link";
import { ArrowLeft, QrCode } from "lucide-react";
import { QrScanner } from "@/components/qr/qr-scanner";

export default function ScanPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-background/95 backdrop-blur-xl">
        <Link
          href="/app"
          aria-label="Back to map"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl shrink-0 hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <QrCode className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight">Scan court sign</h1>
            <p className="text-xs text-muted-foreground truncate">
              Hold it up to the QR code on the CourtQueue sign by the court
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-w-md mx-auto w-full">
        <QrScanner />
      </div>
    </div>
  );
}
