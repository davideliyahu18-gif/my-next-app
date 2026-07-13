export type FlightDeal = {
  id: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  priceUsd: number;
  currency: string;
  bookingUrl: string | null;
  foundAt: string;
};

export type FlightDealSearchResult = {
  deals: FlightDeal[];
  searchedAt: string;
  source: "amadeus";
};

export type FlightDealScanSummary = {
  searchedAt: string;
  totalFound: number;
  newDeals: FlightDeal[];
  notified: number;
  skippedDuplicates: number;
};
