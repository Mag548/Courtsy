"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildHourlyActivity,
  getRecentReportedOccupancy,
  type TrafficReport,
} from "@/lib/court-traffic";

export function useCourtTraffic(courtId: string) {
  const [reports, setReports] = useState<TrafficReport[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchReports = useCallback(async () => {
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data } = await supabase
      .from("court_traffic_reports")
      .select("occupied_courts, reported_at")
      .eq("court_id", courtId)
      .gt("reported_at", sevenDaysAgo)
      .order("reported_at", { ascending: false });

    setReports(data ?? []);
    setLoading(false);
  }, [courtId, supabase]);

  useEffect(() => {
    fetchReports();

    const channel = supabase
      .channel(`traffic-${courtId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "court_traffic_reports",
          filter: `court_id=eq.${courtId}`,
        },
        () => fetchReports()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courtId, supabase, fetchReports]);

  const recentOccupied = useMemo(
    () => getRecentReportedOccupancy(reports),
    [reports]
  );

  const hourlyActivity = useMemo(
    () => buildHourlyActivity(reports),
    [reports]
  );

  return {
    reports,
    recentOccupied,
    hourlyActivity,
    totalReports: reports.length,
    loading,
    refetch: fetchReports,
  };
}
