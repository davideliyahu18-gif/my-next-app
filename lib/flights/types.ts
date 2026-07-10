export type FlightDirection = "arrival" | "departure";

export type FlightRecord = {
  id: string;
  airlineCode: string;
  flightNumber: string;
  flightCode: string;
  airlineName: string;
  scheduledAt: string;
  actualAt: string | null;
  direction: FlightDirection;
  airportCode: string;
  airportNameHe: string;
  airportNameEn: string;
  countryHe: string;
  countryEn: string;
  terminal: string | null;
  checkInZone: string | null;
  checkInCounters: string | null;
  statusEn: string;
  statusHe: string;
  delayMinutes: number | null;
  isDelayed: boolean;
  isCanceled: boolean;
};

export type FlightsSnapshot = {
  ok: boolean;
  flights: FlightRecord[];
  arrivals: FlightRecord[];
  departures: FlightRecord[];
  stats: {
    total: number;
    arrivals: number;
    departures: number;
    delayed: number;
    canceled: number;
    landed: number;
    departed: number;
  };
  timestamp: string;
  sourceUpdatedAt: string | null;
  source: "data.gov.il";
  error?: string;
};
