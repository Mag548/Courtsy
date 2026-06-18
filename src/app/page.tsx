"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { CourtMap } from "@/components/map/court-map";
import { CourtCard } from "@/components/courts/court-card";
import { Navbar } from "@/components/layout/navbar";
import { PlacesSearch } from "@/components/map/places-search";
import { ActiveSessionsPanel } from "@/components/sessions/active-sessions-panel";
import { useCourts } from "@/hooks/use-courts";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import type { CourtWithQueue } from "@/lib/supabase/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  SlidersHorizontal,
  Loader2,
  RefreshCw,
  LocateFixed,
  Navigation,
  Timer,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

function getDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

export default function HomePage() {
  const { courts, loading, refetch } = useCourts();
  const { user } = useAuth();
  const supabase = createClient();

  const [selectedCourt, setSelectedCourt] = useState<CourtWithQueue | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "tennis" | "pickleball">("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"courts" | "active">("courts");
  const [activeCount, setActiveCount] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [directionsTarget, setDirectionsTarget] = useState<{ lat: number; lng: number; name: string } | null>(null);

  // Live count of user's active queue entries
  useEffect(() => {
    if (!user) { setActiveCount(0); return; }
    const fetchCount = async () => {
      // Sweep expired sessions first so count is accurate
      await supabase.rpc("expire_old_sessions");
      const { count } = await supabase
        .from("queue_entries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["waiting", "notified", "playing"]);
      setActiveCount(count ?? 0);
    };
    fetchCount();
    const channel = supabase
      .channel("active-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries" }, fetchCount)
      .on("postgres_changes", { event: "*", schema: "public", table: "court_sessions" }, fetchCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, supabase]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setMapCenter(loc);
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location. Check browser permissions.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const filteredAndSortedCourts = useMemo(() => {
    const filtered = courts.filter((court) => {
      const matchesSearch =
        search === "" ||
        court.name.toLowerCase().includes(search.toLowerCase()) ||
        court.address?.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        court.court_type === filter ||
        court.court_type === "both";
      return matchesSearch && matchesFilter;
    });

    if (userLocation) {
      return filtered
        .map((court) => ({
          ...court,
          _distance: getDistanceKm(
            userLocation.lat,
            userLocation.lng,
            court.latitude,
            court.longitude
          ),
        }))
        .sort((a, b) => a._distance - b._distance);
    }

    return filtered.map((court) => ({ ...court, _distance: undefined }));
  }, [courts, search, filter, userLocation]);

  const handleCourtSelect = (court: CourtWithQueue) => {
    setSelectedCourt(court);
    if (window.innerWidth < 768) setSidebarOpen(true);
  };

  const handlePlaceSelect = (loc: { lat: number; lng: number; name: string }) => {
    setMapCenter(loc);
    toast.success(`Showing courts near ${loc.name}`);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Navbar />

      <div className="flex flex-1 overflow-hidden gap-0 md:gap-3 md:px-3 md:pb-3">
        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? "w-full md:w-[26rem]" : "w-0"
          } flex-shrink-0 transition-all duration-300 overflow-hidden flex flex-col md:surface-elevated md:rounded-3xl bg-background md:bg-transparent absolute md:relative z-10 h-[calc(100vh-4rem)] md:h-full`}
        >
          {/* Tab bar — segmented pill control */}
          <div className="p-3 pb-2 shrink-0">
            <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
              <button
                onClick={() => { setSidebarTab("courts"); setSelectedCourt(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all ${
                  sidebarTab === "courts"
                    ? "bg-white/[0.08] text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                Courts
              </button>
              <button
                onClick={() => { setSidebarTab("active"); setSelectedCourt(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all ${
                  sidebarTab === "active"
                    ? "bg-white/[0.08] text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Timer className="w-3.5 h-3.5" />
                Active
                {activeCount > 0 && (
                  <span className="min-w-4 h-4 px-1 rounded-full gradient-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                    {activeCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {sidebarTab === "active" ? (
            <div className="flex-1 overflow-y-auto">
              <ActiveSessionsPanel />
            </div>
          ) : (
            <>
              {/* Search & Filter — only in Courts tab */}
              <div className="px-3 pb-3 space-y-2.5 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search courts by name…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-11 rounded-2xl bg-white/[0.04] border-white/[0.06]"
                  />
                </div>
                <PlacesSearch onLocationSelect={handlePlaceSelect} />
                <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                  {(["all", "tennis", "pickleball"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-medium transition-all ${
                        filter === f
                          ? "bg-white/[0.08] text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f === "all" ? "All" : f === "tennis" ? "🎾 Tennis" : "🏓 Pickleball"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Court list or selected card */}
              <div className="flex-1 overflow-y-auto">
                {selectedCourt ? (
                  <div className="p-4">
                    <CourtCard
                      court={
                        filteredAndSortedCourts.find((c) => c.id === selectedCourt.id) ??
                        selectedCourt
                      }
                      onClose={() => setSelectedCourt(null)}
                      onDirections={(lat, lng, name) => setDirectionsTarget({ lat, lng, name })}
                    />
                  </div>
                ) : (
                  <div className="p-3 pt-1 space-y-2.5">
                    <div className="flex items-center justify-between px-1.5">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        {userLocation && (
                          <Navigation className="w-3 h-3 text-primary" />
                        )}
                        {filteredAndSortedCourts.length} courts
                        {userLocation ? " nearby" : " found"}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={refetch}
                        className="h-7 text-xs rounded-lg"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Refresh
                      </Button>
                    </div>

                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      filteredAndSortedCourts.map((court, i) => {
                        const queueLen =
                          court.queue?.queue_entries?.filter(
                            (e) => e.status === "waiting"
                          ).length ?? 0;
                        const dist = (court as typeof court & { _distance?: number })._distance;

                        return (
                          <button
                            key={court.id}
                            onClick={() => handleCourtSelect(court)}
                            style={{ animationDelay: `${Math.min(i * 35, 350)}ms` }}
                            className="fade-in-up lift w-full text-left p-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] group"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0 pr-2">
                                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                                  {court.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {court.address}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <Badge
                                  variant="outline"
                                  className={`text-xs rounded-lg ${
                                    court.court_type === "tennis"
                                      ? "border-green-500/30 text-green-400 bg-green-500/10"
                                      : court.court_type === "pickleball"
                                      ? "border-blue-500/30 text-blue-400 bg-blue-500/10"
                                      : "border-purple-500/30 text-purple-400 bg-purple-500/10"
                                  }`}
                                >
                                  {court.court_type === "both"
                                    ? "T/P"
                                    : court.court_type === "tennis"
                                    ? "🎾"
                                    : "🏓"}
                                </Badge>
                                {dist !== undefined && (
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {formatDistance(dist)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                                {court.num_courts} courts
                              </span>
                              <span
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${
                                  queueLen > 0
                                    ? "bg-primary/15 text-primary font-medium"
                                    : "bg-white/[0.04] text-muted-foreground"
                                }`}
                              >
                                {queueLen === 0 ? "No queue" : `${queueLen} waiting`}
                              </span>
                              {court.active_session && (
                                <span className="text-orange-400 flex items-center gap-1 ml-auto">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 pulse-green" />
                                  Active
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 md:rounded-3xl overflow-hidden md:ring-1 md:ring-white/[0.06] md:shadow-2xl">
            <CourtMap
              courts={filteredAndSortedCourts}
              selectedCourt={selectedCourt}
              onCourtSelect={handleCourtSelect}
              userLocation={userLocation}
              mapCenter={mapCenter}
              directionsTarget={directionsTarget}
              onDirectionsClear={() => setDirectionsTarget(null)}
            />
          </div>

          {/* Toggle sidebar on mobile */}
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-4 left-4 md:hidden shadow-xl z-20 h-11 w-11 rounded-2xl border border-white/10 backdrop-blur-xl bg-black/60"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </Button>

          {/* Locate me button */}
          <Button
            variant="secondary"
            size="icon"
            className="absolute bottom-6 right-6 shadow-xl z-20 h-12 w-12 rounded-2xl border border-white/10 backdrop-blur-xl bg-black/60 hover:bg-black/80"
            onClick={() => {
              requestLocation();
              if (userLocation) toast.success("Map centered on your location.");
            }}
            disabled={locating}
            title="Center map on my location"
          >
            {locating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LocateFixed className={`w-5 h-5 ${userLocation ? "text-primary" : ""}`} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
