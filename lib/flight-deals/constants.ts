/** TLV — Ben Gurion Airport */
export const FLIGHT_DEALS_ORIGIN = "TLV";

/** Maximum round-trip price in USD. */
export const FLIGHT_DEALS_MAX_PRICE_USD = Number(
  process.env.FLIGHT_DEALS_MAX_PRICE_USD ?? "50",
);

export const FLIGHT_DEALS_CURRENCY = "USD";

/** Cron interval — every 30 minutes. */
export const FLIGHT_DEALS_SCAN_INTERVAL_CRON = "*/30 * * * *";

export const AMADEUS_API_BASE =
  process.env.AMADEUS_API_BASE ?? "https://test.api.amadeus.com";

export const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID ?? "";
export const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET ?? "";

/** Redis keys for deduplication and history. */
export const FLIGHT_DEALS_SEEN_KEY = "flight-deals:seen";
export const FLIGHT_DEALS_HISTORY_KEY = "flight-deals:history";
export const FLIGHT_DEALS_MAX_HISTORY = 200;

/** Common destination names for Hebrew messages (IATA → label). */
export const AIRPORT_LABELS: Record<string, string> = {
  TLV: "תל אביב",
  ATH: "אתונה",
  LCA: "לרנקה",
  PFO: "פאפוס",
  BUD: "בודפשט",
  BUH: "בוקרשט",
  OTP: "בוקרשט",
  SOF: "סופיה",
  VAR: "ורנה",
  TBS: "טביליסי",
  EVN: "ירוואן",
  DXB: "דובאי",
  AYT: "אנטליה",
  IST: "איסטנבול",
  SAW: "איסטנבול",
  BKK: "בנגקוק",
  FCO: "רומא",
  MXP: "מילאנו",
  BCN: "ברצלונה",
  MAD: "מדריד",
  LIS: "ליסבון",
  PRG: "פראג",
  VIE: "וינה",
  WAW: "ורשה",
  KRK: "קרקוב",
  RIX: "ריגה",
  TLL: "טאלין",
  CAI: "קהיר",
  AMM: "עמאן",
  ETH: "אילת",
  ETM: "אילת (רמון)",
};
