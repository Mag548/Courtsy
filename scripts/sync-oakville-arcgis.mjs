/**
 * Sync Oakville ArcGIS tennis/pickleball courts into Supabase.
 *
 * Run: npm run sync:oakville
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  fetchOakvilleCourts,
  normalizeParkKey,
} from "./fetchOakvilleCourts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "oakville-courts.json");

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  "https://nxlirkxgjclfdgizxwsq.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGlya3hnamNsZmRnaXp4d3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjMzODYsImV4cCI6MjA5NzI5OTM4Nn0.LATQGMqZUkZGM_5syvGMWRo_VGvvfFFuovoO9gIAtfg";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

function distanceKm(lat1, lng1, lat2, lng2) {
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

/** @param {string} name */
function legacyNormalize(name) {
  const key = normalizeParkKey(name);
  return key.length >= 3 ? key : "";
}

/**
 * @param {Awaited<ReturnType<typeof fetchOakvilleCourts>>[number]} oakvilleCourt
 * @param {Array<{id:string,name:string,latitude:number,longitude:number}>} existing
 */
function findExistingMatch(oakvilleCourt, existing) {
  const targetKey = legacyNormalize(oakvilleCourt.name);
  if (!targetKey) return null;

  let match = existing.find(
    (row) => legacyNormalize(row.name) === targetKey
  );
  if (match) return match;

  match = existing.find((row) => {
    const rowKey = legacyNormalize(row.name);
    if (!rowKey || rowKey.length < 5 || targetKey.length < 5) return false;
    return rowKey.includes(targetKey) || targetKey.includes(rowKey);
  });
  if (match) return match;

  const targetFirst = targetKey.split(" ")[0];
  if (!targetFirst || targetFirst.length < 4) return null;

  return (
    existing.find((row) => {
      const rowKey = legacyNormalize(row.name);
      if (!rowKey) return false;
      const rowFirst = rowKey.split(" ")[0];
      if (rowFirst !== targetFirst) return false;
      return (
        distanceKm(
          row.latitude,
          row.longitude,
          oakvilleCourt.latitude,
          oakvilleCourt.longitude
        ) < 0.3
      );
    }) ?? null
  );
}

async function loadExistingCourts() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/courts?select=id,name,latitude,longitude,court_type,address,is_active`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`Failed to load courts: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function upsertCourt(court, existingId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_court_location`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_id: existingId ?? null,
      p_name: court.name,
      p_address: court.address,
      p_latitude: court.latitude,
      p_longitude: court.longitude,
      p_court_type: court.court_type,
      p_num_courts: court.num_courts,
      p_amenities: court.amenities,
    }),
  });

  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }

  return res.json();
}

async function main() {
  console.log("Fetching Oakville ArcGIS courts…");
  const oakvilleCourts = await fetchOakvilleCourts();
  console.log(
    `Consolidated ${oakvilleCourts.length} park locations from ArcGIS layer 3.\n`
  );

  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(oakvilleCourts, null, 2));
  console.log(`Saved snapshot → ${DATA_PATH}\n`);

  const existing = await loadExistingCourts();
  console.log(`Loaded ${existing.length} existing courts from Supabase.\n`);

  let updated = 0;
  let inserted = 0;
  let skipped = 0;

  for (const court of oakvilleCourts) {
    console.log(`[${court.name}]`);
    console.log(
      `  ${court.num_courts} courts · ${court.court_type} · ${court.latitude.toFixed(5)}, ${court.longitude.toFixed(5)}`
    );

    const match = findExistingMatch(court, existing);

    try {
      const courtId = await upsertCourt(court, match?.id ?? null);
      if (match) {
        console.log(`  ✓ updated (matched "${match.name}")`);
        updated++;
      } else {
        console.log(`  ✓ inserted (${courtId})`);
        inserted++;
        existing.push({
          id: courtId,
          name: court.name,
          latitude: court.latitude,
          longitude: court.longitude,
        });
      }
    } catch (err) {
      console.log(`  ✗ ${err.message}`);
      skipped++;
    }
  }

  console.log("\n═══════════════════════════");
  console.log(`ArcGIS parks : ${oakvilleCourts.length}`);
  console.log(`Updated      : ${updated}`);
  console.log(`Inserted     : ${inserted}`);
  console.log(`Skipped      : ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
