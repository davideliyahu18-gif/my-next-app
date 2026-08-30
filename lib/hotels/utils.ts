import type { HotelKind, HotelRecord } from "./types";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(km: number | null): string {
  if (km == null) return "—";
  if (km < 1) return `${Math.round(km * 1000)} מ׳`;
  return `${km.toFixed(1)} ק״מ`;
}

export const HOTEL_KIND_LABEL: Record<HotelKind, string> = {
  hotel: "מלון",
  guest_house: "בית הארחה",
  hostel: "הוסטל",
  motel: "מוטל",
  apartment: "דירת נופש",
};

export function starsLabel(stars: number | null): string {
  if (!stars) return "—";
  return "★".repeat(Math.min(5, Math.max(1, Math.round(stars))));
}

export function matchesHotelQuery(hotel: HotelRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [hotel.name, hotel.address, HOTEL_KIND_LABEL[hotel.kind]]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function sortHotelsByDistance(hotels: HotelRecord[]): HotelRecord[] {
  return [...hotels].sort((a, b) => {
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });
}

/**
 * Booking.com has no free public API — this builds a plain search-results
 * deep link (no key/partnership needed) so real prices are one click away.
 */
export function buildBookingSearchUrl(params: {
  query: string;
  checkIn?: string | null;
  checkOut?: string | null;
  adults?: number;
}): string {
  const url = new URL("https://www.booking.com/searchresults.html");
  url.searchParams.set("ss", params.query);
  if (params.checkIn) url.searchParams.set("checkin", params.checkIn);
  if (params.checkOut) url.searchParams.set("checkout", params.checkOut);
  url.searchParams.set("group_adults", String(params.adults ?? 2));
  url.searchParams.set("no_rooms", "1");
  url.searchParams.set("group_children", "0");
  return url.toString();
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function defaultBookingDates(): { checkIn: string; checkOut: string } {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 7);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 2);
  return { checkIn: isoDate(checkIn), checkOut: isoDate(checkOut) };
}
