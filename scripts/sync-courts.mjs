/**
 * Full court sync v2 — corrected addresses + correct DB schema.
 * courts table: address, amenities[], court_type, image_url, is_active,
 *               latitude, longitude, name, num_courts
 * Run once: node scripts/sync-courts.mjs
 */

const SUPABASE_URL = "https://nxlirkxgjclfdgizxwsq.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGlya3hnamNsZmRnaXp4d3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjMzODYsImV4cCI6MjA5NzI5OTM4Nn0.LATQGMqZUkZGM_5syvGMWRo_VGvvfFFuovoO9gIAtfg";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Full corrected dataset.
// `fallback` = verified coords for parks Nominatim can't find (small municipal parks with no OSM node)
const COURTS = [
  // ── Oakville ─────────────────────────────────────────────────────────────
  { name: "Shell Park",                        address: "Shell Park Rd, Oakville, Ontario",                municipality: "Oakville",     sport: "Tennis/Pickleball" },
  { name: "Old Abbey Lane Park",               address: "Old Abbey Lane, Oakville, Ontario",               municipality: "Oakville",     sport: "Tennis/Pickleball" },
  { name: "Jonathan Park",                     address: "Jonathan Park, Oakville, Ontario",                municipality: "Oakville",     sport: "Tennis/Pickleball", fallback: { lat: 43.4017, lng: -79.7190 } },
  { name: "Maplegrove Park",                   address: "2237 Devon Road, Oakville, Ontario",              municipality: "Oakville",     sport: "Tennis/Pickleball" },
  { name: "Bloomfield Park",                   address: "Bloomfield Park, Oakville, Ontario",              municipality: "Oakville",     sport: "Tennis/Pickleball", fallback: { lat: 43.4479, lng: -79.7215 } },
  { name: "River Oaks Park",                   address: "220 River Oaks Blvd E, Oakville, Ontario",        municipality: "Oakville",     sport: "Tennis/Pickleball" },
  { name: "Glenashton Park",                   address: "Glenashton Park, Oakville, Ontario",              municipality: "Oakville",     sport: "Tennis/Pickleball", fallback: { lat: 43.4620, lng: -79.7656 } },
  { name: "William Rose Park",                 address: "William Rose Park, Oakville, Ontario",            municipality: "Oakville",     sport: "Tennis/Pickleball" },
  { name: "Hopedale Park",                     address: "1436 Tansley Drive, Oakville, Ontario",           municipality: "Oakville",     sport: "Tennis/Pickleball" },
  { name: "Trafalgar Park Community Centre",   address: "133 Rebecca Street, Oakville, Ontario",           municipality: "Oakville",     sport: "Tennis/Pickleball", isNew: true },
  { name: "Sovereign Park",                    address: "144 East Street, Oakville, Ontario",              municipality: "Oakville",     sport: "Tennis/Pickleball", isNew: true },
  { name: "Castlefield Park",                  address: "220 River Oaks Blvd E, Oakville, Ontario",        municipality: "Oakville",     sport: "Tennis/Pickleball", isNew: true },
  { name: "Valleybrook Park",                  address: "1150 Valley Brook Drive, Oakville, Ontario",      municipality: "Oakville",     sport: "Tennis/Pickleball", isNew: true },
  { name: "Fowley Park",                       address: "95 Fowley Drive, Oakville, Ontario",              municipality: "Oakville",     sport: "Tennis/Pickleball", isNew: true },
  // ── Burlington ───────────────────────────────────────────────────────────
  { name: "Bolus Garden Parkette",             address: "Bolus Garden Parkette, Burlington, Ontario",      municipality: "Burlington",   sport: "Pickleball",        fallback: { lat: 43.3393, lng: -79.8166 } },
  { name: "Ireland Park",                      address: "2315 Headon Forest Dr, Burlington, Ontario",      municipality: "Burlington",   sport: "Pickleball" },
  { name: "Optimist Park",                     address: "Optimist Park, Burlington, Ontario",              municipality: "Burlington",   sport: "Pickleball" },
  { name: "Sycamore Park",                     address: "Sycamore Park, Burlington, Ontario",              municipality: "Burlington",   sport: "Pickleball" },
  { name: "Tansley Woods Park",                address: "4100 Kilmer Dr, Burlington, Ontario",             municipality: "Burlington",   sport: "Pickleball" },
  { name: "Brant Hills Community Centre",      address: "2255 Brant St, Burlington, Ontario",              municipality: "Burlington",   sport: "Tennis",            isNew: true },
  // ── Halton Hills ─────────────────────────────────────────────────────────
  { name: "Eighth Line Park Tennis Courts",    address: "10241 Eighth Line, Georgetown, Ontario",          municipality: "Halton Hills", sport: "Tennis" },
  { name: "Prospect Park Courts",              address: "30 Park Ave, Georgetown, Ontario",                municipality: "Halton Hills", sport: "Tennis/Pickleball" },
  { name: "Emmerson Park Courts",              address: "52 Carruthers Rd, Georgetown, Ontario",           municipality: "Halton Hills", sport: "Tennis/Pickleball" },
  { name: "Joseph Gibbons Courts",             address: "77 Weber St, Georgetown, Ontario",                municipality: "Halton Hills", sport: "Tennis/Pickleball", fallback: { lat: 43.6519, lng: -79.9241 } },
];

const BBOX = { viewbox: "-80.1,43.25,-79.40,43.72", bounded: "1" };

function inHalton(lat, lng) {
  return lat > 43.25 && lat < 43.72 && lng > -80.1 && lng < -79.40;
}

async function nominatim(q, bounded = false) {
  const p = { q, format: "json", limit: "5", countrycodes: "ca" };
  if (bounded) Object.assign(p, BBOX);
  const res = await fetch("https://nominatim.openstreetmap.org/search?" + new URLSearchParams(p), {
    headers: { "User-Agent": "CourtQueue-geocoder/1.0" },
  });
  if (!res.ok) return [];
  return res.json();
}

function pickBest(results) {
  const park = results.find((r) => r.type === "park" || r.class === "leisure");
  if (park && inHalton(parseFloat(park.lat), parseFloat(park.lon))) return park;
  return results.find((r) => inHalton(parseFloat(r.lat), parseFloat(r.lon)));
}

async function geocode(entry) {
  const queries = [
    [entry.address, false],
    [entry.address, true],
    [`${entry.name}, ${entry.municipality}, Ontario`, true],
  ];
  for (const [q, bounded] of queries) {
    await sleep(1100);
    const hit = pickBest(await nominatim(q, bounded));
    if (hit) return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
  }
  return null;
}

function courtType(sport) {
  if (sport === "Tennis/Pickleball") return "tennis_pickleball";
  if (sport === "Pickleball") return "pickleball";
  return "tennis";
}

function amenities(sport) {
  if (sport === "Tennis/Pickleball") return ["Tennis", "Pickleball", "Outdoor", "Free"];
  if (sport === "Pickleball") return ["Pickleball", "Outdoor", "Free"];
  return ["Tennis", "Outdoor", "Free"];
}

async function main() {
  const dbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/courts?select=id,name&is_active=eq.true`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const existing = await dbRes.json();
  const byName = Object.fromEntries(existing.map((c) => [c.name.toLowerCase().trim(), c.id]));
  console.log(`Found ${existing.length} existing courts.\n`);

  let updated = 0, inserted = 0, skipped = 0;

  for (const entry of COURTS) {
    console.log(`\n[${entry.name}]`);

    // Geocode (or use fallback)
    let coords = await geocode(entry);
    if (!coords && entry.fallback) {
      console.log("  no OSM result — using verified fallback");
      coords = entry.fallback;
    }
    if (!coords) {
      console.log("  ✗ no coords — skipping");
      skipped++;
      continue;
    }
    console.log(`  coords: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);

    const existingId = byName[entry.name.toLowerCase().trim()];

    if (existingId) {
      // Patch existing row
      const res = await fetch(`${SUPABASE_URL}/rest/v1/courts?id=eq.${existingId}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ address: entry.address, latitude: coords.lat, longitude: coords.lng }),
      });
      if (res.ok) { console.log("  ✓ updated"); updated++; }
      else { console.log(`  ✗ update failed ${res.status}: ${await res.text()}`); skipped++; }
    } else {
      // Insert new court
      const res = await fetch(`${SUPABASE_URL}/rest/v1/courts`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          name: entry.name,
          address: entry.address,
          latitude: coords.lat,
          longitude: coords.lng,
          court_type: courtType(entry.sport),
          amenities: amenities(entry.sport),
          num_courts: 2,
          is_active: true,
        }),
      });
      if (res.ok) { console.log("  ✓ inserted"); inserted++; }
      else { console.log(`  ✗ insert failed ${res.status}: ${await res.text()}`); skipped++; }
    }
  }

  console.log(`\n═══════════════════════════`);
  console.log(`Updated : ${updated}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped : ${skipped}`);
}

main().catch(console.error);
