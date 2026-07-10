import { FLIGHTS_CACHE_TTL_MS } from "./constants";
import { fetchFlightsFromSource } from "./api";
import type { FlightDayScope, FlightRecord, FlightsSnapshot } from "./types";
import {
  filterFlightsByDay,
  resolveFlightDayKey,
  sortFlightsForBoard,
} from "./utils";

type FlightsCatalog = {
  flights: FlightRecord[];
  sourceUpdatedAt: string | null;
  fetchedAt: number;
  inflight: Promise<FlightsCatalog> | null;
};

const globalRef = globalThis as typeof globalThis & {
  __flightsCatalog?: FlightsCatalog;
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
  allFlights: FlightRecord[],
  sourceUpdatedAt: string | null,
  dayScope: FlightDayScope,
  ok = true,
  error?: string,
): FlightsSnapshot {
  const scoped = sortFlightsForBoard(filterFlightsByDay(allFlights, dayScope));
  const arrivals = scoped.filter((flight) => flight.direction === "arrival");
  const departures = scoped.filter((flight) => flight.direction === "departure");

  return {
    ok,
    dayScope,
    dayKey: resolveFlightDayKey(dayScope),
    catalogTotal: allFlights.length,
    flights: scoped,
    arrivals,
    departures,
    stats: buildStats(scoped),
    timestamp: new Date().toISOString(),
    sourceUpdatedAt,
    source: "data.gov.il",
    error,
  };
}

function getCatalog(): FlightsCatalog {
  if (!globalRef.__flightsCatalog) {
    globalRef.__flightsCatalog = {
      flights: [],
      sourceUpdatedAt: null,
      fetchedAt: 0,
      inflight: null,
    };
  }
  return globalRef.__flightsCatalog;
}

async function refreshCatalog(force = false): Promise<FlightsCatalog> {
  const catalog = getCatalog();
  const age = Date.now() - catalog.fetchedAt;

  if (!force && catalog.fetchedAt > 0 && age < FLIGHTS_CACHE_TTL_MS) {
    return catalog;
  }

  if (catalog.inflight) {
    return catalog.inflight;
  }

  catalog.inflight = (async () => {
    try {
      const { flights, sourceUpdatedAt } = await fetchFlightsFromSource();
      catalog.flights = flights;
      catalog.sourceUpdatedAt = sourceUpdatedAt;
      catalog.fetchedAt = Date.now();
      return catalog;
    } catch (error) {
      catalog.fetchedAt = Date.now();
      throw error;
    } finally {
      catalog.inflight = null;
    }
  })();

  return catalog.inflight;
}

export function parseFlightDayScope(value: string | null | undefined): FlightDayScope {
  if (value === "tomorrow" || value === "yesterday" || value === "all") {
    return value;
  }
  return "today";
}

export async function getFlightsSnapshot(
  options: { force?: boolean; dayScope?: FlightDayScope } = {},
): Promise<FlightsSnapshot> {
  const dayScope = options.dayScope ?? "today";
  const catalog = getCatalog();

  try {
    const fresh = await refreshCatalog(options.force === true);
    return buildSnapshot(
      fresh.flights,
      fresh.sourceUpdatedAt,
      dayScope,
      true,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to fetch flights";

    if (catalog.flights.length > 0) {
      return {
        ...buildSnapshot(
          catalog.flights,
          catalog.sourceUpdatedAt,
          dayScope,
          false,
          message,
        ),
        timestamp: new Date().toISOString(),
      };
    }

    return buildSnapshot([], null, dayScope, false, message);
  }
}

export async function findTrackedFlights(
  codes: string[],
  force = false,
): Promise<FlightRecord[]> {
  const normalized = [
    ...new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean)),
  ];
  if (!normalized.length) return [];

  const catalog = await refreshCatalog(force);
  return sortFlightsForBoard(
    catalog.flights.filter((flight) =>
      normalized.includes(flight.flightCode.toUpperCase()),
    ),
  );
}
