import type { AircraftFilters, MapBounds } from "./types";

export const SITE_TITLE_HE = "מערכת מעקב אווירי סביב איראן";
export const SITE_SUBTITLE_HE = "מעקב אחר תנועות אוויריות ממקורות ADS-B ציבוריים";

/** Region covering Iran and its neighbors, used for map framing + queries. */
export const REGION_BOUNDS: MapBounds = {
  north: 42.8,
  south: 15,
  west: 25,
  east: 70,
};

export const REGION_CENTER: [number, number] = [29, 51];
export const REGION_DEFAULT_ZOOM = 5;

/** Query grid: circle centers (nm radius 250, the max the providers allow). */
export const QUERY_GRID: { lat: number; lon: number; radiusNm: number }[] = [
  { lat: 34.0, lon: 51.0, radiusNm: 250 }, // Tehran / north Iran / Caspian
  { lat: 29.0, lon: 52.0, radiusNm: 250 }, // south Iran / Persian Gulf
  { lat: 24.5, lon: 55.5, radiusNm: 250 }, // UAE / Oman / Hormuz
  { lat: 33.0, lon: 44.0, radiusNm: 250 }, // Iraq / Kuwait
  { lat: 38.0, lon: 40.0, radiusNm: 250 }, // east Turkey / north Iraq
  { lat: 27.0, lon: 62.0, radiusNm: 250 }, // SE Iran / Pakistan / Gulf of Oman
];

export const REFRESH_INTERVAL_MS = 10_000;
export const FETCH_TIMEOUT_MS = 8_000;
export const SERVER_CACHE_TTL_MS = 9_000;
export const HISTORY_WINDOW_MS = 15 * 60_000;
export const TRAIL_MAX_POINTS = 200;

export const ADSB_FI_BASE = "https://opendata.adsb.fi/api/v3";
export const ADSB_LOL_BASE = "https://api.adsb.lol/v2";

export const CATEGORY_LABELS_HE: Record<string, string> = {
  civil: "אזרחי",
  military: "צבאי",
  tanker: "תדלוק / מעקב",
  intel: "מודיעין / מעקב",
};

export const CATEGORY_COLORS: Record<string, string> = {
  civil: "#3b82f6",
  military: "#ef4444",
  tanker: "#f97316",
  intel: "#a855f7",
};

/** Keyword heuristics applied to a military-flagged aircraft's public type
 * description to sub-classify it. Purely descriptive of aircraft type — no
 * inference is made about intent or mission. */
export const TANKER_KEYWORDS = [
  "STRATOTANKER",
  "KC-135",
  "KC135",
  "KC-10",
  "KC10",
  "KC-46",
  "KC46",
  "VOYAGER",
  "MRTT",
  "A330 MRTT",
];

export const INTEL_KEYWORDS = [
  "SENTRY",
  "AWACS",
  "HAWKEYE",
  "E-2",
  "E-3",
  "RIVET JOIN",
  "RC-135",
  "GLOBAL HAWK",
  "RQ-4",
  "TRITON",
  "MQ-4",
  "POSEIDON",
  "P-8",
  "P8",
  "REAPER",
  "MQ-9",
  "PREDATOR",
  "MQ-1",
  "JSTARS",
  "E-8",
  "GUARDRAIL",
];

/** Exact ICAO type-designator ("t" field) matches — a more reliable signal
 * than the free-text description, which many feeds leave empty even for
 * aircraft already flagged military. Only consulted once dbFlags already
 * marks the aircraft military, so overlap with civilian-only designators
 * (e.g. A332 also being a plain Airbus A330) is not a false-positive risk. */
export const TANKER_TYPE_CODES = [
  "K35R",
  "K35T",
  "K35E",
  "K35A",
  "KC10",
  "K10A",
  "KC46",
  "B462",
  "B463",
  "A332",
  "A333",
  "A330",
];

export const INTEL_TYPE_CODES = [
  "E3",
  "E3CF",
  "E3TF",
  "E3TS",
  "E2",
  "E2C",
  "E2D",
  "R135",
  "RC135",
  "P8",
  "P8A",
  "RQ4",
  "GLOB",
  "MQ9",
  "MQ4",
  "MQ4C",
  "MQ1",
  "E8",
  "JSTR",
];

export const REASON_LABELS_HE: Record<string, string> = {
  "new-in-range": "נכנס עכשיו לטווח המפה",
  "altitude-change": "שינוי גובה משמעותי",
  "heading-change": "שינוי כיוון משמעותי",
  "high-speed": "מהירות גבוהה יחסית",
  "re-entered-area": "נראה שוב באזור",
  "holding-pattern": "דפוס המתנה (Holding)",
  "unusual-route": "מסלול שונה מהרגיל",
};

/** Well-known, publicly documented airfields shown as neutral reference
 * points on the map (name + location only — no radius/coverage overlays). */
export const REFERENCE_AIRFIELDS: { name: string; lat: number; lon: number }[] = [
  { name: "בסיס תבריז", lat: 38.13, lon: 46.24 },
  { name: "בסיס המדאן", lat: 34.87, lon: 48.55 },
  { name: "בסיס דיזפול", lat: 32.43, lon: 48.38 },
  { name: "בסיס בנדר עבאס", lat: 27.22, lon: 56.38 },
  { name: "בסיס אספהאן", lat: 32.75, lon: 51.86 },
  { name: "בסיס אל עודיד", lat: 25.12, lon: 51.32 },
  { name: "בסיס אל דפרה", lat: 24.25, lon: 54.55 },
  { name: "בסיס אינג'ירליק", lat: 37.0, lon: 35.43 },
];

export const ALERT_FEED_MAX = 60;
export const TIMELINE_HISTORY_MAX = 90;

export const DEFAULT_FILTERS: AircraftFilters = {
  showAircraft: true,
  showTrails: true,
  showLabels: true,
  showNoCallsign: true,
  showCivil: true,
  showMilitary: true,
  showTanker: true,
  showIntel: true,
  callsign: "",
  registration: "",
  icao: "",
  aircraftType: "",
  minAltitude: "",
  maxAltitude: "",
  minSpeed: "",
};
