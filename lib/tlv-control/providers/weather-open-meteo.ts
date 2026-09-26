import { getOrCreateCache } from "../cache/ttl-cache";
import { trackSource } from "../utils/source-health";
import { BGN_COORDS } from "../utils/geo";
import type { WeatherSnapshot } from "../types";

const FETCH_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 5 * 60_000;

const CURRENT_VARS = "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation";
const HOURLY_VARS = "temperature_2m,precipitation,wind_speed_10m,visibility";

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    wind_gusts_10m?: number;
    cloud_cover?: number;
    precipitation?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation?: number[];
    wind_speed_10m?: number[];
    visibility?: number[];
  };
};

async function fetchFromSource(): Promise<Omit<WeatherSnapshot, "timestamp" | "ok">> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${BGN_COORDS.lat}&longitude=${BGN_COORDS.lon}` +
      `&current=${CURRENT_VARS}&hourly=${HOURLY_VARS}&forecast_days=1&timezone=Asia%2FJerusalem`;
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);

    const data = (await response.json()) as OpenMeteoResponse;
    const current = data.current ?? {};
    const hourly = data.hourly ?? {};
    const times = hourly.time ?? [];

    const nowHourIndex = (() => {
      const nowIso = new Date().toISOString().slice(0, 13);
      const idx = times.findIndex((t) => t.slice(0, 13) === nowIso);
      return idx >= 0 ? idx : 0;
    })();

    return {
      temperatureC: current.temperature_2m ?? null,
      windSpeedKmh: current.wind_speed_10m ?? null,
      windDirectionDeg: current.wind_direction_10m ?? null,
      windGustKmh: current.wind_gusts_10m ?? null,
      humidityPct: current.relative_humidity_2m ?? null,
      cloudCoverPct: current.cloud_cover ?? null,
      precipitationMm: current.precipitation ?? null,
      visibilityM: hourly.visibility?.[nowHourIndex] ?? null,
      hourly: times.slice(nowHourIndex, nowHourIndex + 12).map((time, i) => ({
        time,
        temperatureC: hourly.temperature_2m?.[nowHourIndex + i] ?? null,
        precipitationMm: hourly.precipitation?.[nowHourIndex + i] ?? null,
        windSpeedKmh: hourly.wind_speed_10m?.[nowHourIndex + i] ?? null,
      })),
    };
  } finally {
    clearTimeout(timeout);
  }
}

const cache = getOrCreateCache("open-meteo", CACHE_TTL_MS, () => trackSource("open-meteo", fetchFromSource));

export async function getWeatherSnapshot(force = false): Promise<WeatherSnapshot> {
  try {
    const data = await cache.get(force);
    return { ok: true, ...data, timestamp: new Date().toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stale = cache.peek();
    if (stale) return { ok: false, ...stale, timestamp: new Date().toISOString(), error: message };
    return {
      ok: false,
      temperatureC: null,
      windSpeedKmh: null,
      windDirectionDeg: null,
      windGustKmh: null,
      humidityPct: null,
      cloudCoverPct: null,
      precipitationMm: null,
      visibilityM: null,
      hourly: [],
      timestamp: new Date().toISOString(),
      error: message,
    };
  }
}
