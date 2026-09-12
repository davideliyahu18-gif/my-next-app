import { ADSB_LOL_BASE, FETCH_TIMEOUT_MS, QUERY_GRID } from "./constants";
import { normalizeAircraft, type RawAdsbAircraft } from "./aircraft-normalizer";
import type { Aircraft } from "./types";

type GridResponse = { ac?: RawAdsbAircraft[] };

/** Fallback provider, same grid strategy as adsb.fi. */
export async function fetchAdsbLol(): Promise<Aircraft[]> {
  const nowIso = new Date().toISOString();
  const byHex = new Map<string, Aircraft>();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    for (const [index, cell] of QUERY_GRID.entries()) {
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, 220));
      }
      if (controller.signal.aborted) break;

      const url = `${ADSB_LOL_BASE}/lat/${cell.lat}/lon/${cell.lon}/dist/${cell.radiusNm}`;
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) continue;
        const payload = (await response.json()) as GridResponse;
        for (const raw of payload.ac ?? []) {
          const aircraft = normalizeAircraft(raw, "adsb.lol", nowIso);
          if (aircraft) byHex.set(aircraft.hex, aircraft);
        }
      } catch {
        // One grid cell failing shouldn't fail the whole provider.
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  if (byHex.size === 0) {
    throw new Error("adsb.lol: no aircraft returned from any grid cell");
  }

  return [...byHex.values()];
}
