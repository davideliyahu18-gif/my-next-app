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

/** Hero background — runway at night (Unsplash). */
export const FLIGHTS_RUNWAY_IMAGE =
  "https://images.unsplash.com/photo-1437840810700-75372276584e?w=2400&q=85&auto=format&fit=crop";

export const FLIGHTS_TRACKED_STORAGE_KEY = "tlv-flights-tracked";
