"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import type { CourtWithQueue } from "@/lib/supabase/types";
import {
  getAvailableCourts,
  formatAvailableCourts,
} from "@/lib/court-availability";

interface CourtMapProps {
  courts: CourtWithQueue[];
  selectedCourt: CourtWithQueue | null;
  onCourtSelect: (court: CourtWithQueue) => void;
  userLocation?: { lat: number; lng: number } | null;
  mapCenter?: { lat: number; lng: number } | null;
  directionsTarget?: { lat: number; lng: number; name: string } | null;
  onDirectionsClear?: () => void;
}

type CourtType = "tennis" | "pickleball" | "both";

const PADDLE_GRADIENTS: Record<CourtType, [string, string]> = {
  tennis: ["hsl(142 72% 54%)", "hsl(155 80% 36%)"],
  pickleball: ["hsl(217 91% 60%)", "hsl(224 76% 48%)"],
  both: ["hsl(271 81% 56%)", "hsl(262 83% 46%)"],
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function truncateName(name: string, max = 24): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function getAvailabilityLabel(court: CourtWithQueue): {
  text: string;
  busy: boolean;
} {
  const waiting =
    court.queue?.queue_entries?.filter((e) => e.status === "waiting")
      .length ?? 0;
  const available = getAvailableCourts(
    court.num_courts,
    court.active_sessions ?? [],
    0
  );
  const openLabel = `${formatAvailableCourts(available, court.num_courts)} open`;
  if (waiting > 0) {
    return { text: `${openLabel} · ${waiting} waiting`, busy: true };
  }
  if (available === 0) {
    return { text: `${openLabel} · all full`, busy: true };
  }
  return { text: openLabel, busy: false };
}

function getPaddleSvg(type: CourtType, gradId: string): string {
  const [start, end] = PADDLE_GRADIENTS[type] ?? PADDLE_GRADIENTS.tennis;
  return `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="16" cy="14" rx="11" ry="12" fill="url(#${gradId})"/>
    <ellipse cx="16" cy="14" rx="7" ry="8" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    <line x1="9" y1="8" x2="23" y2="20" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
    <line x1="9" y1="20" x2="23" y2="8" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
    <rect x="14.5" y="25" width="3" height="9" rx="1.5" fill="${start}"/>
    <circle cx="27" cy="8" r="3" fill="${type === "pickleball" ? "hsl(199 89% 68%)" : "hsl(90 80% 60%)"}" opacity="0.95"/>
    <defs>
      <linearGradient id="${gradId}" x1="5" y1="3" x2="27" y2="25" gradientUnits="userSpaceOnUse">
        <stop stop-color="${start}"/>
        <stop offset="1" stop-color="${end}"/>
      </linearGradient>
    </defs>
  </svg>`;
}

function createPaddleMarkerElement(
  court: CourtWithQueue,
  isSelected: boolean,
  onClick: () => void
): HTMLDivElement {
  const type = (court.court_type as CourtType) ?? "tennis";
  const gradId = `paddle-${court.id.replace(/[^a-zA-Z0-9]/g, "")}`;
  const availability = getAvailabilityLabel(court);

  const wrapper = document.createElement("div");
  wrapper.className = `court-map-pin${isSelected ? " is-selected" : ""}`;
  wrapper.setAttribute("role", "button");
  wrapper.setAttribute("tabindex", "0");
  wrapper.setAttribute(
    "aria-label",
    `${court.name}, ${availability.text}`
  );

  wrapper.innerHTML = `
    <div class="court-map-pin__inner">
      <div class="court-map-pin__card">
        <p class="court-map-pin__name">${escapeHtml(truncateName(court.name))}</p>
        <p class="court-map-pin__meta${availability.busy ? " is-busy" : ""}">${escapeHtml(availability.text)}</p>
      </div>
      <div class="court-map-pin__paddle court-map-pin__paddle--${type}">
        ${getPaddleSvg(type, gradId)}
      </div>
    </div>
  `;

  wrapper.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });

  wrapper.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  });

  wrapper.addEventListener(
    "touchstart",
    () => {
      wrapper.classList.add("is-touch-active");
    },
    { passive: true }
  );

  wrapper.addEventListener("touchend", () => {
    window.setTimeout(() => {
      if (!wrapper.classList.contains("is-selected")) {
        wrapper.classList.remove("is-touch-active");
      }
    }, 1800);
  });

  return wrapper;
}

function createPaddleOverlay(
  position: google.maps.LatLngLiteral,
  div: HTMLDivElement
): google.maps.OverlayView {
  class CourtPaddleOverlay extends google.maps.OverlayView {
    private position: google.maps.LatLng;

    constructor(pos: google.maps.LatLngLiteral, element: HTMLDivElement) {
      super();
      this.position = new google.maps.LatLng(pos.lat, pos.lng);
      this.div = element;
    }

    div: HTMLDivElement;

    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.div);
    }

    draw() {
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(this.position);
      if (!point) return;
      this.div.style.left = `${point.x}px`;
      this.div.style.top = `${point.y}px`;
    }

    onRemove() {
      this.div.remove();
    }
  }

  return new CourtPaddleOverlay(position, div);
}

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d2d44" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#14532d" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
];

export function CourtMap({
  courts,
  selectedCourt,
  onCourtSelect,
  userLocation,
  mapCenter,
  directionsTarget,
  onDirectionsClear,
}: CourtMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<Map<string, google.maps.OverlayView>>(new Map());
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    duration: string;
    distance: string;
  } | null>(null);

  const initMap = useCallback(async () => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY") return;

    setOptions({ key: apiKey });
    const { Map } = (await importLibrary("maps")) as google.maps.MapsLibrary;

    const center = userLocation ?? { lat: 40.7128, lng: -74.006 };

    const map = new Map(mapRef.current, {
      center,
      zoom: userLocation ? 13 : 12,
      mapTypeId: "roadmap",
      styles: DARK_MAP_STYLES,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: "greedy",
      isFractionalZoomEnabled: true,
      draggable: true,
    });

    mapInstanceRef.current = map;
    setMapLoaded(true);
  }, []);

  useEffect(() => {
    initMap();
  }, [initMap]);

  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current.clear();

    courts.forEach((court) => {
      const isSelected = selectedCourt?.id === court.id;
      const element = createPaddleMarkerElement(court, isSelected, () =>
        onCourtSelect(court)
      );

      const overlay = createPaddleOverlay(
        { lat: court.latitude, lng: court.longitude },
        element
      );
      overlay.setMap(mapInstanceRef.current);
      overlaysRef.current.set(court.id, overlay);
    });
  }, [courts, mapLoaded, selectedCourt, onCourtSelect]);

  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !userLocation) return;

    const userDotSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" fill="#3b82f6" opacity="0.2"/>
      <circle cx="10" cy="10" r="5" fill="#3b82f6"/>
      <circle cx="10" cy="10" r="3" fill="white"/>
    </svg>`;

    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition(userLocation);
    } else {
      userMarkerRef.current = new google.maps.Marker({
        position: userLocation,
        map: mapInstanceRef.current,
        title: "Your location",
        icon: {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(userDotSvg),
          scaledSize: new google.maps.Size(20, 20),
          anchor: new google.maps.Point(10, 10),
        },
        zIndex: 500,
      });
    }
  }, [userLocation, mapLoaded]);

  useEffect(() => {
    if (selectedCourt && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({
        lat: selectedCourt.latitude,
        lng: selectedCourt.longitude,
      });
      mapInstanceRef.current.setZoom(15);
    }
  }, [selectedCourt]);

  useEffect(() => {
    if (userLocation && mapInstanceRef.current && !selectedCourt) {
      mapInstanceRef.current.panTo(userLocation);
      mapInstanceRef.current.setZoom(13);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]);

  useEffect(() => {
    if (mapCenter && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(mapCenter);
      mapInstanceRef.current.setZoom(13);
    }
  }, [mapCenter]);

  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
      setRouteInfo(null);
    }

    if (!directionsTarget) return;

    const origin = userLocation ?? null;
    if (!origin) return;

    const renderer = new google.maps.DirectionsRenderer({
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: "#22c55e",
        strokeWeight: 5,
        strokeOpacity: 0.85,
      },
    });
    renderer.setMap(mapInstanceRef.current);
    directionsRendererRef.current = renderer;

    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin,
        destination: directionsTarget,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result) {
          renderer.setDirections(result);
          const leg = result.routes[0]?.legs[0];
          if (leg) {
            setRouteInfo({
              duration: leg.duration?.text ?? "",
              distance: leg.distance?.text ?? "",
            });
          }
        }
      }
    );
  }, [directionsTarget, mapLoaded, userLocation]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasApiKey = apiKey && apiKey !== "YOUR_GOOGLE_MAPS_API_KEY";

  if (!hasApiKey) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-card/50 rounded-xl border border-border/50">
        <div className="text-center space-y-3 p-8 max-w-sm w-full">
          <div className="text-5xl mb-4">🗺️</div>
          <h3 className="text-lg font-semibold">Interactive Map</h3>
          <p className="text-sm text-muted-foreground">
            Add your{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
              NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
            </code>{" "}
            to{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
              .env.local
            </code>{" "}
            to see courts on the map.
          </p>
          <div className="mt-4 space-y-1.5 max-h-80 overflow-y-auto">
            {courts.map((court) => {
              const available = getAvailableCourts(
                court.num_courts,
                court.active_sessions ?? [],
                0
              );
              return (
                <button
                  key={court.id}
                  onClick={() => onCourtSelect(court)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border ${
                    selectedCourt?.id === court.id
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-muted/30 border-border/30 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{court.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {court.court_type} ·{" "}
                    {formatAvailableCourts(available, court.num_courts)} available
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full touch-none select-none" />

      {directionsTarget && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 frosted-surface rounded-2xl px-4 py-2.5 shadow-xl border border-white/[0.08]">
          <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">{directionsTarget.name}</span>
            {routeInfo && (
              <span className="text-muted-foreground ml-2">
                {routeInfo.duration} · {routeInfo.distance}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              if (directionsRendererRef.current) {
                directionsRendererRef.current.setMap(null);
                directionsRendererRef.current = null;
              }
              setRouteInfo(null);
              onDirectionsClear?.();
            }}
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
            title="Clear route"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
