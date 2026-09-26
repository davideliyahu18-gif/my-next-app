// ── Aircraft ────────────────────────────────────────────────────────────

export type AircraftSource = "adsb.fi" | "adsb.lol" | "opensky";

/** Unified aircraft shape — UI code never talks to a provider directly. */
export type Aircraft = {
  id: string;
  callsign: string | null;
  registration: string | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  onGround: boolean;
  groundSpeed: number | null;
  heading: number | null;
  verticalRate: number | null;
  squawk: string | null;
  aircraftType: string | null;
  lastSeen: string;
  source: AircraftSource;
};

export type AircraftSnapshot = {
  ok: boolean;
  aircraft: Aircraft[];
  source: AircraftSource | null;
  fellBack: boolean;
  timestamp: string;
  error?: string;
};

// ── Ben Gurion flight board ────────────────────────────────────────────

export type FlightDirection = "arrival" | "departure";

export type FlightStatusTone = "onTime" | "info" | "delayed" | "inProgress";

export type BgnFlight = {
  id: string;
  flightNumber: string;
  airlineCode: string;
  airlineName: string;
  direction: FlightDirection;
  otherAirportCode: string | null;
  otherAirportNameHe: string | null;
  otherAirportNameEn: string | null;
  countryHe: string | null;
  scheduledAt: string | null;
  updatedAt: string | null;
  statusHe: string | null;
  statusEn: string | null;
  statusTone: FlightStatusTone;
  terminal: string | null;
  gate: string | null;
  checkInCounters: string | null;
  delayMinutes: number | null;
};

export type BgnFlightsSnapshot = {
  ok: boolean;
  flights: BgnFlight[];
  arrivals: BgnFlight[];
  departures: BgnFlight[];
  sourceUpdatedAt: string | null;
  timestamp: string;
  error?: string;
};

export type FlightSearchQuery = {
  flightNumber?: string;
  destination?: string;
  airline?: string;
  date?: string; // YYYY-MM-DD
};

// ── Weather ─────────────────────────────────────────────────────────────

export type WeatherSnapshot = {
  ok: boolean;
  temperatureC: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  windGustKmh: number | null;
  humidityPct: number | null;
  cloudCoverPct: number | null;
  precipitationMm: number | null;
  visibilityM: number | null;
  hourly: {
    time: string;
    temperatureC: number | null;
    precipitationMm: number | null;
    windSpeedKmh: number | null;
  }[];
  timestamp: string;
  error?: string;
};

// ── Aviation weather (METAR/TAF) ────────────────────────────────────────

export type AviationWeatherSnapshot = {
  ok: boolean;
  station: string;
  metarRaw: string | null;
  metarObservedAt: string | null;
  tafRaw: string | null;
  tafIssuedAt: string | null;
  timestamp: string;
  error?: string;
};

// ── Home Front Command alerts ──────────────────────────────────────────

export type AlertProviderState = "unavailable" | "connected";

export type ActiveAlert = {
  id: string;
  category: string;
  areas: string[];
  issuedAt: string;
};

export type AlertsSnapshot = {
  state: AlertProviderState;
  reason: string | null;
  active: ActiveAlert[];
  timestamp: string;
};

// ── Source health ───────────────────────────────────────────────────────

export type SourceHealthStatus = "connected" | "stale" | "unavailable";

export type SourceKey =
  | "adsb.fi"
  | "adsb.lol"
  | "opensky"
  | "bgn-flights"
  | "open-meteo"
  | "aviation-weather"
  | "oref";

export type SourceHealthEntry = {
  key: SourceKey;
  label: string;
  status: SourceHealthStatus;
  lastSuccessfulUpdate: string | null;
  lastAttempt: string | null;
  latencyMs: number | null;
  error: string | null;
};

export type HealthSnapshot = {
  sources: SourceHealthEntry[];
  timestamp: string;
};
