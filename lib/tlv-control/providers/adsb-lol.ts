import { BGN_COORDS } from "../utils/geo";
import { ADSB_FETCH_HEADERS } from "../utils/http";
import type { Aircraft } from "../types";

const ADSB_LOL_BASE = "https://api.adsb.lol/v2";
const FETCH_TIMEOUT_MS = 8_000;

/** Raw shape returned by adsb.lol (tar1090-style aircraft.json schema). */
type RawAircraft = {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  alt_baro?: number | "ground";
  alt_geom?: number;
  gs?: number;
  track?: number;
  true_heading?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  lat?: number;
  lon?: number;
};

function normalize(raw: RawAircraft, nowIso: string): Aircraft | null {
  const id = raw.hex?.trim().toLowerCase();
  if (!id) return null;
  if (typeof raw.lat !== "number" || typeof raw.lon !== "number") return null;

  const onGround = raw.alt_baro === "ground";
  const altitude =
    typeof raw.alt_baro === "number"
      ? raw.alt_baro
      : typeof raw.alt_geom === "number"
        ? raw.alt_geom
        : onGround
          ? 0
          : null;

  return {
    id,
    callsign: raw.flight?.trim() || null,
    registration: raw.r?.trim().toUpperCase() || null,
    latitude: raw.lat,
    longitude: raw.lon,
    altitude,
    onGround,
    groundSpeed: typeof raw.gs === "number" ? Math.round(raw.gs) : null,
    heading:
      typeof raw.true_heading === "number"
        ? raw.true_heading
        : typeof raw.track === "number"
          ? raw.track
          : null,
    verticalRate:
      typeof raw.baro_rate === "number"
        ? raw.baro_rate
        : typeof raw.geom_rate === "number"
          ? raw.geom_rate
          : null,
    squawk: raw.squawk?.trim() || null,
    aircraftType: raw.t?.trim().toUpperCase() || null,
    lastSeen: nowIso,
    source: "adsb.lol",
  };
}

export async function fetchAdsbLol(radiusNm: number): Promise<Aircraft[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = `${ADSB_LOL_BASE}/lat/${BGN_COORDS.lat}/lon/${BGN_COORDS.lon}/dist/${radiusNm}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: ADSB_FETCH_HEADERS,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`adsb.lol HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { ac?: RawAircraft[] };
    const nowIso = new Date().toISOString();
    // An empty list is a legitimate (if unlikely, this close to a major
    // airport) result — only a failed request should trigger fallback.
    return (payload.ac ?? [])
      .map((raw) => normalize(raw, nowIso))
      .filter((a): a is Aircraft => a !== null);
  } finally {
    clearTimeout(timeout);
  }
}
