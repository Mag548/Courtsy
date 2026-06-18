"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import type { CourtWithQueue } from "@/lib/supabase/types";

interface CourtMapProps {
  courts: CourtWithQueue[];
  selectedCourt: CourtWithQueue | null;
  onCourtSelect: (court: CourtWithQueue) => void;
  userLocation?: { lat: number; lng: number } | null;
  mapCenter?: { lat: number; lng: number } | null;
  directionsTarget?: { lat: number; lng: number; name: string } | null;
  onDirectionsClear?: () => void;
}

function getMarkerSvg(type: "tennis" | "pickleball" | "both", selected: boolean) {
  const size = selected ? 40 : 32;
  const colors: Record<string, string> = {
    tennis: "#22c55e",
    pickleball: "#3b82f6",
    both: "#a855f7",
  };
  const labels: Record<string, string> = {
    tennis: "T",
    pickleball: "P",
    both: "T/P",
  };
  const color = colors[type] ?? "#22c55e";
  const label = labels[type] ?? "?";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.25}" viewBox="0 0 32 40">
    <path d="M16 0C9.4 0 4 5.4 4 12c0 9 12 28 12 28S28 21 28 12C28 5.4 22.6 0 16 0z" fill="${color}" opacity="${selected ? 1 : 0.9}"/>
    <circle cx="16" cy="12" r="7" fill="white" opacity="0.25"/>
    <text x="16" y="16" text-anchor="middle" font-size="${label.length > 1 ? 7 : 10}" fill="white" font-family="Arial" font-weight="bold">${label}</text>
  </svg>`;
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

export function CourtMap({ courts, selectedCourt, onCourtSelect, userLocation, mapCenter, directionsTarget, onDirectionsClear }: CourtMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ duration: string; distance: string } | null>(null);

  const initMap = useCallback(async () => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY") return;

    setOptions({ key: apiKey });
    const { Map } = await importLibrary("maps") as google.maps.MapsLibrary;

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
    });

    mapInstanceRef.current = map;
    setMapLoaded(true);
  }, []);

  useEffect(() => {
    initMap();
  }, [initMap]);

  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    courts.forEach((court) => {
      const queueLength =
        court.queue?.queue_entries?.filter((e) => e.status === "waiting").length ?? 0;
      const isSelected = selectedCourt?.id === court.id;

      const iconSvg = getMarkerSvg(court.court_type as "tennis" | "pickleball" | "both", isSelected);
      const iconSize = isSelected ? 40 : 32;

      const marker = new google.maps.Marker({
        position: { lat: court.latitude, lng: court.longitude },
        map: mapInstanceRef.current!,
        title: court.name,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(iconSvg),
          scaledSize: new google.maps.Size(iconSize, iconSize * 1.25),
          anchor: new google.maps.Point(iconSize / 2, iconSize * 1.25),
        },
        animation: isSelected ? google.maps.Animation.BOUNCE : undefined,
        label:
          queueLength > 0
            ? { text: String(queueLength), color: "white", fontSize: "10px", fontWeight: "bold" }
            : undefined,
        zIndex: isSelected ? 1000 : 1,
      });

      marker.addListener("click", () => onCourtSelect(court));
      markersRef.current.set(court.id, marker);
    });
  }, [courts, mapLoaded, selectedCourt, onCourtSelect]);

  // User location blue dot
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
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(userDotSvg),
          scaledSize: new google.maps.Size(20, 20),
          anchor: new google.maps.Point(10, 10),
        },
        zIndex: 500,
      });
    }
  }, [userLocation, mapLoaded]);

  // Pan to selected court
  useEffect(() => {
    if (selectedCourt && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({
        lat: selectedCourt.latitude,
        lng: selectedCourt.longitude,
      });
      mapInstanceRef.current.setZoom(15);
    }
  }, [selectedCourt]);

  // Pan to user location when it first arrives
  useEffect(() => {
    if (userLocation && mapInstanceRef.current && !selectedCourt) {
      mapInstanceRef.current.panTo(userLocation);
      mapInstanceRef.current.setZoom(13);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]);

  // Pan to place searched via PlacesSearch
  useEffect(() => {
    if (mapCenter && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(mapCenter);
      mapInstanceRef.current.setZoom(13);
    }
  }, [mapCenter]);

  // ── Directions ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    // Clear existing route
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
              const qLen = court.queue?.queue_entries?.filter((e) => e.status === "waiting").length ?? 0;
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
                    {qLen > 0 && (
                      <span className="text-xs text-primary ml-2 shrink-0">
                        {qLen} waiting
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {court.court_type} · {court.num_courts} courts
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
      <div ref={mapRef} className="w-full h-full" />

      {/* Route info + clear button */}
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
