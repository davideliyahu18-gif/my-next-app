import { fetchHotelsFromOverpass, geocodeCity } from "./api";
import { HOTELS_CACHE_TTL_MS, HOTELS_DEFAULT_RADIUS_KM } from "./constants";
import type { HotelKind, HotelRecord, HotelsSnapshot } from "./types";

type CachedEntry = {
  snapshot: HotelsSnapshot;
  fetchedAt: number;
  inflight: Promise<HotelsSnapshot> | null;
};

const globalRef = globalThis as typeof globalThis & {
  __hotelsCache?: Map<string, CachedEntry>;
};

function getCache(): Map<string, CachedEntry> {
  if (!globalRef.__hotelsCache) {
    globalRef.__hotelsCache = new Map();
  }
  return globalRef.__hotelsCache;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function buildStats(hotels: HotelRecord[]) {
  const byKind: Record<HotelKind, number> = {
    hotel: 0,
    guest_house: 0,
    hostel: 0,
    motel: 0,
    apartment: 0,
  };
  for (const hotel of hotels) {
    byKind[hotel.kind] += 1;
  }
  return {
    total: hotels.length,
    withStars: hotels.filter((hotel) => hotel.stars != null).length,
    byKind,
  };
}

async function buildSnapshot(
  rawQuery: string,
  radiusKm: number,
): Promise<HotelsSnapshot> {
  const query = rawQuery.trim();
  const place = await geocodeCity(query);

  if (!place) {
    return {
      ok: false,
      query,
      cityLabel: null,
      center: null,
      radiusKm,
      hotels: [],
      stats: buildStats([]),
      timestamp: new Date().toISOString(),
      source: "openstreetmap",
      error: "העיר לא נמצאה",
    };
  }

  const center = { lat: place.lat, lng: place.lng };
  const hotels = await fetchHotelsFromOverpass(center, radiusKm);

  return {
    ok: true,
    query,
    cityLabel: place.label,
    center,
    radiusKm,
    hotels,
    stats: buildStats(hotels),
    timestamp: new Date().toISOString(),
    source: "openstreetmap",
  };
}

export async function getHotelsSnapshot(options: {
  query: string;
  radiusKm?: number;
  force?: boolean;
}): Promise<HotelsSnapshot> {
  const query = options.query.trim();
  const radiusKm = options.radiusKm ?? HOTELS_DEFAULT_RADIUS_KM;
  const cache = getCache();
  const key = `${normalizeQuery(query)}::${radiusKm}`;
  const entry = cache.get(key);
  const age = entry ? Date.now() - entry.fetchedAt : Infinity;

  if (entry && !options.force && age < HOTELS_CACHE_TTL_MS) {
    return entry.snapshot;
  }

  if (entry?.inflight) {
    return entry.inflight;
  }

  const inflight = buildSnapshot(query, radiusKm)
    .then((snapshot) => {
      cache.set(key, { snapshot, fetchedAt: Date.now(), inflight: null });
      return snapshot;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "שגיאה בטעינת מלונות";
      const fallback: HotelsSnapshot = {
        ok: false,
        query,
        cityLabel: entry?.snapshot.cityLabel ?? null,
        center: entry?.snapshot.center ?? null,
        radiusKm,
        hotels: entry?.snapshot.hotels ?? [],
        stats: entry?.snapshot.stats ?? {
          total: 0,
          withStars: 0,
          byKind: { hotel: 0, guest_house: 0, hostel: 0, motel: 0, apartment: 0 },
        },
        timestamp: new Date().toISOString(),
        source: "openstreetmap",
        error: message,
      };
      cache.set(key, { snapshot: fallback, fetchedAt: Date.now(), inflight: null });
      return fallback;
    });

  cache.set(key, {
    snapshot: entry?.snapshot ?? {
      ok: true,
      query,
      cityLabel: null,
      center: null,
      radiusKm,
      hotels: [],
      stats: buildStats([]),
      timestamp: new Date().toISOString(),
      source: "openstreetmap",
    },
    fetchedAt: entry?.fetchedAt ?? 0,
    inflight,
  });

  return inflight;
}
