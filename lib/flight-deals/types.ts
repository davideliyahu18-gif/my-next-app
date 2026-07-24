export type FlightDeal = {
  id: string;
  origin: string;
  destination: string;
  destinationNameHe: string | null;
  countryNameHe: string | null;
  departureDate: string;
  returnDate: string;
  priceUsd: number;
  currency: string;
  bookingUrl: string | null;
  imageUrl: string | null;
  foundAt: string;
};

export type FlightDealSearchResult = {
  deals: FlightDeal[];
  searchedAt: string;
  source: "travelpayouts" | "serpapi" | "skyscanner" | "amadeus" | "demo" | "merged";
};

export type FlightDealScanSummary = {
  searchedAt: string;
  provider: FlightDealSearchResult["source"];
  totalFound: number;
  newDeals: FlightDeal[];
  notified: number;
  skippedDuplicates: number;
};
