import { searchCheapRoundTripsFromTlv } from "./amadeus";
import { notifyDeals } from "./notify";
import { filterNewDeals } from "./store";
import type { FlightDealScanSummary } from "./types";

export async function runFlightDealScan(): Promise<FlightDealScanSummary> {
  const deals = await searchCheapRoundTripsFromTlv();
  const { newDeals, skippedDuplicates } = await filterNewDeals(deals);
  const notified = await notifyDeals(newDeals);

  return {
    searchedAt: new Date().toISOString(),
    totalFound: deals.length,
    newDeals,
    notified,
    skippedDuplicates,
  };
}
