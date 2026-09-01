export type AircraftCategory = "civil" | "military" | "tanker" | "intel";

export type ProviderName = "adsb.fi" | "adsb.lol";

export type LatLng = { lat: number; lon: number };

export type MapBounds = {
  north: number;
  south: number;
  west: number;
  east: number;
};

/** A single aircraft, normalized from a public ADS-B feed. */
export type Aircraft = {
  hex: string;
  callsign: string | null;
  registration: string | null;
  aircraftType: string | null;
  typeDescription: string | null;
  category: AircraftCategory;
  /** Raw military/PIA/LADD bitmask from the source feed, kept for diagnosing
   * classification (see aircraft-normalizer.ts). Not shown in the UI. */
  dbFlags: number;
  lat: number;
  lon: number;
  altitude: number | null;
  onGround: boolean;
  groundSpeed: number | null;
  heading: number | null;
  verticalRate: number | null;
  squawk: string | null;
  operator: string | null;
  country: string | null;
  lastSeen: string;
  source: ProviderName;
};

export type TrailPoint = {
  lat: number;
  lon: number;
  altitude: number | null;
  t: number;
};

export type InterestingReason =
  | "new-in-range"
  | "altitude-change"
  | "heading-change"
  | "high-speed"
  | "re-entered-area"
  | "holding-pattern"
  | "unusual-route";

export type InterestingMovement = {
  hex: string;
  reasons: InterestingReason[];
  reasonLabels: string[];
  detectedAt: string;
};

export type AircraftSnapshot = {
  ok: boolean;
  aircraft: Aircraft[];
  interesting: InterestingMovement[];
  source: ProviderName | null;
  fellBackToSecondary: boolean;
  partial: boolean;
  stats: {
    total: number;
    military: number;
    tanker: number;
    intel: number;
    civil: number;
    withCallsign: number;
    withRegistration: number;
  };
  timestamp: string;
  error?: string;
};

export type ConnectionState = "connected" | "degraded" | "down";

export type SystemStatus = {
  connection: ConnectionState;
  activeSource: ProviderName | null;
  lastUpdate: string | null;
  lastSuccessfulFetchMs: number | null;
  consecutiveFailures: number;
};

export type AircraftFilters = {
  showAircraft: boolean;
  showTrails: boolean;
  showLabels: boolean;
  showNoCallsign: boolean;
  showCivil: boolean;
  showMilitary: boolean;
  showTanker: boolean;
  showIntel: boolean;
  callsign: string;
  registration: string;
  icao: string;
  aircraftType: string;
  minAltitude: string;
  maxAltitude: string;
  minSpeed: string;
};
