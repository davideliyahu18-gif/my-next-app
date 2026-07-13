import type { FlightDeal } from "./types";
import { FLIGHT_DEALS_MAX_PRICE_USD, FLIGHT_DEALS_ORIGIN } from "./constants";

const RAPIDAPI_HOST = "sky-scrapper.p.rapidapi.com";

declare global {
  var __skyscannerTlvCache:
    | { skyId: string; entityId: string; expiresAt: number }
    | undefined;
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

function buildDealId(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  priceUsd: number,
): string {
  return `sky-${origin}-${destination}-${departureDate}-${returnDate}-${priceUsd.toFixed(2)}`;
}

function isoDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
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

async function resolveTlvPlace(): Promise<{ skyId: string; entityId: string }> {
  const cached = globalThis.__skyscannerTlvCache;
  if (cached && cached.expiresAt > Date.now()) {
    return { skyId: cached.skyId, entityId: cached.entityId };
  }

  const params = new URLSearchParams({
    query: "Tel Aviv",
    locale: "en-US",
  });
  const response = await fetch(
    `https://${RAPIDAPI_HOST}/api/v1/flights/searchAirport?${params}`,
    { headers: headers(), cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Skyscanner searchAirport HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ skyId?: string; entityId?: string; presentation?: { title?: string } }>;
  };

  const match =
    payload.data?.find((row) =>
      /tel aviv|tlv/i.test(
        `${row.skyId ?? ""} ${row.presentation?.title ?? ""} ${row.entityId ?? ""}`,
      ),
    ) ?? payload.data?.[0];

  if (!match?.skyId || !match?.entityId) {
    throw new Error("Skyscanner could not resolve Tel Aviv / TLV");
  }

  globalThis.__skyscannerTlvCache = {
    skyId: match.skyId,
    entityId: match.entityId,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };

  return { skyId: match.skyId, entityId: match.entityId };
}

type SkyEverywhereRow = {
  price?: number | { raw?: number; formatted?: string };
  flightQuotes?: { cheapestDirect?: { rawPrice?: number }; cheapestWithStops?: { rawPrice?: number } };
  content?: {
    location?: { skyCode?: string; name?: string; image?: string };
    flightQuotes?: {
      cheapest?: { price?: number | string; rawPrice?: number };
      direct?: { price?: number | string; rawPrice?: number };
    };
    image?: { url?: string };
  };
  skyId?: string;
  destination?: { skyId?: string; iata?: string; name?: string };
  departureDate?: string;
  returnDate?: string;
  outboundDate?: string;
  inboundDate?: string;
  imageUrl?: string;
  image?: string;
};

function extractPrice(row: SkyEverywhereRow): number | null {
  const candidates = [
    typeof row.price === "number" ? row.price : row.price?.raw,
    row.flightQuotes?.cheapestDirect?.rawPrice,
    row.flightQuotes?.cheapestWithStops?.rawPrice,
    row.content?.flightQuotes?.cheapest?.rawPrice,
    typeof row.content?.flightQuotes?.cheapest?.price === "number"
      ? row.content.flightQuotes.cheapest.price
      : Number(row.content?.flightQuotes?.cheapest?.price),
  ];

  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function extractDestination(row: SkyEverywhereRow): string {
  return String(
    row.content?.location?.skyCode ??
      row.destination?.iata ??
      row.destination?.skyId ??
      row.skyId ??
      "",
  )
    .trim()
    .toUpperCase()
    .replace(/A$/, "") // sometimes city codes like ATHA — keep first 3 if length 4?
    .slice(0, 3);
}

function extractDates(row: SkyEverywhereRow): { departureDate: string; returnDate: string } {
  const departureDate = isoDateOnly(
    row.departureDate ?? row.outboundDate ?? undefined,
  );
  const returnDate = isoDateOnly(row.returnDate ?? row.inboundDate ?? undefined);
  return { departureDate, returnDate };
}

function extractImage(row: SkyEverywhereRow): string | null {
  return (
    row.content?.location?.image ??
    row.content?.image?.url ??
    row.imageUrl ??
    row.image ??
    null
  );
}

function normalizeEverywherePayload(payload: unknown): SkyEverywhereRow[] {
  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;

  const buckets = [
    data.everywhereDestination,
    data.destinations,
    data.results,
    data.Quotes,
    data.quotes,
    Array.isArray(data) ? data : null,
  ];

  for (const bucket of buckets) {
    if (Array.isArray(bucket) && bucket.length) {
      return bucket as SkyEverywhereRow[];
    }
    if (bucket && typeof bucket === "object") {
      const nested = bucket as Record<string, unknown>;
      if (Array.isArray(nested.results)) return nested.results as SkyEverywhereRow[];
      if (Array.isArray(nested.destinations)) {
        return nested.destinations as SkyEverywhereRow[];
      }
    }
  }

  return [];
}

export async function searchViaSkyscanner(): Promise<FlightDeal[]> {
  if (!skyscannerConfigured()) {
    throw new Error("SKYSCANNER_RAPIDAPI_KEY / RAPIDAPI_KEY is not set");
  }

  const place = await resolveTlvPlace();
  const params = new URLSearchParams({
    originSkyId: place.skyId,
    originEntityId: place.entityId,
    cabinClass: "economy",
    journeyType: "round_trip",
    currency: "USD",
    countryCode: "IL",
    market: "he-IL",
  });

  const response = await fetch(
    `https://${RAPIDAPI_HOST}/api/v2/flights/searchFlightEverywhere?${params}`,
    { headers: headers(), cache: "no-store" },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Skyscanner everywhere HTTP ${response.status}: ${text}`);
  }

  const payload = await response.json();
  const rows = normalizeEverywherePayload(payload);
  const foundAt = new Date().toISOString();
  const deals: FlightDeal[] = [];

  for (const row of rows) {
    const destination = extractDestination(row);
    const priceUsd = extractPrice(row);
    let { departureDate, returnDate } = extractDates(row);

    // Everywhere results sometimes omit exact dates — use a flexible placeholder window
    if (!departureDate || !returnDate) {
      const depart = new Date(Date.now() + 21 * 86_400_000);
      const ret = new Date(depart.getTime() + 7 * 86_400_000);
      departureDate = departureDate || depart.toISOString().slice(0, 10);
      returnDate = returnDate || ret.toISOString().slice(0, 10);
    }

    if (!destination || !priceUsd || !Number.isFinite(priceUsd)) continue;
    if (priceUsd > FLIGHT_DEALS_MAX_PRICE_USD) continue;

    deals.push({
      id: buildDealId(FLIGHT_DEALS_ORIGIN, destination, departureDate, returnDate, priceUsd),
      origin: FLIGHT_DEALS_ORIGIN,
      destination,
      departureDate,
      returnDate,
      priceUsd,
      currency: "USD",
      bookingUrl: skyscannerBookingUrl(destination, departureDate, returnDate),
      imageUrl: extractImage(row),
      foundAt,
    });
  }

  return deals.sort((a, b) => a.priceUsd - b.priceUsd);
}
