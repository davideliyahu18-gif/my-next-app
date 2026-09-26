/** Shared outbound fetch headers. A real User-Agent matters here: several of
 * the public ADS-B aggregators sit behind Cloudflare, and Cloudflare's bot
 * mitigation is known to challenge/block requests from serverless platforms
 * (Vercel, Lambda, etc.) when they arrive with no User-Agent — the default
 * for Node's fetch. Declaring one as a normal HTTP client avoids that. */
export const ADSB_FETCH_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; TlvControlCenter/1.0; +https://vercel.com)",
};

/** Headers commonly required by oref.org.il's CDN to avoid a 403 on the
 * (undocumented) alerts.json endpoint — widely observed across third-party
 * implementations of this same integration. */
export const OREF_FETCH_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.oref.org.il/",
  "X-Requested-With": "XMLHttpRequest",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};
