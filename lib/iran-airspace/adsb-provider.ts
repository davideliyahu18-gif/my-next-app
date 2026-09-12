import { fetchAdsbFi } from "./adsb-fi";
import { fetchAdsbLol } from "./adsb-lol";
import type { Aircraft, ProviderName } from "./types";

export type ProviderResult = {
  aircraft: Aircraft[];
  source: ProviderName;
  fellBack: boolean;
};

/** Tries adsb.fi first; falls back to adsb.lol if it fails or returns nothing. */
export async function fetchAircraftFromProviders(): Promise<ProviderResult> {
  try {
    const aircraft = await fetchAdsbFi();
    return { aircraft, source: "adsb.fi", fellBack: false };
  } catch (primaryError) {
    try {
      const aircraft = await fetchAdsbLol();
      return { aircraft, source: "adsb.lol", fellBack: true };
    } catch (fallbackError) {
      const primaryMessage =
        primaryError instanceof Error ? primaryError.message : String(primaryError);
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(
        `both ADS-B providers failed — adsb.fi: ${primaryMessage}; adsb.lol: ${fallbackMessage}`,
      );
    }
  }
}
