import {
  FLIGHTS_API_URL,
  FLIGHTS_USER_AGENT,
} from "./constants";
import type { FlightDirection, FlightRecord } from "./types";

type RawFlightRow = {
  CHOPER?: string;
  CHFLTN?: string | number;
  CHOPERD?: string;
  CHSTOL?: string;
  CHPTOL?: string;
  CHAORD?: string;
  CHLOC1?: string;
  CHLOC1D?: string;
  CHLOC1TH?: string;
  CHLOC1T?: string;
  CHLOC1CH?: string;
  CHLOCCT?: string;
  CHTERM?: string | number;
  CHCKZN?: string;
  CHCINT?: string;
  CHRMINE?: string;
  CHRMINH?: string;
};

type DataGovResponse = {
  success?: boolean;
  result?: {
    records?: RawFlightRow[];
    total?: number;
  };
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function delayMinutes(scheduled: string, actual: string | null | undefined): number | null {
  const scheduledAt = parseDate(scheduled);
  const actualAt = parseDate(actual);
  if (!scheduledAt || !actualAt) return null;
  return Math.round((actualAt.getTime() - scheduledAt.getTime()) / 60_000);
}

function normalizeDirection(value: string | null | undefined): FlightDirection {
  return value?.toUpperCase() === "D" ? "departure" : "arrival";
}

function isCanceled(statusEn: string, statusHe: string): boolean {
  const key = `${statusEn} ${statusHe}`.toUpperCase();
  return key.includes("CANCEL") || key.includes("מבוטל");
}

function isDelayed(
  statusEn: string,
  statusHe: string,
  delay: number | null,
): boolean {
  const key = `${statusEn} ${statusHe}`.toUpperCase();
  if (key.includes("DELAY") || key.includes("עיכוב") || key.includes("הוקדמה")) {
    return true;
  }
  return delay != null && delay >= 15;
}

export function normalizeFlightRow(row: RawFlightRow): FlightRecord | null {
  const airlineCode = String(row.CHOPER || "").trim();
  const flightNumber = String(row.CHFLTN ?? "").trim();
  const scheduledAt = String(row.CHSTOL || "").trim();

  if (!airlineCode || !flightNumber || !scheduledAt) return null;

  const direction = normalizeDirection(row.CHAORD);
  const actualAt = row.CHPTOL ? String(row.CHPTOL).trim() : null;
  const statusEn = String(row.CHRMINE || "").trim();
  const statusHe = String(row.CHRMINH || "").trim();
  const delay = delayMinutes(scheduledAt, actualAt);
  const flightCode = `${airlineCode}${flightNumber}`;

  return {
    id: `${flightCode}-${direction === "arrival" ? "A" : "D"}-${scheduledAt}`,
    airlineCode,
    flightNumber,
    flightCode,
    airlineName: String(row.CHOPERD || airlineCode).trim(),
    scheduledDay: scheduledAt.slice(0, 10),
    scheduledAt,
    actualAt,
    direction,
    airportCode: String(row.CHLOC1 || "").trim(),
    airportNameHe: String(row.CHLOC1TH || row.CHLOC1T || row.CHLOC1D || "").trim(),
    airportNameEn: String(row.CHLOC1D || row.CHLOC1T || "").trim(),
    countryHe: String(row.CHLOC1CH || "").trim(),
    countryEn: String(row.CHLOCCT || "").trim(),
    terminal: row.CHTERM != null && row.CHTERM !== "None" ? String(row.CHTERM) : null,
    checkInZone: row.CHCKZN && row.CHCKZN !== "None" ? String(row.CHCKZN) : null,
    checkInCounters:
      row.CHCINT && row.CHCINT !== "None" ? String(row.CHCINT) : null,
    statusEn,
    statusHe,
    delayMinutes: delay,
    isDelayed: isDelayed(statusEn, statusHe, delay),
    isCanceled: isCanceled(statusEn, statusHe),
  };
}

export async function fetchFlightsFromSource(): Promise<{
  flights: FlightRecord[];
  sourceUpdatedAt: string | null;
}> {
  const response = await fetch(FLIGHTS_API_URL, {
    headers: {
      "User-Agent": FLIGHTS_USER_AGENT,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`flydata HTTP ${response.status}`);
  }

  const payload = (await response.json()) as DataGovResponse;
  if (!payload.success) {
    throw new Error("flydata API returned success=false");
  }

  const rows = payload.result?.records ?? [];
  const flights = rows
    .map(normalizeFlightRow)
    .filter((flight): flight is FlightRecord => Boolean(flight))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  const sourceUpdatedAt =
    flights.length > 0
      ? flights.reduce((latest, flight) => {
          const actual = flight.actualAt || flight.scheduledAt;
          return actual > latest ? actual : latest;
        }, flights[0].scheduledAt)
      : null;

  return { flights, sourceUpdatedAt };
}
