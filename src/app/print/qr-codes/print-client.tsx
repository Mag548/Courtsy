"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { createClient } from "@/lib/supabase/client";
import { getCourtScanUrl } from "@/lib/court-qr";
import { Button } from "@/components/ui/button";
import { Loader2, Printer } from "lucide-react";
import type { Court } from "@/lib/supabase/types";

export default function PrintQrCodesClient() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const supabase = createClient();
    supabase
      .from("courts")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        setCourts(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="print:hidden sticky top-0 z-10 bg-zinc-900 text-white px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold">CourtQueue — Park QR Codes</p>
          <p className="text-xs text-zinc-400">
            {courts.length} parks · print and post at each location
          </p>
        </div>
        <Button
          onClick={() => window.print()}
          className="rounded-xl bg-green-600 hover:bg-green-700 text-white gap-2"
        >
          <Printer className="w-4 h-4" />
          Print all
        </Button>
      </div>

      <div className="p-4 print:p-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-0">
        {courts.map((court) => (
          <article
            key={court.id}
            className="qr-sheet border-2 border-zinc-200 rounded-2xl p-6 flex flex-col items-center text-center print:rounded-none print:border print:border-zinc-300 print:break-inside-avoid print:min-h-[100vh] print:justify-center print:page-break-after-always"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
                <span className="text-white text-xs font-black">CQ</span>
              </div>
              <span className="font-bold text-lg tracking-tight">CourtQueue</span>
            </div>

            <h1 className="text-2xl font-bold leading-tight mb-1">{court.name}</h1>
            {court.address && (
              <p className="text-sm text-zinc-600 mb-6 max-w-xs">{court.address}</p>
            )}

            <div className="bg-white p-4 rounded-xl border-2 border-zinc-100 shadow-sm mb-4">
              {origin && (
                <QRCode
                  value={getCourtScanUrl(court.id, origin)}
                  size={200}
                  style={{ display: "block" }}
                />
              )}
            </div>

            <p className="text-base font-semibold mb-1">Scan to join the queue</p>
            <p className="text-sm text-zinc-500 max-w-[240px]">
              Open CourtQueue, tap Scan, and point your camera at this sign.
            </p>

            <div className="mt-6 pt-4 border-t border-zinc-200 w-full text-xs text-zinc-400">
              {court.num_courts} court{court.num_courts !== 1 ? "s" : ""} ·{" "}
              {court.court_type === "both"
                ? "Tennis & Pickleball"
                : court.court_type.charAt(0).toUpperCase() + court.court_type.slice(1)}
            </div>
          </article>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 0.5in;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .qr-sheet:last-child {
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}
