"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { CourtMap } from "@/components/map/court-map";
import { CourtCard } from "@/components/courts/court-card";
import { CourtListCard } from "@/components/courts/court-list-card";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav, type BottomNavTab } from "@/components/layout/bottom-nav";
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
import {
  Search,
  SlidersHorizontal,
  Loader2,
  RefreshCw,
  LocateFixed,
  Navigation,
  Timer,
  MapPin,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { consumeMobileOAuthState, MOBILE_OAUTH_KEY } from "@/lib/mobile-oauth";
import { cn } from "@/lib/utils";

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
  // Start as `true` (mobile) — safe SSR default; effect corrects for desktop.
  // After Google OAuth the sessionStorage key forces mobile so there's never
  // a moment where the desktop layout briefly mounts on a phone.
  const [showMobile, setShowMobile] = useState(() => {
    if (typeof window === "undefined") return true; // SSR
    if (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem(MOBILE_OAUTH_KEY)) return true; // OAuth return
    return window.innerWidth < 768;
  });

  // Drag gesture state for bottom sheet
  const dragStartY = useRef<number | null>(null);
  const dragStartSheet = useRef<"hidden" | "peek" | "open">("peek");
  const didSwipeSheet = useRef(false);

  // Peek sheet slides down while the map is touched, then eases back to peek
  const [mapSheetDismissed, setMapSheetDismissed] = useState(false);
  const [sheetMotion, setSheetMotion] = useState<"default" | "map-push" | "map-restore">("default");
  const mapTouchCount = useRef(0);
  const mapRestoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapTouchOrigin = useRef<{ x: number; y: number } | null>(null);
  const mapGestureActive = useRef(false);

  const clearMapRestoreTimer = useCallback(() => {
    if (mapRestoreTimer.current) {
      clearTimeout(mapRestoreTimer.current);
      mapRestoreTimer.current = null;
    }
  }, []);

  const dismissSheetForMap = useCallback(() => {
    if (mapGestureActive.current) return;
    mapGestureActive.current = true;
    clearMapRestoreTimer();
    setSheetMotion("map-push");
    setMapSheetDismissed(true);
  }, [clearMapRestoreTimer]);

  const handleMapTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (mobileSheet !== "peek") return;
      mapTouchCount.current += 1;
      if (event.touches.length === 1 && !mapTouchOrigin.current) {
        mapTouchOrigin.current = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
      }
      if (event.touches.length >= 2) dismissSheetForMap();
    },
    [mobileSheet, dismissSheetForMap]
  );

  const handleMapTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (mobileSheet !== "peek" || mapGestureActive.current) return;
      if (event.touches.length >= 2) {
        dismissSheetForMap();
        return;
      }
      const origin = mapTouchOrigin.current;
      if (!origin) return;
      const touch = event.touches[0];
      const moved = Math.hypot(
        touch.clientX - origin.x,
        touch.clientY - origin.y
      );
      if (moved >= 10) dismissSheetForMap();
    },
    [mobileSheet, dismissSheetForMap]
  );

  const handleMapTouchEnd = useCallback(() => {
    if (mobileSheet !== "peek") return;
    mapTouchCount.current = Math.max(0, mapTouchCount.current - 1);
    if (mapTouchCount.current !== 0) return;

    mapTouchOrigin.current = null;
    if (!mapGestureActive.current) return;
    mapGestureActive.current = false;

    clearMapRestoreTimer();
    mapRestoreTimer.current = setTimeout(() => {
      setSheetMotion("map-restore");
      setMapSheetDismissed(false);
      mapRestoreTimer.current = null;
    }, 750);
  }, [mobileSheet, clearMapRestoreTimer]);

  useEffect(() => {
    if (mobileSheet !== "peek") {
      setMapSheetDismissed(false);
      setSheetMotion("default");
      mapTouchCount.current = 0;
      mapTouchOrigin.current = null;
      mapGestureActive.current = false;
      clearMapRestoreTimer();
    }
  }, [mobileSheet, clearMapRestoreTimer]);

  useEffect(() => () => clearMapRestoreTimer(), [clearMapRestoreTimer]);

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
    if (showMobile) {
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

  const handleBottomNav = (tab: BottomNavTab) => {
    if (tab === "scan") {
      router.push("/scan");
      return;
    }
    if (tab === "activity") {
      router.push("/profile?tab=history");
      return;
    }
    if (tab === "settings") {
      if (user) router.push("/profile?tab=settings");
      else setAuthModalOpen(true);
      return;
    }
    if (tab === "queue") {
      setMobileTab("active");
      setMobileSheet("open");
      setSelectedCourt(null);
      return;
    }
    setMobileTab("courts");
    setMobileSheet((s) => (s === "hidden" ? "peek" : s));
    setSelectedCourt(null);
  };

  const bottomNavActive: BottomNavTab =
    mobileTab === "active" ? "queue" : "courts";

  // Auto-open sheet when court is selected on mobile
  // Auto-open sheet when a court is selected on mobile
  useEffect(() => {
    if (selectedCourt && showMobile) setMobileSheet("open");
  }, [selectedCourt, showMobile]);

  // ── Layout detection + OAuth restore ──────────────────────────────────────
  // Runs once on mount: corrects layout for desktop, restores state after OAuth.
  useEffect(() => {
    // Sync viewport (corrects desktop users from the mobile SSR default)
    const mobile = window.innerWidth < 768;
    setShowMobile(mobile);

    // Restore tab/sheet after Google OAuth redirect
    const saved = consumeMobileOAuthState();
    if (saved) {
      setMobileTab(saved.tab);
      setMobileSheet(saved.sheet === "hidden" ? "peek" : saved.sheet);
      setAuthModalOpen(false);
    }

    // Keep the correct layout when window is resized (e.g. DevTools)
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => setShowMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close auth modal and reset sheet on email sign-in (no redirect involved)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" || window.innerWidth >= 768) return;
      setAuthModalOpen(false);
      setMobileTab((t) => (t === "map" ? "map" : "courts"));
      setMobileSheet((s) => (s === "hidden" ? "peek" : s));
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // ── Court list (shared by desktop sidebar + mobile sheet) ─────────────────
  const CourtList = () => (
    <div className="space-y-4 px-container-padding pb-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold text-primary">Nearby Courts</h2>
          <p className="text-sm text-on-surface-variant">
            {filteredAndSortedCourts.length} parks
            {userLocation ? " within range" : " found"}
          </p>
        </div>
        <button
          type="button"
          onClick={refetch}
          className="p-2 bg-white/5 border border-white/10 rounded-full text-on-surface-variant hover:text-primary transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-on-surface-variant" />
        </div>
      ) : (
        filteredAndSortedCourts.map((court) => {
          const dist = (court as typeof court & { _distance?: number })._distance;
          return (
            <CourtListCard
              key={court.id}
              court={court}
              distanceLabel={
                dist !== undefined ? `${formatDistance(dist)} away` : undefined
              }
              onClick={() => handleCourtSelect(court)}
            />
          );
        })
      )}
    </div>
  );

  // ── Search + filter controls (desktop sidebar) ───────────────────────────
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

  const MobileSheetFilters = () => (
    <div className="px-3 pb-3 space-y-2 shrink-0">
      <PlacesSearch onLocationSelect={handlePlaceSelect} />
      <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
        {(["all", "tennis", "pickleball"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
              filter === f
                ? "bg-white/[0.08] text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "All" : f === "tennis" ? "🎾" : "🏓"}
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

      {/* Only mount ONE layout — prevents desktop sidebar bleeding onto mobile after OAuth */}
      {!showMobile ? (
      <div className="flex flex-col h-full bg-background">
        <AppHeader
          showSearch
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          showSportToggle
          variant="inline"
          className="mx-5 mt-4 mb-2"
        />
        <div className="flex flex-1 overflow-hidden gap-3 px-3 pb-3 pt-2">
          {/* Sidebar */}
          <div className={`${sidebarOpen ? "w-[26rem]" : "w-0"} flex-shrink-0 transition-all duration-300 overflow-hidden flex flex-col glass-panel rounded-3xl`}>
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
      ) : (
      <div
        className="fixed inset-0 overflow-hidden"
        style={{
          ["--mobile-header-h" as string]:
            mobileSheet === "open"
              ? "max(0.75rem, env(safe-area-inset-top, 0px))"
              : "calc(5.75rem + env(safe-area-inset-top, 0px))",
        }}
      >

        {/* ── Map (clipped above bottom nav zone) ── */}
        <div
          className="absolute inset-x-0 top-0 z-0 bg-background touch-none"
          style={{ bottom: "var(--mobile-nav-h)" }}
          onTouchStart={handleMapTouchStart}
          onTouchMove={handleMapTouchMove}
          onTouchEnd={handleMapTouchEnd}
          onTouchCancel={handleMapTouchEnd}
        >
          {mapEl}
        </div>

        {/* ── Header ── */}
        <AppHeader
          showSearch
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          showSportToggle
          dismissed={mobileSheet === "open"}
        />

        {/* ── Locate FAB ── */}
        <button
          type="button"
          onClick={() => { requestLocation(); if (userLocation) toast.success("Centered on your location."); }}
          disabled={locating}
          className={cn(
            "absolute right-5 z-20 h-11 w-11 rounded-full border border-white/10 bg-surface/80 backdrop-blur-xl flex items-center justify-center shadow-lg active:scale-95 transition-all duration-500",
            mobileSheet === "open"
              ? "opacity-0 pointer-events-none top-5"
              : "opacity-100"
          )}
          style={
            mobileSheet === "open"
              ? undefined
              : { top: "calc(var(--mobile-header-h) + 0.5rem)" }
          }
        >
          {locating
            ? <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" />
            : <LocateFixed className={`w-5 h-5 ${userLocation ? "text-primary-fixed" : "text-on-surface"}`} />
          }
        </button>

        {/* ── Bottom sheet (pointer-events-none shell so map stays draggable in peek) ── */}
        <div
          className="mobile-sheet absolute left-0 right-0 z-30 flex flex-col justify-end max-w-2xl mx-auto pointer-events-none"
          style={{
            top: "var(--mobile-header-h)",
            bottom: "var(--mobile-nav-h)",
          }}
        >
          <div
            className={cn(
              "pointer-events-auto flex flex-col rounded-t-[24px] border border-white/10 border-b-0 bg-surface-container-lowest/95 backdrop-blur-3xl shadow-[0_-20px_40px_rgba(0,0,0,0.5)] overflow-hidden",
              sheetMotion === "map-push"
                ? "bottom-sheet-map-push"
                : sheetMotion === "map-restore"
                ? "bottom-sheet-map-restore"
                : "bottom-sheet-transition"
            )}
            style={{
              height: mobileSheet === "open" ? "100%" : "200px",
              transform:
                mobileSheet === "hidden" ||
                (mobileSheet === "peek" && mapSheetDismissed)
                  ? "translateY(100%)"
                  : "translateY(0)",
            }}
            onTransitionEnd={(event) => {
              if (event.propertyName !== "transform") return;
              if (!mapSheetDismissed && sheetMotion === "map-restore") {
                setSheetMotion("default");
              }
            }}
          >
            {/* Drag handle — large touch target, stays below app header */}
            <button
              type="button"
              aria-expanded={mobileSheet === "open"}
              aria-label={
                mobileSheet === "open"
                  ? "Collapse court list"
                  : "Expand court list"
              }
              className="flex-shrink-0 flex flex-col items-center gap-2 pt-4 pb-3 px-4 w-full touch-manipulation cursor-grab active:cursor-grabbing"
              onClick={() => {
                if (didSwipeSheet.current) {
                  didSwipeSheet.current = false;
                  return;
                }
                setMobileSheet((s) => (s === "open" ? "peek" : "open"));
              }}
              onTouchStart={(e) => {
                dragStartY.current = e.touches[0].clientY;
                dragStartSheet.current = mobileSheet;
              }}
              onTouchEnd={(e) => {
                if (dragStartY.current === null) return;
                const dy = dragStartY.current - e.changedTouches[0].clientY;
                dragStartY.current = null;
                if (Math.abs(dy) < 40) return;
                didSwipeSheet.current = true;
                if (dy > 0) {
                  setMobileSheet("open");
                } else {
                  setMobileSheet(
                    dragStartSheet.current === "open" ? "peek" : "hidden"
                  );
                }
              }}
            >
              <div className="w-12 h-1.5 rounded-full bg-white/20" />
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
            <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-hide pb-8">
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
                  <MobileSheetFilters />
                  <CourtList />
                </>
              )}
            </div>
          </div>
        </div>

        <BottomNav
          active={bottomNavActive}
          onTabChange={handleBottomNav}
          queueBadge={activeCount}
        />
      </div>
      )}

      {/* Auth modal at page root — survives Google OAuth full-page redirect */}
      <AuthModal
        open={authModalOpen}
        mobileReturn={{
          tab: mobileTab === "account" ? "courts" : mobileTab,
          sheet: mobileSheet,
        }}
        onOpenChange={(open) => {
          setAuthModalOpen(open);
          if (!open && showMobile) {
            requestAnimationFrame(() => {
              setMobileTab((t) => (t === "map" ? "map" : "courts"));
              setMobileSheet((s) => (s === "hidden" ? "peek" : s));
            });
          }
        }}
        onSuccess={() => setAuthModalOpen(false)}
      />
    </div>
  );
}
