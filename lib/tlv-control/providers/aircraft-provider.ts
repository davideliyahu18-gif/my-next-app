import { fetchAdsbFi } from "./adsb-fi";
import { fetchAdsbLol } from "./adsb-lol";
import { fetchOpenSky } from "./opensky";
import { trackSource } from "../utils/source-health";
import { getOrCreateCache } from "../cache/ttl-cache";
import { DEFAULT_RADIUS_NM } from "../utils/geo";
import type { Aircraft, AircraftSnapshot, AircraftSource } from "../types";

const CACHE_TTL_MS = 9_000;

/** AircraftProvider abstraction: the UI/API layer only ever calls
 * getAircraftSnapshot() and never talks to a specific ADS-B source directly,
 * so providers can be reordered/swapped without touching callers.
 *
 * Order: adsb.fi -> adsb.lol -> OpenSky. adsb.fi is tried first because it is
 * the source already confirmed working from this project's Vercel deployment
 * (it powers the iran-airspace map in production); adsb.lol has been observed
 * to fail from Vercel (likely Cloudflare bot-mitigation against datacenter
 * IPs), so it is kept only as a fallback; OpenSky's anonymous public API is
 * free but rate-limited, so it is the last resort. */
async function fetchWithFallback(radiusNm: number): Promise<{ aircraft: Aircraft[]; source: AircraftSource; fellBack: boolean }> {
  const errors: string[] = [];

  try {
    const aircraft = await trackSource("adsb.fi", () => fetchAdsbFi(radiusNm));
    return { aircraft, source: "adsb.fi", fellBack: false };
  } catch (error) {
    errors.push(`adsb.fi: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const aircraft = await trackSource("adsb.lol", () => fetchAdsbLol(radiusNm));
    return { aircraft, source: "adsb.lol", fellBack: true };
  } catch (error) {
    errors.push(`adsb.lol: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const aircraft = await trackSource("opensky", () => fetchOpenSky(radiusNm));
    return { aircraft, source: "opensky", fellBack: true };
  } catch (error) {
    errors.push(`OpenSky: ${error instanceof Error ? error.message : String(error)}`);
  }

  throw new Error(`all aircraft providers failed — ${errors.join("; ")}`);
}

export async function getAircraftSnapshot(
  options: { radiusNm?: number; force?: boolean } = {},
): Promise<AircraftSnapshot> {
  const radiusNm = options.radiusNm ?? DEFAULT_RADIUS_NM;
  const cache = getOrCreateCache(`aircraft:${radiusNm}`, CACHE_TTL_MS, () => fetchWithFallback(radiusNm));

  try {
    const { aircraft, source, fellBack } = await cache.get(options.force === true);
    return {
      ok: true,
      aircraft,
      source,
      fellBack,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stale = cache.peek();
    if (stale) {
      return {
        ok: false,
        aircraft: stale.aircraft,
        source: stale.source,
        fellBack: stale.fellBack,
        timestamp: new Date().toISOString(),
        error: message,
      };
    }
    // Never fabricate aircraft — an empty list with ok:false is the honest
    // "data unavailable" state the UI must show as such.
    return { ok: false, aircraft: [], source: null, fellBack: false, timestamp: new Date().toISOString(), error: message };
  }
}
