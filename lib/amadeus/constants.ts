/** Amadeus Self-Service "test" environment — free tier, no payment required. */
export const AMADEUS_BASE_URL = "https://test.api.amadeus.com";

/** Refresh the cached access token this long before it actually expires. */
export const TOKEN_REFRESH_SKEW_MS = 60_000;

/** How long a price search result is cached per query (ms). */
export const PRICE_CACHE_TTL_MS = 10 * 60 * 1000;
