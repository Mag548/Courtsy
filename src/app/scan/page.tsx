"use client";

import { QrScanner } from "@/components/qr/qr-scanner";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function ScanPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col pb-[var(--mobile-nav-h)]">
      <AppHeader />

      <div className="flex-1 flex flex-col items-center justify-center px-container-padding pt-28 max-w-md mx-auto w-full">
        <div className="w-full mb-6 text-center">
          <h1 className="text-xl font-semibold text-primary">Scan court sign</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Point your camera at the QR code on the CourtQueue sign by the court
          </p>
        </div>
        <QrScanner />
      </div>

      <BottomNav active="scan" />
    </div>
  );
}
