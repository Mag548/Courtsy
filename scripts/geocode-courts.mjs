/**
 * One-time script: geocodes every court in Supabase via Nominatim (OpenStreetMap).
 * Rate-limited to 1 req/s to comply with Nominatim usage policy.
 *
 * Run once with:  node scripts/geocode-courts.mjs
 */

const SUPABASE_URL = "https://nxlirkxgjclfdgizxwsq.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGlya3hnamNsZmRnaXp4d3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjMzODYsImV4cCI6MjA5NzI5OTM4Nn0.LATQGMqZUkZGM_5syvGMWRo_VGvvfFFuovoO9gIAtfg";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatim(query) {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({ q: query, format: "json", limit: "3", countrycodes: "ca" });

  const res = await fetch(url, {
    headers: { "User-Agent": "CourtQueue-geocoder/1.0 (courtqueue-app)" },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  return res.json();
}

/** Build progressively less specific queries until we get a hit */
async function geocodeCourt(court) {
  const candidates = [];

  // 1. Full address if present
  if (court.address && !court.address.includes(court.name)) {
    candidates.push(`${court.address}, Canada`);
  }

  // 2. Park name + municipality (parsed from address or name)
  const municipality = court.address?.match(/(Oakville|Burlington|Georgetown|Halton Hills)/i)?.[1];
  if (municipality) candidates.push(`${court.name}, ${municipality}, Ontario, Canada`);

  // 3. Park name + Ontario fallback
  candidates.push(`${court.name}, Ontario, Canada`);

  for (const query of candidates) {
    console.log(`  trying: "${query}"`);
    await sleep(1100); // Nominatim: ≤1 req/s
    const results = await nominatim(query);

    // Prefer parks/leisure results; fall back to first result
    const park = results.find(
      (r) => r.type === "park" || r.class === "leisure" || r.class === "amenity"
    ) ?? results[0];

    if (park) {
      return { lat: parseFloat(park.lat), lng: parseFloat(park.lon), via: query };
    }
  }
  return null;
}

async function main() {
  // 1. Fetch all courts
  const res = await fetch(`${SUPABASE_URL}/rest/v1/courts?select=id,name,address&is_active=eq.true`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  const courts = await res.json();
  console.log(`Found ${courts.length} courts to geocode.\n`);

  const updates = [];

  for (const court of courts) {
    console.log(`\n[${court.name}]`);
    const result = await geocodeCourt(court);

    if (result) {
      console.log(`  ✓ lat=${result.lat}, lng=${result.lng} (via: ${result.via})`);
      updates.push({ id: court.id, latitude: result.lat, longitude: result.lng });
    } else {
      console.log(`  ✗ no result — skipping`);
    }
  }

  // 2. Update Supabase for each hit
  console.log(`\nUpdating ${updates.length} courts…`);
  for (const u of updates) {
    const upRes = await fetch(
      `${SUPABASE_URL}/rest/v1/courts?id=eq.${u.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ latitude: u.latitude, longitude: u.longitude }),
      }
    );
    if (upRes.ok) {
      console.log(`  ✓ updated ${u.id}`);
    } else {
      console.log(`  ✗ failed to update ${u.id}: ${upRes.status}`);
    }
  }

  console.log("\nDone.");
}

main().catch(console.error);
