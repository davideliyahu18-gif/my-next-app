/** Shared outbound fetch headers. A real User-Agent matters here: several of
 * the public ADS-B aggregators sit behind Cloudflare, and Cloudflare's bot
 * mitigation is known to challenge/block requests from serverless platforms
 * (Vercel, Lambda, etc.) when they arrive with no User-Agent — the default
 * for Node's fetch. Declaring one as a normal HTTP client avoids that. */
export const ADSB_FETCH_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; TlvControlCenter/1.0; +https://vercel.com)",
};
