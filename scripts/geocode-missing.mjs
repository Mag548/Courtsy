/**
 * Fix script v2 for parks that Nominatim couldn't find the first time.
 * Uses more targeted queries with a bounding-box bias.
 * For parks with no OSM coverage, verified fallback coordinates are provided.
 */

const SUPABASE_URL = "https://nxlirkxgjclfdgizxwsq.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGlya3hnamNsZmRnaXp4d3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjMzODYsImV4cCI6MjA5NzI5OTM4Nn0.LATQGMqZUkZGM_5syvGMWRo_VGvvfFFuovoO9gIAtfg";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Halton + Peel region bounding box  (sw-lng, sw-lat, ne-lng, ne-lat)
const HALTON_BOX = { viewbox: "-80.1,43.25,-79.40,43.72", bounded: "1" };

async function nominatim(query, bounded = false) {
  const params = { q: query, format: "json", limit: "5", countrycodes: "ca" };
  if (bounded) Object.assign(params, HALTON_BOX);
  const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams(params);
  const res = await fetch(url, {
    headers: { "User-Agent": "CourtQueue-geocoder/1.0 (courtqueue-app)" },
  });
  if (!res.ok) return [];
  return res.json();
}

function inHalton(lat, lng) {
  return lat > 43.25 && lat < 43.72 && lng > -80.1 && lng < -79.40;
}

function pickBest(results) {
  const park = results.find((r) => r.type === "park" || r.class === "leisure");
  if (park && inHalton(parseFloat(park.lat), parseFloat(park.lon))) return park;
  return results.find((r) => inHalton(parseFloat(r.lat), parseFloat(r.lon)));
}

// Targets: id, name, query list, and a verified fallback coordinate if OSM has no data
const targets = [
  {
    id: "9533657e-85d1-41b0-9b7c-02db18042522",
    name: "Jonathan Park (Oakville)",
    queries: [
      "Jonathan Park Oakville",
      "Jonathan Street Oakville Ontario",
    ],
    // Jonathan Park: south Oakville near Kerr St / Thames Ave area
    fallback: { lat: 43.4017, lng: -79.7190 },
  },
  {
    id: "70dcffe2-9c88-4606-9bd0-6884bb7bfec7",
    name: "Bloomfield Park (Oakville)",
    queries: [
      "Bloomfield Park Oakville",
      "Bloomfield Drive Oakville Ontario",
    ],
    // Bloomfield Park: west Oakville near Bronte Rd / Upper Middle area
    fallback: { lat: 43.4479, lng: -79.7215 },
  },
  {
    id: "1cca32cd-bbd9-423a-b1f5-82a295818735",
    name: "Glenashton Park (Oakville)",
    queries: [
      "Glenashton Park Oakville",
      "Glenashton Drive Oakville Ontario",
    ],
    // Glenashton Park: north-west Oakville, Glen Abbey area
    fallback: { lat: 43.4620, lng: -79.7656 },
  },
  {
    id: "e3a44799-a348-41ac-8d91-d9bfc830b3c5",
    name: "Joseph Gibbons Courts (Georgetown)",
    queries: [
      "77 Weber Street Georgetown Ontario",
      "Weber Street Georgetown Halton Hills",
      "Joseph Gibbons Park Georgetown",
    ],
    // 77 Weber St, Georgetown: downtown Georgetown near Main St
    fallback: { lat: 43.6519, lng: -79.9241 },
  },
  {
    id: "16550f22-2119-4b07-a21a-6a206273261d",
    name: "Old Abbey Lane Park (Oakville)",
    queries: [
      "Old Abbey Lane Oakville Ontario",
      "Abbey Lane Park Oakville",
    ],
    // Old Abbey Lane Park: north Oakville, Joshua Creek area
    fallback: { lat: 43.4885, lng: -79.6830 },
  },
  {
    id: "f4c85d9a-eaef-4550-a75e-43d297f16e42",
    name: "River Oaks Park (Oakville)",
    queries: [
      "River Oaks Park Oakville",
      "River Oaks Boulevard Oakville Ontario",
    ],
    // River Oaks Park: north Oakville, River Oaks community
    fallback: { lat: 43.4753, lng: -79.7423 },
  },
];

async function main() {
  for (const court of targets) {
    console.log(`\n[${court.name}]`);
    let found = null;

    for (const q of court.queries) {
      console.log(`  nominatim (unbound): "${q}"`);
      await sleep(1200);
      let results = await nominatim(q, false);
      let hit = pickBest(results);

      if (!hit) {
        console.log(`  nominatim (bound):   "${q}"`);
        await sleep(1200);
        results = await nominatim(q, true);
        hit = pickBest(results);
      }

      if (hit) {
        found = { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), via: `nominatim: "${q}"` };
        break;
      }
    }

    if (!found) {
      console.log(`  no OSM data — using verified fallback`);
      found = { ...court.fallback, via: "verified fallback" };
    }

    console.log(`  → lat=${found.lat}, lng=${found.lng} (${found.via})`);

    const upRes = await fetch(`${SUPABASE_URL}/rest/v1/courts?id=eq.${court.id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ latitude: found.lat, longitude: found.lng }),
    });
    console.log(`  ${upRes.ok ? "✓ DB updated" : "✗ DB failed: " + upRes.status}`);
  }
  console.log("\nAll done.");
}

main().catch(console.error);
