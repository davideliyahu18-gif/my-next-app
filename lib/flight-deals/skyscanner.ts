import type { FlightDeal } from "./types";
import { FLIGHT_DEALS_MAX_PRICE_USD, FLIGHT_DEALS_ORIGIN } from "./constants";

const RAPIDAPI_HOST = "sky-scrapper.p.rapidapi.com";

/** Popular low-cost style destinations from TLV — Everywhere API is captcha-blocked. */
const SKYSCANNER_DESTINATION_QUERIES = [
  "Athens",
  "Larnaca",
  "Budapest",
  "Sofia",
  "Bucharest",
  "Krakow",
  "Warsaw",
  "Rome",
  "Milan",
  "Barcelona",
  "Venice",
  "Prague",
  "Vienna",
  "Paphos",
  "Istanbul",
];

declare global {
  var __skyscannerPlaceCache: Map<string, { skyId: string; entityId: string }> | undefined;
  var __skyscannerRotateIndex: number | undefined;
}

function rapidApiKey(): string {
  return (
    process.env.SKYSCANNER_RAPIDAPI_KEY ??
    process.env.RAPIDAPI_KEY ??
    ""
  );
}

export function skyscannerConfigured(): boolean {
  return Boolean(rapidApiKey());
}

function headers(): HeadersInit {
  return {
    "X-RapidAPI-Key": rapidApiKey(),
    "X-RapidAPI-Host": RAPIDAPI_HOST,
  };
}

function placeCache(): Map<string, { skyId: string; entityId: string }> {
  if (!globalThis.__skyscannerPlaceCache) {
    globalThis.__skyscannerPlaceCache = new Map();
  }
  return globalThis.__skyscannerPlaceCache;
}

function buildDealId(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  priceUsd: number,
): string {
  return `sky-${origin}-${destination}-${departureDate}-${returnDate}-${priceUsd.toFixed(2)}`;
}

function skyscannerBookingUrl(
  destination: string,
  departureDate: string,
  returnDate: string,
): string {
  const out = departureDate.replace(/-/g, "").slice(2);
  const ret = returnDate.replace(/-/g, "").slice(2);
  return `https://www.skyscanner.co.il/transport/flights/${FLIGHT_DEALS_ORIGIN.toLowerCase()}/${destination.toLowerCase()}/${out}/${ret}/`;
}

async function rapidGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://${RAPIDAPI_HOST}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: headers(),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Skyscanner ${path} HTTP ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

type AirportSearchResponse = {
  status?: boolean;
  data?: Array<{
    presentation?: { title?: string };
    navigation?: {
      relevantFlightParams?: {
        skyId?: string;
        entityId?: string;
      };
    };
  }>;
};

async function resolvePlace(query: string): Promise<{ skyId: string; entityId: string } | null> {
  const cache = placeCache();
  const cached = cache.get(query);
  if (cached) return cached;

  const payload = await rapidGet<AirportSearchResponse>(
    "/api/v1/flights/searchAirport",
    { query, locale: "en-US" },
  );

  const row = payload.data?.[0];
  const params = row?.navigation?.relevantFlightParams;
  if (!params?.skyId || !params?.entityId) return null;

  const place = { skyId: params.skyId, entityId: params.entityId };
  cache.set(query, place);
  return place;
}

type SearchFlightsResponse = {
  status?: boolean;
  data?: {
    itineraries?: Array<{
      price?: { raw?: number };
      legs?: Array<{
        origin?: { id?: string; displayCode?: string };
        destination?: { id?: string; displayCode?: string };
        departure?: string;
        arrival?: string;
      }>;
    }>;
  };
  message?: unknown;
};

function nextDestinationBatch(size: number): string[] {
  const all = SKYSCANNER_DESTINATION_QUERIES;
  const start = globalThis.__skyscannerRotateIndex ?? 0;
  const batch: string[] = [];
  for (let i = 0; i < Math.min(size, all.length); i += 1) {
    batch.push(all[(start + i) % all.length]!);
  }
  globalThis.__skyscannerRotateIndex = (start + size) % all.length;
  return batch;
}

function defaultTripDates(): { departureDate: string; returnDate: string } {
  const depart = new Date(Date.now() + 21 * 86_400_000);
  const ret = new Date(depart.getTime() + 7 * 86_400_000);
  return {
    departureDate: depart.toISOString().slice(0, 10),
    returnDate: ret.toISOString().slice(0, 10),
  };
}

export async function searchViaSkyscanner(): Promise<FlightDeal[]> {
  if (!skyscannerConfigured()) {
    throw new Error("SKYSCANNER_RAPIDAPI_KEY / RAPIDAPI_KEY is not set");
  }

  const origin = await resolvePlace("Tel Aviv");
  if (!origin) throw new Error("Skyscanner could not resolve TLV");

  const batchSize = Number(process.env.SKYSCANNER_DEST_BATCH ?? "4");
  const destinations = nextDestinationBatch(batchSize);
  const { departureDate, returnDate } = defaultTripDates();
  const foundAt = new Date().toISOString();
  const deals: FlightDeal[] = [];

  for (const query of destinations) {
    try {
      const dest = await resolvePlace(query);
      if (!dest) continue;

      const payload = await rapidGet<SearchFlightsResponse>(
        "/api/v1/flights/searchFlights",
        {
          originSkyId: origin.skyId,
          destinationSkyId: dest.skyId,
          originEntityId: origin.entityId,
          destinationEntityId: dest.entityId,
          date: departureDate,
          returnDate,
          adults: "1",
          currency: "USD",
          market: "en-US",
          countryCode: "IL",
        },
      );

      const itineraries = payload.data?.itineraries ?? [];
      for (const item of itineraries.slice(0, 3)) {
        const priceUsd = Number(item.price?.raw);
        if (!Number.isFinite(priceUsd) || priceUsd > FLIGHT_DEALS_MAX_PRICE_USD) {
          continue;
        }

        const outLeg = item.legs?.[0];
        const retLeg = item.legs?.[1];
        const outDate = outLeg?.departure?.slice(0, 10) || departureDate;
        const inDate = retLeg?.departure?.slice(0, 10) || returnDate;
        const destCode = String(
          outLeg?.destination?.displayCode ??
            outLeg?.destination?.id ??
            dest.skyId,
        )
          .trim()
          .toUpperCase()
          .slice(0, 3);

        deals.push({
          id: buildDealId(FLIGHT_DEALS_ORIGIN, destCode, outDate, inDate, priceUsd),
          origin: FLIGHT_DEALS_ORIGIN,
          destination: destCode,
          departureDate: outDate,
          returnDate: inDate,
          priceUsd,
          currency: "USD",
          bookingUrl: skyscannerBookingUrl(destCode, outDate, inDate),
          imageUrl: null,
          foundAt,
        });
      }
    } catch (error) {
      console.warn(`[skyscanner] ${query} failed:`, error);
    }
  }

  return deals.sort((a, b) => a.priceUsd - b.priceUsd);
}
