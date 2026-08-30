export type HotelKind =
  | "hotel"
  | "guest_house"
  | "hostel"
  | "motel"
  | "apartment";

export type HotelRecord = {
  id: string;
  name: string;
  kind: HotelKind;
  stars: number | null;
  lat: number;
  lng: number;
  address: string | null;
  website: string | null;
  phone: string | null;
  distanceKm: number | null;
};

export type HotelsSnapshot = {
  ok: boolean;
  query: string;
  cityLabel: string | null;
  center: { lat: number; lng: number } | null;
  radiusKm: number;
  hotels: HotelRecord[];
  stats: {
    total: number;
    withStars: number;
    byKind: Record<HotelKind, number>;
  };
  timestamp: string;
  source: "openstreetmap";
  error?: string;
};
