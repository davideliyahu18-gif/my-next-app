import { resolveIata } from "@/lib/flights-search/constants";
import { amadeusGet } from "./auth";
import type { FlightPriceOffer } from "./types";

type RawSegment = {
  departure: { iataCode: string; at: string };
  arrival: { iataCode: string; at: string };
  carrierCode: string;
};

type RawItinerary = {
  segments: RawSegment[];
};

type RawOffer = {
  id: string;
  price: { total: string; currency: string };
  itineraries: RawItinerary[];
};

type FlightOffersResponse = {
  data?: RawOffer[];
  dictionaries?: { carriers?: Record<string, string> };
};

function normalizeLeg(
  itinerary: RawItinerary,
  carriers: Record<string, string>,
): FlightPriceOffer["outbound"] {
  const first = itinerary.segments[0];
  const last = itinerary.segments[itinerary.segments.length - 1];
  const carrierCode = first.carrierCode;

  return {
    departAt: first.departure.at,
    arriveAt: last.arrival.at,
    carrier: carriers[carrierCode] ?? carrierCode,
    stops: itinerary.segments.length - 1,
  };
}

/** Resolves city names to IATA codes and returns the cheapest real offers, or null if either city isn't in our lookup. */
export async function searchFlightPrices(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
  adults?: number;
  max?: number;
}): Promise<FlightPriceOffer[] | null> {
  const originCode = resolveIata(input.origin);
  const destCode = resolveIata(input.destination);
  if (!originCode || !destCode) return null;

  const params = new URLSearchParams({
    originLocationCode: originCode,
    destinationLocationCode: destCode,
    departureDate: input.departDate,
    adults: String(input.adults ?? 1),
    max: String(input.max ?? 10),
    currencyCode: "ILS",
  });
  if (input.returnDate) params.set("returnDate", input.returnDate);

  const response = await amadeusGet<FlightOffersResponse>(
    `/v2/shopping/flight-offers?${params.toString()}`,
  );

  const carriers = response.dictionaries?.carriers ?? {};
  const offers = (response.data ?? [])
    .map((offer): FlightPriceOffer => ({
      id: offer.id,
      priceTotal: offer.price.total,
      currency: offer.price.currency,
      outbound: normalizeLeg(offer.itineraries[0], carriers),
      inbound: offer.itineraries[1] ? normalizeLeg(offer.itineraries[1], carriers) : null,
    }))
    .sort((a, b) => Number(a.priceTotal) - Number(b.priceTotal));

  return offers.slice(0, 3);
}
