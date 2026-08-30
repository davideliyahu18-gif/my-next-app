import { resolveIata } from "@/lib/flights-search/constants";
import { amadeusGet } from "./auth";
import type { HotelPriceOffer } from "./types";

type HotelListEntry = { hotelId: string; name: string };
type HotelListResponse = { data?: HotelListEntry[] };

type RawHotelOffer = {
  hotel: { hotelId: string; name: string; rating?: string };
  available: boolean;
  offers?: Array<{ price: { total: string; currency: string } }>;
};

type HotelOffersResponse = { data?: RawHotelOffer[] };

/** Amadeus hotel search needs an explicit hotel-id list — cap it to keep the offers call fast. */
const MAX_HOTEL_IDS = 20;

/** Resolves the city to an Amadeus city code and returns the cheapest real hotel offers, or null if the city isn't in our lookup. */
export async function searchHotelPrices(input: {
  city: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
}): Promise<HotelPriceOffer[] | null> {
  const cityCode = resolveIata(input.city);
  if (!cityCode) return null;

  const listResponse = await amadeusGet<HotelListResponse>(
    `/v1/reference-data/locations/hotels/by-city?cityCode=${encodeURIComponent(cityCode)}`,
  );
  const hotelIds = (listResponse.data ?? [])
    .slice(0, MAX_HOTEL_IDS)
    .map((hotel) => hotel.hotelId);
  if (hotelIds.length === 0) return [];

  const params = new URLSearchParams({
    hotelIds: hotelIds.join(","),
    checkInDate: input.checkIn,
    checkOutDate: input.checkOut,
    adults: String(input.adults ?? 2),
    currency: "ILS",
    bestRateOnly: "true",
  });

  const offersResponse = await amadeusGet<HotelOffersResponse>(
    `/v3/shopping/hotel-offers?${params.toString()}`,
  );

  const offers = (offersResponse.data ?? [])
    .filter((entry) => entry.available && entry.offers?.length)
    .map((entry): HotelPriceOffer => ({
      hotelId: entry.hotel.hotelId,
      name: entry.hotel.name,
      rating: entry.hotel.rating ?? null,
      priceTotal: entry.offers![0].price.total,
      currency: entry.offers![0].price.currency,
    }))
    .sort((a, b) => Number(a.priceTotal) - Number(b.priceTotal));

  return offers;
}
