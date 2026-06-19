/**
 * Oakville tennis / pickleball court data from ArcGIS MapServer layer 3.
 * https://maps.oakville.ca/oakgis/rest/services/ArcGISOnline/AGO_Communications/MapServer/3
 */

const BASE_URL =
  "https://maps.oakville.ca/oakgis/rest/services/ArcGISOnline/AGO_Communications/MapServer/3/query";

const PAGE_SIZE = 100;

/**
 * @param {string} [where]
 * @returns {Promise<import('./oakville-types').ArcGISFeature[]>}
 */
export async function fetchArcGISFeatures(where = "1=1") {
  const all = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      where,
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      f: "json",
      resultRecordCount: String(PAGE_SIZE),
      resultOffset: String(offset),
    });

    const res = await fetch(`${BASE_URL}?${params}`);
    if (!res.ok) {
      throw new Error(`ArcGIS HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message ?? JSON.stringify(data.error));
    }

    const batch = data.features ?? [];
    all.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

/** @param {string} name */
function inferSportFlags(name) {
  const upper = name.toUpperCase();
  const hasPickleball = upper.includes("PICKLEBALL");
  const hasTennis = upper.includes("TENNIS") || upper.includes("TENNIS");
  return {
    hasPickleball,
    hasTennis: hasTennis || !hasPickleball,
  };
}

/** @param {string} name */
function stripFacilitySuffix(name) {
  return name
    .replace(/\s+Multi-Lined Pickleball.*$/i, "")
    .replace(/\s+Multi-line Pickleball.*$/i, "")
    .replace(/\s+Pickleball Courts?$/i, "")
    .replace(/\s+Tennis Courts?$/i, "")
    .replace(/\s+Ps Multi-Lined.*$/i, "")
    .trim();
}

/** @param {import('./oakville-types').ArcGISFeature[]} features */
function parkDisplayName(features) {
  const parent = features[0].attributes.PARENTPARKNAME?.trim();
  if (parent && parent.toUpperCase() !== "N/A") return parent;

  const names = features
    .map((f) => f.attributes.NAME?.trim())
    .filter(Boolean)
    .map(stripFacilitySuffix)
    .filter(Boolean);

  if (names.length === 0) return "Unknown Court";

  names.sort((a, b) => a.length - b.length);
  return names[0];
}

/** @param {string} name */
export function normalizeParkKey(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(multi lined|tennis|pickleball|courts?|court|ps)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {import('./oakville-types').ArcGISFeature[]} features */
function inferCourtType(features) {
  let hasPickleball = false;
  let hasTennis = false;

  for (const feature of features) {
    const flags = inferSportFlags(feature.attributes.NAME ?? "");
    hasPickleball ||= flags.hasPickleball;
    hasTennis ||= flags.hasTennis;
  }

  if (hasPickleball && hasTennis) return "both";
  if (hasPickleball) return "pickleball";
  return "tennis";
}

/** @param {import('./oakville-types').ArcGISFeature[]} features */
function amenitiesForType(courtType) {
  if (courtType === "both") return ["Tennis", "Pickleball", "Outdoor", "Free"];
  if (courtType === "pickleball") return ["Pickleball", "Outdoor", "Free"];
  return ["Tennis", "Outdoor", "Free"];
}

/**
 * Group ArcGIS point features into one CourtQueue location per park.
 * @param {import('./oakville-types').ArcGISFeature[]} features
 */
export function consolidateOakvilleCourts(features) {
  /** @type {Map<string, import('./oakville-types').ArcGISFeature[]>} */
  const groups = new Map();

  for (const feature of features) {
    const attrs = feature.attributes;
    const key =
      attrs.PARK_ID?.trim() ||
      attrs.PARENTPARKNAME?.trim() ||
      normalizeParkKey(attrs.NAME ?? "") ||
      attrs.NAME;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(feature);
  }

  return [...groups.entries()].map(([groupKey, groupFeatures]) => {
    const name = parkDisplayName(groupFeatures);
    const courtType = inferCourtType(groupFeatures);
    const numCourts = groupFeatures.reduce((sum, feature) => {
      const count =
        feature.attributes.PUBLICTENNISCOURTCOUNT ??
        feature.attributes.TENNISCOURTCOUNT ??
        1;
      return sum + Math.max(1, Number(count) || 1);
    }, 0);

    const lat =
      groupFeatures.reduce((sum, f) => sum + (f.geometry?.y ?? 0), 0) /
      groupFeatures.length;
    const lng =
      groupFeatures.reduce((sum, f) => sum + (f.geometry?.x ?? 0), 0) /
      groupFeatures.length;

    const address =
      groupFeatures.find((f) => f.attributes.ADDRESS)?.attributes.ADDRESS ??
      null;

    return {
      groupKey,
      name,
      address: address ? `${address}, Oakville, Ontario` : null,
      latitude: lat,
      longitude: lng,
      court_type: courtType,
      num_courts: Math.max(1, Math.min(numCourts, 8)),
      amenities: amenitiesForType(courtType),
      municipality: "Oakville",
      source: "oakville-arcgis",
      arcgis_feature_count: groupFeatures.length,
      arcgis_names: groupFeatures.map((f) => f.attributes.NAME),
    };
  });
}

/** Merge rows that resolved to the same park name (e.g. split GIS groups). */
function mergeByParkName(courts) {
  /** @type {Map<string, typeof courts[number]>} */
  const merged = new Map();

  for (const court of courts) {
    const key = normalizeParkKey(court.name);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...court });
      continue;
    }

    existing.num_courts = Math.min(
      8,
      existing.num_courts + court.num_courts
    );
    existing.arcgis_feature_count += court.arcgis_feature_count;
    existing.arcgis_names = [
      ...existing.arcgis_names,
      ...court.arcgis_names,
    ];
    if (existing.court_type !== court.court_type) {
      existing.court_type = "both";
      existing.amenities = amenitiesForType("both");
    }
  }

  return [...merged.values()];
}

/** Fetch and consolidate all Oakville public court locations. */
export async function fetchOakvilleCourts() {
  const features = await fetchArcGISFeatures("1=1");
  return mergeByParkName(consolidateOakvilleCourts(features));
}

export function filterByRadius(courts, center, radiusKm) {
  const R = 6371;
  return courts.filter((court) => {
    if (!court.latitude || !court.longitude) return false;
    const dLat = ((court.latitude - center.lat) * Math.PI) / 180;
    const dLng = ((court.longitude - center.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((center.lat * Math.PI) / 180) *
        Math.cos((court.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const dist = 2 * R * Math.asin(Math.sqrt(a));
    return dist <= radiusKm;
  });
}
