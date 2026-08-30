/** Free, keyless geocoding — OpenStreetMap Nominatim. */
export const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

/** Free, keyless POI query — OpenStreetMap Overpass API. */
export const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

/** Required by Nominatim/Overpass usage policy — identifies the client, not a person. */
export const OSM_USER_AGENT = "my-next-app-hotels-flights-bot/1.0";

/** Default search radius around the resolved city center. */
export const HOTELS_DEFAULT_RADIUS_KM = 6;

/** Server cache TTL per city query (ms) — be polite to the free public API. */
export const HOTELS_CACHE_TTL_MS = 10 * 60 * 1000;

export const HOTELS_DEFAULT_CITY = "תל אביב";

export const HOTELS_THEME = {
  ink: "#3b2410",
  inkDark: "#241505",
  amber: "#b45309",
  sand: "#fdf4e3",
  border: "#eadcc2",
} as const;
