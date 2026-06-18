"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { CourtMap } from "@/components/map/court-map";
import { CourtCard } from "@/components/courts/court-card";
import { Navbar } from "@/components/layout/navbar";
import { PlacesSearch } from "@/components/map/places-search";
import { ActiveSessionsPanel } from "@/components/sessions/active-sessions-panel";
import { AuthModal } from "@/components/auth/auth-modal";
import { useCourts } from "@/hooks/use-courts";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import type { CourtWithQueue } from "@/lib/supabase/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Map,
  User,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
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
function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { courts, loading, refetch } = useCourts();
  const { user, profile } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  // Shared state
  const [selectedCourt, setSelectedCourt] = useState<CourtWithQueue | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "tennis" | "pickleball">("all");
  const [activeCount, setActiveCount] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [directionsTarget, setDirectionsTarget] = useState<{ lat: number; lng: number; name: string } | null>(null);

  // Desktop sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"courts" | "active">("courts");

  // Mobile state
  const [mobileTab, setMobileTab] = useState<"map" | "courts" | "active" | "account">("courts");
  const [mobileSheet, setMobileSheet] = useState<"hidden" | "peek" | "open">("peek");
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Drag gesture state for bottom sheet
  const dragStartY = useRef<number | null>(null);
  const dragStartSheet = useRef<"hidden" | "peek" | "open">("peek");

  // ── Active count ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setActiveCount(0); return; }
    const fetchCount = async () => {
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

  // ── Geolocation ───────────────────────────────────────────────────────────
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

  useEffect(() => { requestLocation(); }, [requestLocation]);

  // ── Filtered courts ───────────────────────────────────────────────────────
  const filteredAndSortedCourts = useMemo(() => {
    const filtered = courts.filter((court) => {
      const matchesSearch =
        search === "" ||
        court.name.toLowerCase().includes(search.toLowerCase()) ||
        court.address?.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "all" || court.court_type === filter || court.court_type === "both";
      return matchesSearch && matchesFilter;
    });
    if (userLocation) {
      return filtered
        .map((c) => ({ ...c, _distance: getDistanceKm(userLocation.lat, userLocation.lng, c.latitude, c.longitude) }))
        .sort((a, b) => a._distance - b._distance);
    }
    return filtered.map((c) => ({ ...c, _distance: undefined }));
  }, [courts, search, filter, userLocation]);

  // ── Court select ──────────────────────────────────────────────────────────
  const handleCourtSelect = (court: CourtWithQueue) => {
    setSelectedCourt(court);
    if (window.innerWidth < 768) {
      setMobileTab("courts");
      setMobileSheet("open");
    } else {
      setSidebarOpen(true);
    }
  };

  const handlePlaceSelect = (loc: { lat: number; lng: number; name: string }) => {
    setMapCenter(loc);
    toast.success(`Showing courts near ${loc.name}`);
  };

  // ── Mobile tab handler ────────────────────────────────────────────────────
  const handleMobileTab = (tab: typeof mobileTab) => {
    if (tab === "account") {
      if (user) router.push("/profile");
      else setAuthModalOpen(true);
      return;
    }
    if (tab === "map") {
      setMobileSheet("hidden");
      setMobileTab("map");
      setSelectedCourt(null);
      return;
    }
    setMobileTab(tab);
    setMobileSheet((prev) => (prev === "hidden" ? "peek" : prev));
  };

  // Auto-open sheet when court is selected on mobile
  useEffect(() => {
    if (selectedCourt && typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileSheet("open");
    }
  }, [selectedCourt]);

  // Restore sensible mobile state after sign-in (e.g. Google OAuth redirect)
  useEffect(() => {
    if (user && typeof window !== "undefined" && window.innerWidth < 768) {
      if (mobileTab === "map") return; // user intentionally on map view
      setMobileTab("courts");
      setMobileSheet((s) => (s === "hidden" ? "peek" : s));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Prevent iOS Safari from scrolling the page behind the mobile map
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    document.body.classList.add("map-app-active");
    return () => { document.body.classList.remove("map-app-active"); };
  }, []);

  // ── Court list (shared by desktop sidebar + mobile sheet) ─────────────────
  const CourtList = () => (
    <div className="space-y-2.5 px-3 pb-4">
      <div className="flex items-center justify-between px-0.5 mb-1">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          {userLocation && <Navigation className="w-3 h-3 text-primary" />}
          {filteredAndSortedCourts.length} courts{userLocation ? " nearby" : " found"}
        </p>
        <Button variant="ghost" size="sm" onClick={refetch} className="h-7 text-xs rounded-lg">
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
          const queueLen = court.queue?.queue_entries?.filter((e) => e.status === "waiting").length ?? 0;
          const dist = (court as typeof court & { _distance?: number })._distance;
          return (
            <button
              key={court.id}
              onClick={() => handleCourtSelect(court)}
              style={{ animationDelay: `${Math.min(i * 35, 350)}ms` }}
              className="fade-in-up lift w-full text-left p-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] active:scale-[0.98] group transition-transform"
            >
              <div className="flex items-start justify-between mb-2.5">
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
                    {court.court_type === "both" ? "T/P" : court.court_type === "tennis" ? "🎾" : "🏓"}
                  </Badge>
                  {dist !== undefined && (
                    <span className="text-xs text-muted-foreground font-mono">{formatDistance(dist)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                  {court.num_courts} courts
                </span>
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${
                  queueLen > 0 ? "bg-primary/15 text-primary font-medium" : "bg-white/[0.04] text-muted-foreground"
                }`}>
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
  );

  // ── Search + filter controls (shared) ─────────────────────────────────────
  const SearchControls = () => (
    <div className="px-3 pb-3 space-y-2 shrink-0">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search courts…"
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
  );

  // ── Shared map ────────────────────────────────────────────────────────────
  const mapEl = (
    <CourtMap
      courts={filteredAndSortedCourts}
      selectedCourt={selectedCourt}
      onCourtSelect={handleCourtSelect}
      userLocation={userLocation}
      mapCenter={mapCenter}
      directionsTarget={directionsTarget}
      onDirectionsClear={() => setDirectionsTarget(null)}
    />
  );

  return (
    <div className="h-screen bg-background overflow-hidden">

      {/* ═══════════════════════════════════════════════════════
          DESKTOP LAYOUT  (md and up — unchanged)
      ═══════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col h-full">
        <Navbar />
        <div className="flex flex-1 overflow-hidden gap-3 px-3 pb-3">
          {/* Sidebar */}
          <div className={`${sidebarOpen ? "w-[26rem]" : "w-0"} flex-shrink-0 transition-all duration-300 overflow-hidden flex flex-col surface-elevated rounded-3xl`}>
            {/* Tab bar */}
            <div className="p-3 pb-2 shrink-0">
              <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                <button
                  onClick={() => { setSidebarTab("courts"); setSelectedCourt(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all ${
                    sidebarTab === "courts" ? "bg-white/[0.08] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />Courts
                </button>
                <button
                  onClick={() => { setSidebarTab("active"); setSelectedCourt(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all ${
                    sidebarTab === "active" ? "bg-white/[0.08] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Timer className="w-3.5 h-3.5" />Active
                  {activeCount > 0 && (
                    <span className="min-w-4 h-4 px-1 rounded-full gradient-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                      {activeCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {sidebarTab === "active" ? (
              <div className="flex-1 overflow-y-auto"><ActiveSessionsPanel /></div>
            ) : (
              <>
                <SearchControls />
                <div className="flex-1 overflow-y-auto">
                  {selectedCourt ? (
                    <div className="p-4">
                      <CourtCard
                        court={filteredAndSortedCourts.find((c) => c.id === selectedCourt.id) ?? selectedCourt}
                        onClose={() => setSelectedCourt(null)}
                        onDirections={(lat, lng, name) => setDirectionsTarget({ lat, lng, name })}
                      />
                    </div>
                  ) : (
                    <div className="pt-1"><CourtList /></div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            <div className="absolute inset-0 rounded-3xl overflow-hidden ring-1 ring-white/[0.06] shadow-2xl">
              {mapEl}
            </div>
            <Button
              variant="secondary"
              size="icon"
              className="absolute bottom-6 right-6 shadow-xl z-20 h-12 w-12 rounded-2xl border border-white/10 backdrop-blur-xl bg-black/60 hover:bg-black/80"
              onClick={() => { requestLocation(); if (userLocation) toast.success("Map centered on your location."); }}
              disabled={locating}
            >
              {locating ? <Loader2 className="w-5 h-5 animate-spin" /> : <LocateFixed className={`w-5 h-5 ${userLocation ? "text-primary" : ""}`} />}
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MOBILE LAYOUT  (below md)
      ═══════════════════════════════════════════════════════ */}
      <div className="md:hidden fixed inset-0 overflow-hidden" style={{ zIndex: 1 }}>

        {/* ── Full-screen map ── */}
        <div className="absolute inset-0 z-0" style={{ touchAction: "pan-x pan-y" }}>{mapEl}</div>

        {/* ── Floating top bar ── */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-4 pb-2 pointer-events-none">
          {/* Brand pill */}
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl px-3 py-2 pointer-events-auto shadow-lg">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-xs font-black text-primary-foreground">CQ</span>
            </div>
            <span className="font-bold text-sm tracking-tight gradient-text">CourtQueue</span>
          </div>

          {/* Locate button */}
          <button
            onClick={() => { requestLocation(); if (userLocation) toast.success("Centered on your location."); }}
            disabled={locating}
            className="pointer-events-auto h-11 w-11 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            {locating
              ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              : <LocateFixed className={`w-5 h-5 ${userLocation ? "text-primary" : "text-foreground"}`} />
            }
          </button>
        </div>

        {/* ── Bottom sheet ── */}
        <div
          className="mobile-sheet absolute left-0 right-0 z-30 flex flex-col"
          style={{
            bottom: "var(--mobile-nav-h)",
            height: "calc(100% - var(--mobile-nav-h))",
            transform:
              mobileSheet === "open"
                ? "translateY(0)"
                : mobileSheet === "peek"
                ? "translateY(calc(100% - 260px))"
                : "translateY(100%)",
            transition: "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* Sheet surface */}
          <div className="flex flex-col h-full rounded-t-3xl border border-white/[0.08] border-b-0 bg-[hsl(0_0%_7%/0.97)] backdrop-blur-2xl shadow-[0_-20px_60px_-20px_hsl(0_0%_0%/0.7)]">
            {/* Drag handle */}
            <button
              className="flex-shrink-0 flex flex-col items-center gap-2 pt-3 pb-2 px-4"
              onClick={() => setMobileSheet((s) => (s === "open" ? "peek" : "open"))}
              onTouchStart={(e) => {
                dragStartY.current = e.touches[0].clientY;
                dragStartSheet.current = mobileSheet;
              }}
              onTouchEnd={(e) => {
                if (dragStartY.current === null) return;
                const dy = dragStartY.current - e.changedTouches[0].clientY;
                if (Math.abs(dy) < 30) return; // tap, not swipe
                if (dy > 0) {
                  // swiped up → open
                  setMobileSheet("open");
                } else {
                  // swiped down → peek or hidden
                  setMobileSheet(dragStartSheet.current === "open" ? "peek" : "hidden");
                }
                dragStartY.current = null;
              }}
            >
              <div className="w-10 h-1 rounded-full bg-white/20" />
              {/* Sheet header */}
              <div className="flex items-center justify-between w-full mt-0.5">
                <h2 className="text-base font-semibold">
                  {mobileTab === "courts"
                    ? selectedCourt
                      ? selectedCourt.name
                      : "Nearby Courts"
                    : "Active Sessions"}
                </h2>
                {mobileSheet === "open"
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {/* Sheet content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {mobileTab === "active" ? (
                <ActiveSessionsPanel />
              ) : selectedCourt ? (
                <div className="px-3 pb-6">
                  <button
                    onClick={() => { setSelectedCourt(null); setMobileSheet("peek"); }}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3 hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to list
                  </button>
                  <CourtCard
                    court={filteredAndSortedCourts.find((c) => c.id === selectedCourt.id) ?? selectedCourt}
                    onClose={() => { setSelectedCourt(null); setMobileSheet("peek"); }}
                    onDirections={(lat, lng, name) => {
                      setDirectionsTarget({ lat, lng, name });
                      setMobileSheet("hidden");
                      setMobileTab("map");
                    }}
                  />
                </div>
              ) : (
                <>
                  <SearchControls />
                  <CourtList />
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom navigation bar ── */}
        <div
          className="absolute bottom-0 left-0 right-0 z-40 flex items-center border-t border-white/[0.07] bg-[hsl(0_0%_5%/0.97)] backdrop-blur-2xl"
          style={{ height: "var(--mobile-nav-h)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {(
            [
              { id: "map"     as const, icon: Map,   label: "Map",     badge: 0 },
              { id: "courts"  as const, icon: MapPin, label: "Courts",  badge: 0 },
              { id: "active"  as const, icon: Timer,  label: "Active",  badge: activeCount },
              { id: "account" as const, icon: User,   label: "Account", badge: 0 },
            ]
          ).map(({ id, icon: Icon, label, badge }) => {
            const isActive =
              id === "account"
                ? false
                : mobileTab === id;
            return (
              <button
                key={id}
                onClick={() => handleMobileTab(id)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 relative active:scale-95 transition-transform"
              >
                <div className={`relative flex items-center justify-center w-10 h-7 rounded-2xl transition-all ${
                  isActive ? "gradient-primary shadow-md shadow-primary/30" : ""
                }`}>
                  <Icon className={`w-5 h-5 transition-colors ${
                    isActive ? "text-primary-foreground" : "text-muted-foreground"
                  }`} />
                  {"badge" in { badge } && badge && badge > 0 ? (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {badge}
                    </span>
                  ) : null}
                </div>
                <span className={`text-[10px] font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}>
                  {id === "account"
                    ? user
                      ? (profile?.full_name?.split(" ")[0] ?? "Account")
                      : "Sign In"
                    : label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Auth modal for mobile account tab */}
        <AuthModal
          open={authModalOpen}
          onOpenChange={setAuthModalOpen}
          onSuccess={() => setAuthModalOpen(false)}
        />
      </div>
    </div>
  );
}
