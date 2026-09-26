import { BGN_COORDS, bboxAroundNm } from "../utils/geo";
import type { Aircraft } from "../types";

const OPENSKY_URL = "https://opensky-network.org/api/states/all";
const FETCH_TIMEOUT_MS = 8_000;

/** OpenSky's "states/all" returns each aircraft as a fixed-position array,
 * not an object — index constants document the shape (see OpenSky REST API
 * docs, "OpenSkyStateVector"). */
const IDX = {
  icao24: 0,
  callsign: 1,
  timePosition: 3,
  lastContact: 4,
  longitude: 5,
  latitude: 6,
  baroAltitude: 7,
  onGround: 8,
  velocity: 9,
  trueTrack: 10,
  verticalRate: 11,
  geoAltitude: 13,
  squawk: 14,
} as const;

type OpenSkyState = (string | number | boolean | null)[];

function normalize(state: OpenSkyState, nowIso: string): Aircraft | null {
  const id = String(state[IDX.icao24] ?? "").trim().toLowerCase();
  const lat = state[IDX.latitude];
  const lon = state[IDX.longitude];
  if (!id || typeof lat !== "number" || typeof lon !== "number") return null;

  const onGround = Boolean(state[IDX.onGround]);
  const baroAlt = state[IDX.baroAltitude];
  const geoAlt = state[IDX.geoAltitude];
  const altitudeMeters = typeof baroAlt === "number" ? baroAlt : typeof geoAlt === "number" ? geoAlt : null;
  const velocityMs = state[IDX.velocity];
  const verticalRateMs = state[IDX.verticalRate];

  return {
    id,
    callsign: typeof state[IDX.callsign] === "string" ? (state[IDX.callsign] as string).trim() || null : null,
    registration: null, // OpenSky's public feed does not include registration
    latitude: lat,
    longitude: lon,
    altitude: onGround ? 0 : altitudeMeters != null ? Math.round(altitudeMeters * 3.28084) : null,
    onGround,
    groundSpeed: typeof velocityMs === "number" ? Math.round(velocityMs * 1.94384) : null,
    heading: typeof state[IDX.trueTrack] === "number" ? (state[IDX.trueTrack] as number) : null,
    verticalRate: typeof verticalRateMs === "number" ? Math.round(verticalRateMs * 196.85) : null,
    squawk: typeof state[IDX.squawk] === "string" ? (state[IDX.squawk] as string) : null,
    aircraftType: null, // not provided by the public states/all endpoint
    lastSeen: nowIso,
    source: "opensky",
  };
}

export async function fetchOpenSky(radiusNm: number): Promise<Aircraft[]> {
  const box = bboxAroundNm(BGN_COORDS, radiusNm);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = `${OPENSKY_URL}?lamin=${box.minLat}&lomin=${box.minLon}&lamax=${box.maxLat}&lomax=${box.maxLon}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`OpenSky HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { states?: OpenSkyState[] };
    const nowIso = new Date().toISOString();
    return (payload.states ?? [])
      .map((state) => normalize(state, nowIso))
      .filter((a): a is Aircraft => a !== null);
  } finally {
    clearTimeout(timeout);
  }
}
