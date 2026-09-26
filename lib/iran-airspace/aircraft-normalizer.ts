import { INTEL_KEYWORDS, INTEL_TYPE_CODES, TANKER_KEYWORDS, TANKER_TYPE_CODES } from "./constants";
import type { Aircraft, AircraftCategory, ProviderName } from "./types";
import { isWithinBounds } from "./geo";

/** Raw shape returned by adsb.fi / adsb.lol (tar1090 "v2/v3 aircraft.json"-style API). */
export type RawAdsbAircraft = {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  desc?: string;
  ownOp?: string;
  alt_baro?: number | "ground";
  alt_geom?: number;
  gs?: number;
  track?: number;
  true_heading?: number;
  mag_heading?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  lat?: number;
  lon?: number;
  seen?: number;
  seen_pos?: number;
  dbFlags?: number;
  category?: string;
};

const MILITARY_DB_FLAG = 1;

function classify(desc: string | null, typeCode: string | null, isMilitary: boolean): AircraftCategory {
  if (!isMilitary) return "civil";
  if (typeCode) {
    if (TANKER_TYPE_CODES.includes(typeCode)) return "tanker";
    if (INTEL_TYPE_CODES.includes(typeCode)) return "intel";
  }
  const haystack = (desc ?? "").toUpperCase();
  if (TANKER_KEYWORDS.some((k) => haystack.includes(k))) return "tanker";
  if (INTEL_KEYWORDS.some((k) => haystack.includes(k))) return "intel";
  return "military";
}

function guessCountry(registration: string | null): string | null {
  if (!registration) return null;
  const reg = registration.toUpperCase();
  const prefixes: [string, string][] = [
    ["EP-", "איראן"],
    ["YI-", "עיראק"],
    ["TC-", "טורקיה"],
    ["9K-", "כווית"],
    ["A7-", "קטאר"],
    ["A9C-", "בחריין"],
    ["A6-", "איחוד האמירויות"],
    ["A4O-", "עומאן"],
    ["HZ-", "ערב הסעודית"],
    ["AP-", "פקיסטן"],
    ["N", "ארה\"ב"],
  ];
  for (const [prefix, country] of prefixes) {
    if (reg.startsWith(prefix)) return country;
  }
  return null;
}

export function normalizeAircraft(
  raw: RawAdsbAircraft,
  source: ProviderName,
  nowIso: string,
): Aircraft | null {
  const hex = raw.hex?.trim().toLowerCase();
  if (!hex) return null;
  if (typeof raw.lat !== "number" || typeof raw.lon !== "number") return null;
  if (!isWithinBounds({ lat: raw.lat, lon: raw.lon })) return null;

  const onGround = raw.alt_baro === "ground";
  const altitude =
    typeof raw.alt_baro === "number"
      ? raw.alt_baro
      : typeof raw.alt_geom === "number"
        ? raw.alt_geom
        : onGround
          ? 0
          : null;

  const isMilitary = (raw.dbFlags ?? 0) & MILITARY_DB_FLAG ? true : false;
  const typeDescription = raw.desc?.trim() || null;
  const aircraftType = raw.t?.trim().toUpperCase() || null;
  const registration = raw.r?.trim().toUpperCase() || null;

  return {
    hex,
    callsign: raw.flight?.trim() || null,
    registration,
    aircraftType,
    typeDescription,
    category: classify(typeDescription, aircraftType, isMilitary),
    dbFlags: raw.dbFlags ?? 0,
    lat: raw.lat,
    lon: raw.lon,
    altitude,
    onGround,
    groundSpeed: typeof raw.gs === "number" ? Math.round(raw.gs) : null,
    heading:
      typeof raw.true_heading === "number"
        ? raw.true_heading
        : typeof raw.track === "number"
          ? raw.track
          : typeof raw.mag_heading === "number"
            ? raw.mag_heading
            : null,
    verticalRate:
      typeof raw.baro_rate === "number"
        ? raw.baro_rate
        : typeof raw.geom_rate === "number"
          ? raw.geom_rate
          : null,
    squawk: raw.squawk?.trim() || null,
    operator: raw.ownOp?.trim() || null,
    country: guessCountry(registration),
    lastSeen: nowIso,
    source,
  };
}
