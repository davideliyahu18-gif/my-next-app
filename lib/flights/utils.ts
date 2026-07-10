import type { FlightDayScope, FlightRecord } from "./types";
import { FLIGHTS_TIMEZONE } from "./constants";

const israelDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: FLIGHTS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getIsraelDayKey(date = new Date()): string {
  return israelDayFormatter.format(date);
}

export function shiftIsraelDayKey(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function resolveFlightDayKey(scope: FlightDayScope): string | null {
  const today = getIsraelDayKey();
  if (scope === "today") return today;
  if (scope === "tomorrow") return shiftIsraelDayKey(today, 1);
  if (scope === "yesterday") return shiftIsraelDayKey(today, -1);
  return null;
}

export function filterFlightsByDay(
  flights: FlightRecord[],
  scope: FlightDayScope,
): FlightRecord[] {
  if (scope === "all") return flights;
  const dayKey = resolveFlightDayKey(scope);
  if (!dayKey) return flights;
  return flights.filter((flight) => flight.scheduledDay === dayKey);
}

export function sortFlightsForBoard(flights: FlightRecord[]): FlightRecord[] {
  return [...flights].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export function dayScopeLabel(scope: FlightDayScope): string {
  switch (scope) {
    case "today":
      return "היום";
    case "tomorrow":
      return "מחר";
    case "yesterday":
      return "אתמול";
    default:
      return "כל הימים";
  }
}

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  timeZone: FLIGHTS_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("he-IL", {
  timeZone: FLIGHTS_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateTimeFormatter = new Intl.DateTimeFormat("he-IL", {
  timeZone: FLIGHTS_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function parseFlightDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatFlightTime(value: string | null | undefined): string {
  const date = parseFlightDate(value);
  return date ? timeFormatter.format(date) : "—";
}

export function formatFlightDate(value: string | null | undefined): string {
  const date = parseFlightDate(value);
  return date ? dateFormatter.format(date) : "—";
}

export function formatFlightDateTime(value: string | null | undefined): string {
  const date = parseFlightDate(value);
  return date ? dateTimeFormatter.format(date) : "—";
}

export function formatDelay(minutes: number | null): string | null {
  if (minutes == null || minutes === 0) return null;
  if (minutes > 0) return `+${minutes} דק׳`;
  return `${minutes} דק׳`;
}

export function statusTone(
  flight: Pick<FlightRecord, "statusEn" | "statusHe" | "isDelayed" | "isCanceled">,
): "success" | "warning" | "danger" | "muted" | "info" {
  if (flight.isCanceled) return "danger";
  if (flight.isDelayed) return "warning";
  const key = `${flight.statusEn} ${flight.statusHe}`.toUpperCase();
  if (key.includes("LANDED") || key.includes("נחתה") || key.includes("DEPARTED") || key.includes("המריא")) {
    return "success";
  }
  if (key.includes("DELAY") || key.includes("עיכוב") || key.includes("הוקדמה")) {
    return "warning";
  }
  if (key.includes("NOT FINAL") || key.includes("לא סופי")) return "muted";
  return "info";
}

export function matchesFlightQuery(flight: FlightRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    flight.flightCode,
    flight.airlineCode,
    flight.flightNumber,
    flight.airlineName,
    flight.airportCode,
    flight.airportNameHe,
    flight.airportNameEn,
    flight.countryHe,
    flight.countryEn,
    flight.terminal,
    flight.statusHe,
    flight.statusEn,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}
