import { fetchAdsbLol } from "./adsb-lol";
import { fetchOpenSky } from "./opensky";
import { trackSource } from "../utils/source-health";
import { getOrCreateCache } from "../cache/ttl-cache";
import { DEFAULT_RADIUS_NM } from "../utils/geo";
import type { Aircraft, AircraftSnapshot, AircraftSource } from "../types";

const CACHE_TTL_MS = 9_000;

/** AircraftProvider abstraction: the UI/API layer only ever calls
 * getAircraftSnapshot() and never talks to adsb.lol/OpenSky directly, so a
 * future provider can be swapped in without touching callers. */
async function fetchWithFallback(radiusNm: number): Promise<{ aircraft: Aircraft[]; source: AircraftSource; fellBack: boolean }> {
  try {
    const aircraft = await trackSource("adsb.lol", () => fetchAdsbLol(radiusNm));
    return { aircraft, source: "adsb.lol", fellBack: false };
  } catch (primaryError) {
    try {
      const aircraft = await trackSource("opensky", () => fetchOpenSky(radiusNm));
      return { aircraft, source: "opensky", fellBack: true };
    } catch (fallbackError) {
      const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`both aircraft providers failed — adsb.lol: ${primaryMessage}; OpenSky: ${fallbackMessage}`);
    }
  }
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
