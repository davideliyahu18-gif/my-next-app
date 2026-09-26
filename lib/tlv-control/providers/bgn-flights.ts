import { getOrCreateCache } from "../cache/ttl-cache";
import { trackSource } from "../utils/source-health";
import type { BgnFlight, BgnFlightsSnapshot, FlightDirection, FlightStatusTone } from "../types";

/** Official Israel Airports Authority flight feed, published on Israel's
 * open-data portal (data.gov.il) — a licensed public source, not scraping. */
const RESOURCE_ID = "e83f763b-b7d7-479e-b172-ae981ddc6de5";
const API_URL = `https://data.gov.il/api/3/action/datastore_search?resource_id=${RESOURCE_ID}&limit=3200`;
const USER_AGENT = "tlv-control-center/1.0";
const FETCH_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30_000;

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

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function delayMinutes(scheduled: string, actual: string | null): number | null {
  const s = parseDate(scheduled);
  const a = parseDate(actual);
  if (!s || !a) return null;
  return Math.round((a.getTime() - s.getTime()) / 60_000);
}

function classifyTone(statusEn: string, statusHe: string, delay: number | null): FlightStatusTone {
  const key = `${statusEn} ${statusHe}`.toUpperCase();
  if (key.includes("CANCEL") || key.includes("מבוטל")) return "delayed";
  if (key.includes("DELAY") || key.includes("עיכוב") || key.includes("הוקדמה") || (delay != null && delay >= 15)) {
    return "delayed";
  }
  if (key.includes("LANDED") || key.includes("נחת") || key.includes("DEPART") || key.includes("המריא")) {
    return "inProgress";
  }
  if (key.includes("GATE") || key.includes("CHANGE") || key.includes("עודכן") || key.includes("שונה") || key.includes("שער")) {
    return "info";
  }
  return "onTime";
}

function normalizeRow(row: RawFlightRow): BgnFlight | null {
  const airlineCode = String(row.CHOPER || "").trim();
  const flightNumber = String(row.CHFLTN ?? "").trim();
  const scheduledAt = String(row.CHSTOL || "").trim();
  if (!airlineCode || !flightNumber || !scheduledAt) return null;

  const direction: FlightDirection = row.CHAORD?.toUpperCase() === "D" ? "departure" : "arrival";
  const actualAt = row.CHPTOL ? String(row.CHPTOL).trim() : null;
  const statusEn = String(row.CHRMINE || "").trim();
  const statusHe = String(row.CHRMINH || "").trim();
  const delay = delayMinutes(scheduledAt, actualAt);

  return {
    id: `${airlineCode}${flightNumber}-${direction === "arrival" ? "A" : "D"}-${scheduledAt}`,
    flightNumber: `${airlineCode}${flightNumber}`,
    airlineCode,
    airlineName: String(row.CHOPERD || airlineCode).trim(),
    direction,
    otherAirportCode: row.CHLOC1?.trim() || null,
    otherAirportNameHe: row.CHLOC1TH?.trim() || row.CHLOC1T?.trim() || null,
    otherAirportNameEn: row.CHLOC1D?.trim() || null,
    countryHe: row.CHLOC1CH?.trim() || null,
    scheduledAt: parseDate(scheduledAt)?.toISOString() ?? null,
    updatedAt: parseDate(actualAt)?.toISOString() ?? null,
    statusHe: statusHe || null,
    statusEn: statusEn || null,
    statusTone: classifyTone(statusEn, statusHe, delay),
    terminal: row.CHTERM != null && String(row.CHTERM) !== "None" ? String(row.CHTERM) : null,
    gate: null, // not published in this feed
    checkInCounters: row.CHCINT && row.CHCINT !== "None" ? row.CHCINT : row.CHCKZN && row.CHCKZN !== "None" ? row.CHCKZN : null,
    delayMinutes: delay,
  };
}

async function fetchFromSource(): Promise<{ flights: BgnFlight[]; sourceUpdatedAt: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`data.gov.il HTTP ${response.status}`);

    const payload = (await response.json()) as { success?: boolean; result?: { records?: RawFlightRow[] } };
    if (!payload.success) throw new Error("data.gov.il returned success=false");

    const flights = (payload.result?.records ?? [])
      .map(normalizeRow)
      .filter((f): f is BgnFlight => f !== null)
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));

    const sourceUpdatedAt = flights.reduce<string | null>((latest, f) => {
      const candidate = f.updatedAt ?? f.scheduledAt;
      if (!candidate) return latest;
      return !latest || candidate > latest ? candidate : latest;
    }, null);

    return { flights, sourceUpdatedAt };
  } finally {
    clearTimeout(timeout);
  }
}

const cache = getOrCreateCache("bgn-flights", CACHE_TTL_MS, () => trackSource("bgn-flights", fetchFromSource));

export async function getBgnFlightsSnapshot(force = false): Promise<BgnFlightsSnapshot> {
  try {
    const { flights, sourceUpdatedAt } = await cache.get(force);
    return {
      ok: true,
      flights,
      arrivals: flights.filter((f) => f.direction === "arrival"),
      departures: flights.filter((f) => f.direction === "departure"),
      sourceUpdatedAt,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stale = cache.peek();
    if (stale) {
      return {
        ok: false,
        flights: stale.flights,
        arrivals: stale.flights.filter((f) => f.direction === "arrival"),
        departures: stale.flights.filter((f) => f.direction === "departure"),
        sourceUpdatedAt: stale.sourceUpdatedAt,
        timestamp: new Date().toISOString(),
        error: message,
      };
    }
    return { ok: false, flights: [], arrivals: [], departures: [], sourceUpdatedAt: null, timestamp: new Date().toISOString(), error: message };
  }
}
