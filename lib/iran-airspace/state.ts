import { fetchAircraftFromProviders } from "./adsb-provider";
import { MovementTracker } from "./interesting-movements";
import { SERVER_CACHE_TTL_MS } from "./constants";
import type {
  Aircraft,
  AircraftSnapshot,
  ConnectionState,
  ProviderName,
  SystemStatus,
} from "./types";

type Catalog = {
  aircraft: Aircraft[];
  source: ProviderName | null;
  fellBack: boolean;
  fetchedAt: number;
  lastSuccessAt: number | null;
  lastFetchDurationMs: number | null;
  consecutiveFailures: number;
  lastError: string | null;
  inflight: Promise<Catalog> | null;
  tracker: MovementTracker;
};

const globalRef = globalThis as typeof globalThis & {
  __iranAirspaceCatalog?: Catalog;
};

function getCatalog(): Catalog {
  if (!globalRef.__iranAirspaceCatalog) {
    globalRef.__iranAirspaceCatalog = {
      aircraft: [],
      source: null,
      fellBack: false,
      fetchedAt: 0,
      lastSuccessAt: null,
      lastFetchDurationMs: null,
      consecutiveFailures: 0,
      lastError: null,
      inflight: null,
      tracker: new MovementTracker(),
    };
  }
  return globalRef.__iranAirspaceCatalog;
}

async function refresh(force: boolean): Promise<Catalog> {
  const catalog = getCatalog();
  const age = Date.now() - catalog.fetchedAt;

  if (!force && catalog.fetchedAt > 0 && age < SERVER_CACHE_TTL_MS) {
    return catalog;
  }
  if (catalog.inflight) {
    return catalog.inflight;
  }

  catalog.inflight = (async () => {
    const started = Date.now();
    try {
      const { aircraft, source, fellBack } = await fetchAircraftFromProviders();
      catalog.aircraft = aircraft;
      catalog.source = source;
      catalog.fellBack = fellBack;
      catalog.fetchedAt = Date.now();
      catalog.lastSuccessAt = catalog.fetchedAt;
      catalog.lastFetchDurationMs = catalog.fetchedAt - started;
      catalog.consecutiveFailures = 0;
      catalog.lastError = null;
      return catalog;
    } catch (error) {
      catalog.fetchedAt = Date.now();
      catalog.lastFetchDurationMs = catalog.fetchedAt - started;
      catalog.consecutiveFailures += 1;
      catalog.lastError = error instanceof Error ? error.message : String(error);
      return catalog;
    } finally {
      catalog.inflight = null;
    }
  })();

  return catalog.inflight;
}

function buildStats(aircraft: Aircraft[]) {
  return {
    total: aircraft.length,
    military: aircraft.filter((a) => a.category === "military").length,
    tanker: aircraft.filter((a) => a.category === "tanker").length,
    intel: aircraft.filter((a) => a.category === "intel").length,
    civil: aircraft.filter((a) => a.category === "civil").length,
    withCallsign: aircraft.filter((a) => Boolean(a.callsign)).length,
    withRegistration: aircraft.filter((a) => Boolean(a.registration)).length,
  };
}

export async function getAircraftSnapshot(
  options: { force?: boolean } = {},
): Promise<AircraftSnapshot> {
  const catalog = await refresh(options.force === true);
  const hasData = catalog.aircraft.length > 0;
  const ok = hasData && catalog.consecutiveFailures === 0;
  const interesting = hasData ? catalog.tracker.detect(catalog.aircraft) : [];

  return {
    ok,
    aircraft: catalog.aircraft,
    interesting,
    source: catalog.source,
    fellBackToSecondary: catalog.fellBack,
    partial: !hasData && catalog.consecutiveFailures > 0,
    stats: buildStats(catalog.aircraft),
    timestamp: new Date().toISOString(),
    error: catalog.lastError ?? undefined,
  };
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const catalog = getCatalog();
  let connection: ConnectionState = "down";
  if (catalog.aircraft.length > 0 && catalog.consecutiveFailures === 0) {
    connection =
      catalog.lastFetchDurationMs != null && catalog.lastFetchDurationMs > 5000
        ? "degraded"
        : "connected";
  } else if (catalog.aircraft.length > 0) {
    connection = "degraded";
  }

  return {
    connection,
    activeSource: catalog.source,
    lastUpdate: catalog.lastSuccessAt ? new Date(catalog.lastSuccessAt).toISOString() : null,
    lastSuccessfulFetchMs: catalog.lastFetchDurationMs,
    consecutiveFailures: catalog.consecutiveFailures,
  };
}
