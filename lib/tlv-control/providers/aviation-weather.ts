import { getOrCreateCache } from "../cache/ttl-cache";
import { trackSource } from "../utils/source-health";
import { BGN_ICAO } from "../utils/geo";
import type { AviationWeatherSnapshot } from "../types";

const FETCH_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 5 * 60_000;

/** aviationweather.gov's public Data API (NOAA/FAA) — free, no key. Field
 * names are read defensively since the API doesn't publish a strict schema
 * guarantee across the variants seen in the wild. */
type RawReport = Record<string, unknown>;

function pick(row: RawReport, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickTime(row: RawReport, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number") return new Date(value * 1000).toISOString();
    if (typeof value === "string" && value.trim()) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  return null;
}

async function fetchJson(url: string, controller: AbortController): Promise<unknown> {
  const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`aviationweather.gov HTTP ${response.status}`);
  return response.json();
}

async function fetchFromSource(): Promise<Omit<AviationWeatherSnapshot, "timestamp" | "ok" | "station">> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const [metarData, tafData] = await Promise.all([
      fetchJson(`https://aviationweather.gov/api/data/metar?ids=${BGN_ICAO}&format=json`, controller),
      fetchJson(`https://aviationweather.gov/api/data/taf?ids=${BGN_ICAO}&format=json`, controller),
    ]);

    const metarRow = Array.isArray(metarData) ? (metarData[0] as RawReport | undefined) : undefined;
    const tafRow = Array.isArray(tafData) ? (tafData[0] as RawReport | undefined) : undefined;

    return {
      metarRaw: metarRow ? pick(metarRow, ["rawOb", "raw_text", "rawText"]) : null,
      metarObservedAt: metarRow ? pickTime(metarRow, ["obsTime", "observation_time", "reportTime"]) : null,
      tafRaw: tafRow ? pick(tafRow, ["rawTAF", "raw_text", "rawText"]) : null,
      tafIssuedAt: tafRow ? pickTime(tafRow, ["issueTime", "issue_time", "bulletinTime"]) : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

const cache = getOrCreateCache("aviation-weather", CACHE_TTL_MS, () => trackSource("aviation-weather", fetchFromSource));

export async function getAviationWeatherSnapshot(force = false): Promise<AviationWeatherSnapshot> {
  try {
    const data = await cache.get(force);
    return { ok: true, station: BGN_ICAO, ...data, timestamp: new Date().toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stale = cache.peek();
    if (stale) return { ok: false, station: BGN_ICAO, ...stale, timestamp: new Date().toISOString(), error: message };
    return {
      ok: false,
      station: BGN_ICAO,
      metarRaw: null,
      metarObservedAt: null,
      tafRaw: null,
      tafIssuedAt: null,
      timestamp: new Date().toISOString(),
      error: message,
    };
  }
}
