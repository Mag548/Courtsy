"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { MapPin, X } from "lucide-react";

interface PlacesSearchProps {
  onLocationSelect: (location: { lat: number; lng: number; name: string }) => void;
  disabled?: boolean;
}

export function PlacesSearch({ onLocationSelect, disabled }: PlacesSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [value, setValue] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY" || !inputRef.current) return;

    let cancelled = false;

    const init = async () => {
      setOptions({ key: apiKey });
      const { Autocomplete } = await importLibrary("places") as google.maps.PlacesLibrary;
      if (cancelled || !inputRef.current) return;

      const ac = new Autocomplete(inputRef.current, {
        types: ["geocode", "establishment"],
        fields: ["geometry", "name", "formatted_address"],
      });

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const name = place.name ?? place.formatted_address ?? "";
        setValue(name);
        onLocationSelect({ lat, lng, name });
      });

      autocompleteRef.current = ac;
      setReady(true);
    };

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = () => {
    setValue("");
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  };

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasApiKey = apiKey && apiKey !== "YOUR_GOOGLE_MAPS_API_KEY";

  if (!hasApiKey) return null;

  return (
    <div className="relative">
      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        placeholder={ready ? "Search any location…" : "Loading search…"}
        disabled={disabled || !ready}
        defaultValue={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full h-11 pl-10 pr-9 rounded-2xl border border-white/[0.06] bg-white/[0.04] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-white/[0.06] transition-colors disabled:opacity-50"
      />
      {value && (
        <button
          onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
