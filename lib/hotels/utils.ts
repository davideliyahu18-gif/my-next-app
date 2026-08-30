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
