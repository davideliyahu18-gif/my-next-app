/** Official Israel Airports Authority flight feed on data.gov.il */
export const FLIGHTS_RESOURCE_ID =
  "e83f763b-b7d7-479e-b172-ae981ddc6de5";

export const FLIGHTS_API_URL =
  `https://data.gov.il/api/3/action/datastore_search?resource_id=${FLIGHTS_RESOURCE_ID}&limit=3200`;

export const FLIGHTS_USER_AGENT = "datagov-external-client";

/** Source refresh cadence published by the authority. */
export const FLIGHTS_SOURCE_REFRESH_MS = 15 * 60 * 1000;

/** Server cache TTL — poll upstream between authority refresh windows. */
export const FLIGHTS_CACHE_TTL_MS = 15 * 1000;

/** Client + SSE refresh interval. */
export const FLIGHTS_STREAM_INTERVAL_MS = 30 * 1000;

export const FLIGHTS_TIMEZONE = "Asia/Jerusalem";

/** Hero — Terminal 3 arrivals hall at night (Wikimedia Commons). */
export const FLIGHTS_HERO_IMAGE = "/images/tlv-terminal-3-night.jpg";

/** @deprecated Use FLIGHTS_HERO_IMAGE */
export const FLIGHTS_RUNWAY_IMAGE = FLIGHTS_HERO_IMAGE;

export const FLIGHTS_IAA = {
  navy: "#0b2d52",
  navyDark: "#071d36",
  blue: "#1565c0",
  sky: "#e3f2fd",
  surface: "#f5f8fc",
  border: "#d6e4f0",
} as const;

export const FLIGHTS_TRACKED_STORAGE_KEY = "tlv-flights-tracked";
