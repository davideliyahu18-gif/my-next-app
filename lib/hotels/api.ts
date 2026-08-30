import {
  HOTELS_DEFAULT_RADIUS_KM,
  NOMINATIM_SEARCH_URL,
  OSM_USER_AGENT,
  OVERPASS_API_URL,
} from "./constants";
import type { HotelKind, HotelRecord } from "./types";
import { haversineKm, sortHotelsByDistance } from "./utils";

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

type OverpassTags = Record<string, string>;

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OverpassTags;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

const HOTEL_TOURISM_KINDS: HotelKind[] = [
  "hotel",
  "guest_house",
  "hostel",
  "motel",
  "apartment",
];

export async function geocodeCity(
  query: string,
): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = `${NOMINATIM_SEARCH_URL}?format=json&limit=1&accept-language=he&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": OSM_USER_AGENT,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`nominatim HTTP ${response.status}`);
  }

  const results = (await response.json()) as NominatimResult[];
  const first = results[0];
  if (!first) return null;

  return {
    lat: Number(first.lat),
    lng: Number(first.lon),
    label: first.display_name,
  };
}

function normalizeKind(tourism: string | undefined): HotelKind | null {
  const value = (tourism || "").toLowerCase();
  return (HOTEL_TOURISM_KINDS as string[]).includes(value)
    ? (value as HotelKind)
    : null;
}

function buildAddress(tags: OverpassTags): string | null {
  const parts = [
    tags["addr:street"],
    tags["addr:housenumber"],
    tags["addr:city"],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function normalizeElement(
  element: OverpassElement,
  center: { lat: number; lng: number },
): HotelRecord | null {
  const tags = element.tags || {};
  const kind = normalizeKind(tags.tourism);
  const name = tags.name;
  if (!kind || !name) return null;

  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (lat == null || lng == null) return null;

  const stars = tags.stars ? Number.parseFloat(tags.stars) : null;

  return {
    id: `${element.type}-${element.id}`,
    name,
    kind,
    stars: Number.isFinite(stars) ? stars : null,
    lat,
    lng,
    address: buildAddress(tags),
    website: tags.website || tags["contact:website"] || null,
    phone: tags.phone || tags["contact:phone"] || null,
    distanceKm: haversineKm(center, { lat, lng }),
  };
}

export async function fetchHotelsFromOverpass(
  center: { lat: number; lng: number },
  radiusKm: number = HOTELS_DEFAULT_RADIUS_KM,
): Promise<HotelRecord[]> {
  const radiusMeters = Math.round(radiusKm * 1000);
  const kindsPattern = HOTEL_TOURISM_KINDS.join("|");
  const query = `[out:json][timeout:25];(node["tourism"~"^(${kindsPattern})$"](around:${radiusMeters},${center.lat},${center.lng});way["tourism"~"^(${kindsPattern})$"](around:${radiusMeters},${center.lat},${center.lng});); out center 120;`;

  const response = await fetch(OVERPASS_API_URL, {
    method: "POST",
    headers: {
      "User-Agent": OSM_USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `data=${encodeURIComponent(query)}`,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`overpass HTTP ${response.status}`);
  }

  const payload = (await response.json()) as OverpassResponse;
  const elements = payload.elements ?? [];

  const hotels = elements
    .map((element) => normalizeElement(element, center))
    .filter((hotel): hotel is HotelRecord => Boolean(hotel));

  return sortHotelsByDistance(hotels);
}
