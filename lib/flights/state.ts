import { FLIGHTS_CACHE_TTL_MS } from "./constants";
import { fetchFlightsFromSource } from "./api";
import type { FlightRecord, FlightsSnapshot } from "./types";

type CachedFlights = {
  snapshot: FlightsSnapshot;
  fetchedAt: number;
  inflight: Promise<FlightsSnapshot> | null;
};

const globalRef = globalThis as typeof globalThis & {
  __flightsCache?: CachedFlights;
};

function buildStats(flights: FlightRecord[]) {
  const arrivals = flights.filter((flight) => flight.direction === "arrival");
  const departures = flights.filter((flight) => flight.direction === "departure");

  return {
    total: flights.length,
    arrivals: arrivals.length,
    departures: departures.length,
    delayed: flights.filter((flight) => flight.isDelayed).length,
    canceled: flights.filter((flight) => flight.isCanceled).length,
    landed: arrivals.filter((flight) =>
      `${flight.statusEn} ${flight.statusHe}`.match(/LANDED|נחתה/i),
    ).length,
    departed: departures.filter((flight) =>
      `${flight.statusEn} ${flight.statusHe}`.match(/DEPARTED|המריא/i),
    ).length,
  };
}

function buildSnapshot(
  flights: FlightRecord[],
  sourceUpdatedAt: string | null,
  ok = true,
  error?: string,
): FlightsSnapshot {
  const arrivals = flights.filter((flight) => flight.direction === "arrival");
  const departures = flights.filter((flight) => flight.direction === "departure");

  return {
    ok,
    flights,
    arrivals,
    departures,
    stats: buildStats(flights),
    timestamp: new Date().toISOString(),
    sourceUpdatedAt,
    source: "data.gov.il",
    error,
  };
}

function getCache(): CachedFlights {
  if (!globalRef.__flightsCache) {
    globalRef.__flightsCache = {
      snapshot: buildSnapshot([], null, false, "not loaded"),
      fetchedAt: 0,
      inflight: null,
    };
  }
  return globalRef.__flightsCache;
}

async function refreshFlights(force = false): Promise<FlightsSnapshot> {
  const cache = getCache();
  const age = Date.now() - cache.fetchedAt;

  if (!force && cache.fetchedAt > 0 && age < FLIGHTS_CACHE_TTL_MS) {
    return cache.snapshot;
  }

  if (cache.inflight) {
    return cache.inflight;
  }

  cache.inflight = (async () => {
    try {
      const { flights, sourceUpdatedAt } = await fetchFlightsFromSource();
      const snapshot = buildSnapshot(flights, sourceUpdatedAt, true);
      cache.snapshot = snapshot;
      cache.fetchedAt = Date.now();
      return snapshot;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "failed to fetch flights";

      if (cache.fetchedAt > 0 && cache.snapshot.flights.length > 0) {
        cache.snapshot = {
          ...cache.snapshot,
          ok: false,
          timestamp: new Date().toISOString(),
          error: message,
        };
        return cache.snapshot;
      }

      const snapshot = buildSnapshot([], null, false, message);
      cache.snapshot = snapshot;
      cache.fetchedAt = Date.now();
      return snapshot;
    } finally {
      cache.inflight = null;
    }
  })();

  return cache.inflight;
}

export async function getFlightsSnapshot(force = false): Promise<FlightsSnapshot> {
  return refreshFlights(force);
}
