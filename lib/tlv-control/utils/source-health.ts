import type { SourceHealthEntry, SourceHealthStatus, SourceKey } from "../types";

const SOURCE_LABELS: Record<SourceKey, string> = {
  "adsb.lol": "ADSB.lol",
  opensky: "OpenSky Network",
  "bgn-flights": "מידע טיסות נתב״ג (data.gov.il)",
  "open-meteo": "Open-Meteo",
  "aviation-weather": "Aviation Weather Center",
  oref: "התרעות פיקוד העורף",
};

/** Data older than this is shown as "stale", not live. */
const STALE_AFTER_MS = 5 * 60_000;

type MutableEntry = {
  lastSuccessfulUpdate: number | null;
  lastAttempt: number | null;
  latencyMs: number | null;
  error: string | null;
  unavailableReason: string | null;
};

function store(): Map<SourceKey, MutableEntry> {
  const globalRef = globalThis as typeof globalThis & {
    __tlvSourceHealth?: Map<SourceKey, MutableEntry>;
  };
  if (!globalRef.__tlvSourceHealth) globalRef.__tlvSourceHealth = new Map();
  return globalRef.__tlvSourceHealth;
}

function getOrInit(key: SourceKey): MutableEntry {
  const map = store();
  let entry = map.get(key);
  if (!entry) {
    entry = { lastSuccessfulUpdate: null, lastAttempt: null, latencyMs: null, error: null, unavailableReason: null };
    map.set(key, entry);
  }
  return entry;
}

/** Wraps a provider call, recording latency + success/failure for the health panel. */
export async function trackSource<T>(key: SourceKey, fn: () => Promise<T>): Promise<T> {
  const entry = getOrInit(key);
  const started = Date.now();
  entry.lastAttempt = started;
  try {
    const result = await fn();
    entry.latencyMs = Date.now() - started;
    entry.lastSuccessfulUpdate = Date.now();
    entry.error = null;
    return result;
  } catch (error) {
    entry.latencyMs = Date.now() - started;
    entry.error = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

/** For providers with no automatic fetch at all (e.g. Oref with no official
 * API) — marks the source as permanently unavailable with a stated reason. */
export function markPermanentlyUnavailable(key: SourceKey, reason: string) {
  const entry = getOrInit(key);
  entry.unavailableReason = reason;
}

function statusFor(entry: MutableEntry): SourceHealthStatus {
  if (entry.unavailableReason) return "unavailable";
  if (!entry.lastSuccessfulUpdate) return "unavailable";
  if (Date.now() - entry.lastSuccessfulUpdate > STALE_AFTER_MS) return "stale";
  return "connected";
}

export function getHealthSnapshot(): SourceHealthEntry[] {
  const keys: SourceKey[] = ["adsb.lol", "opensky", "bgn-flights", "open-meteo", "aviation-weather", "oref"];
  return keys.map((key) => {
    const entry = getOrInit(key);
    return {
      key,
      label: SOURCE_LABELS[key],
      status: statusFor(entry),
      lastSuccessfulUpdate: entry.lastSuccessfulUpdate ? new Date(entry.lastSuccessfulUpdate).toISOString() : null,
      lastAttempt: entry.lastAttempt ? new Date(entry.lastAttempt).toISOString() : null,
      latencyMs: entry.latencyMs,
      error: entry.unavailableReason ?? entry.error,
    };
  });
}
