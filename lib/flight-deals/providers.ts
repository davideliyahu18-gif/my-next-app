import type { FlightDeal } from "./types";
import { FLIGHT_DEALS_MAX_PRICE_USD, FLIGHT_DEALS_ORIGIN } from "./constants";

export type FlightDealProvider =
  | "travelpayouts"
  | "serpapi"
  | "skyscanner"
  | "amadeus"
  | "demo"
  | "merged";

/** Europe Knowledge Graph id — surfaces more cheap regional destinations. */
const EUROPE_AREA_ID = "/m/02j9z";

let monthRotate = 0;
let serpCache: { at: number; deals: FlightDeal[] | null } = { at: 0, deals: null };

function buildDealId(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  priceUsd: number,
): string {
  return `${origin}-${destination}-${departureDate}-${returnDate}-${priceUsd.toFixed(2)}`;
}

function isoDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function demoDeals(): FlightDeal[] {
  const foundAt = new Date().toISOString();
  const depart = new Date(Date.now() + 14 * 86_400_000);
  const ret = new Date(depart.getTime() + 5 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return [
    {
      id: buildDealId(FLIGHT_DEALS_ORIGIN, "ATH", fmt(depart), fmt(ret), 49.9),
      origin: FLIGHT_DEALS_ORIGIN,
      destination: "ATH",
      destinationNameHe: "אתונה",
      countryNameHe: "יוון",
      departureDate: fmt(depart),
      returnDate: fmt(ret),
      priceUsd: 49.9,
      currency: "USD",
      bookingUrl: null,
      imageUrl: null,
      foundAt,
    },
  ];
}

export async function searchViaTravelpayouts(): Promise<FlightDeal[]> {
  const token = process.env.TRAVELPAYOUTS_TOKEN ?? "";
  if (!token) throw new Error("TRAVELPAYOUTS_TOKEN is not set");

  const params = new URLSearchParams({
    origin: FLIGHT_DEALS_ORIGIN,
    currency: "usd",
    market: "il",
  });

  const response = await fetch(
    `https://api.travelpayouts.com/v1/city-directions?${params}`,
    {
      headers: { "X-Access-Token": token },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Travelpayouts HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    data?: Record<
      string,
      {
        origin?: string;
        destination?: string;
        price?: number;
        departure_at?: string;
        return_at?: string;
      }
    >;
    error?: string | null;
  };

  if (!payload.success) {
    throw new Error(payload.error ?? "Travelpayouts returned success=false");
  }

  const foundAt = new Date().toISOString();
  const deals: FlightDeal[] = [];

  for (const row of Object.values(payload.data ?? {})) {
    const destination = String(row.destination ?? "").trim();
    const departureDate = isoDateOnly(row.departure_at);
    const returnDate = isoDateOnly(row.return_at);
    const priceUsd = Number(row.price);

    if (!destination || !departureDate || !returnDate || !Number.isFinite(priceUsd)) {
      continue;
    }
    if (priceUsd > FLIGHT_DEALS_MAX_PRICE_USD) continue;

    deals.push({
      id: buildDealId(FLIGHT_DEALS_ORIGIN, destination, departureDate, returnDate, priceUsd),
      origin: row.origin ?? FLIGHT_DEALS_ORIGIN,
      destination,
      destinationNameHe: null,
      countryNameHe: null,
      departureDate,
      returnDate,
      priceUsd,
      currency: "USD",
      bookingUrl: `https://www.aviasales.com/search/${FLIGHT_DEALS_ORIGIN}${departureDate}${destination}${returnDate}1`,
      imageUrl: null,
      foundAt,
    });
  }

  return deals.sort((a, b) => a.priceUsd - b.priceUsd);
}

type SerpExploreDestinationExtended = {
  name?: string;
  country?: string;
  destination_airport?: { code?: string };
  start_date?: string;
  end_date?: string;
  flight_price?: number;
  link?: string;
  thumbnail?: string;
};

function upcomingMonths(count = 6): number[] {
  const now = new Date();
  const months: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    months.push(d.getUTCMonth() + 1);
  }
  return months;
}

function parseExploreDestinations(
  destinations: SerpExploreDestinationExtended[] | undefined,
  foundAt: string,
): FlightDeal[] {
  const deals: FlightDeal[] = [];
  for (const row of destinations ?? []) {
    const destinationCode = String(row.destination_airport?.code ?? "").trim();
    const destinationNameHe = String(row.name ?? "").trim() || null;
    const countryNameHe = String(row.country ?? "").trim() || null;
    const destination = destinationCode || destinationNameHe || "";
    const departureDate = String(row.start_date ?? "").trim();
    const returnDate = String(row.end_date ?? "").trim();
    const priceUsd = Number(row.flight_price);

    if (!destination || !departureDate || !returnDate || !Number.isFinite(priceUsd)) {
      continue;
    }
    if (priceUsd > FLIGHT_DEALS_MAX_PRICE_USD) continue;

    deals.push({
      id: buildDealId(FLIGHT_DEALS_ORIGIN, destination, departureDate, returnDate, priceUsd),
      origin: FLIGHT_DEALS_ORIGIN,
      destination,
      destinationNameHe,
      countryNameHe,
      departureDate,
      returnDate,
      priceUsd,
      currency: "USD",
      bookingUrl: row.link ?? null,
      imageUrl: row.thumbnail ?? null,
      foundAt,
    });
  }
  return deals;
}

async function fetchExplore(
  apiKey: string,
  extra: Record<string, string> = {},
): Promise<FlightDeal[]> {
  const params = new URLSearchParams({
    engine: "google_travel_explore",
    departure_id: FLIGHT_DEALS_ORIGIN,
    type: "1",
    currency: "USD",
    gl: "il",
    hl: "he",
    api_key: apiKey,
    ...extra,
  });

  const response = await fetch(`https://serpapi.com/search.json?${params}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`SerpAPI HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    error?: string;
    destinations?: SerpExploreDestinationExtended[];
  };

  if (payload.error) {
    throw new Error(`SerpAPI: ${payload.error}`);
  }

  return parseExploreDestinations(payload.destinations, new Date().toISOString());
}

export async function searchViaSerpApi(): Promise<FlightDeal[]> {
  const apiKey = process.env.SERPAPI_API_KEY ?? "";
  if (!apiKey) throw new Error("SERPAPI_API_KEY is not set");

  const cacheMs = Number(process.env.SERPAPI_CACHE_MS ?? String(6 * 60 * 60_000));
  if (serpCache.deals && Date.now() - serpCache.at < cacheMs) {
    return serpCache.deals;
  }

  // Do NOT send max_price to Google Explore — it strips flight_price when
  // the cap is too low. Filter client-side instead.
  const months = upcomingMonths(6);
  const month = months[monthRotate % months.length];
  const useEurope = monthRotate % 2 === 0;
  const duration = monthRotate % 3 === 0 ? "1" : "2";
  monthRotate = (monthRotate + 1) % Math.max(months.length, 1);

  const queries: Promise<FlightDeal[]>[] = [
    useEurope
      ? fetchExplore(apiKey, { arrival_area_id: EUROPE_AREA_ID })
      : fetchExplore(apiKey),
    fetchExplore(apiKey, { month: String(month), travel_duration: duration }),
  ];

  const results = await Promise.allSettled(queries);
  const lists: FlightDeal[][] = [];
  for (const r of results) {
    if (r.status === "fulfilled") lists.push(r.value);
    else console.warn("[flight-deals] serpapi window failed:", r.reason);
  }

  if (serpCache.deals?.length) lists.push(serpCache.deals);

  const deals = mergeDeals(lists);
  serpCache = { at: Date.now(), deals };
  return deals;
}

export function resolveFlightProvider(): FlightDealProvider | null {
  if (process.env.FLIGHT_DEALS_DEMO === "true") return "demo";
  if (process.env.TRAVELPAYOUTS_TOKEN) return "travelpayouts";
  const hasSerp = Boolean(process.env.SERPAPI_API_KEY);
  const hasSky = Boolean(
    process.env.SKYSCANNER_RAPIDAPI_KEY ?? process.env.RAPIDAPI_KEY,
  );
  if (hasSerp && hasSky) return "merged";
  if (hasSerp) return "serpapi";
  if (hasSky) return "skyscanner";
  if (process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET) {
    return "amadeus";
  }
  return null;
}

function mergeDeals(lists: FlightDeal[][]): FlightDeal[] {
  const byKey = new Map<string, FlightDeal>();
  for (const list of lists) {
    for (const deal of list) {
      const key = `${deal.origin}-${deal.destination}-${deal.departureDate}-${deal.returnDate}`;
      const existing = byKey.get(key);
      if (!existing || deal.priceUsd < existing.priceUsd) {
        const priceUsd = Math.min(deal.priceUsd, existing?.priceUsd ?? deal.priceUsd);
        byKey.set(key, {
          ...deal,
          priceUsd,
          id: buildDealId(
            deal.origin,
            deal.destination,
            deal.departureDate,
            deal.returnDate,
            priceUsd,
          ),
          imageUrl: deal.imageUrl || existing?.imageUrl || null,
          bookingUrl: deal.bookingUrl || existing?.bookingUrl || null,
          destinationNameHe:
            deal.destinationNameHe || existing?.destinationNameHe || null,
          countryNameHe: deal.countryNameHe || existing?.countryNameHe || null,
        });
      } else if (existing && !existing.imageUrl && deal.imageUrl) {
        byKey.set(key, { ...existing, imageUrl: deal.imageUrl });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.priceUsd - b.priceUsd);
}

export async function searchCheapRoundTripsFromTlv(): Promise<{
  deals: FlightDeal[];
  provider: FlightDealProvider;
}> {
  const provider = resolveFlightProvider();

  if (!provider) {
    throw new Error(
      "No flight price provider configured. Set SERPAPI_API_KEY and/or SKYSCANNER_RAPIDAPI_KEY (RapidAPI), TRAVELPAYOUTS_TOKEN, Amadeus, or FLIGHT_DEALS_DEMO=true.",
    );
  }

  if (provider === "demo") {
    return { deals: demoDeals(), provider };
  }

  if (provider === "travelpayouts") {
    return { deals: await searchViaTravelpayouts(), provider };
  }

  if (provider === "merged") {
    const { searchViaSkyscanner } = await import("./skyscanner");
    const results = await Promise.allSettled([
      searchViaSerpApi(),
      searchViaSkyscanner(),
    ]);
    const lists = results
      .filter((r): r is PromiseFulfilledResult<FlightDeal[]> => r.status === "fulfilled")
      .map((r) => r.value);
    for (const r of results) {
      if (r.status === "rejected") {
        console.warn("[flight-deals] provider failed:", r.reason);
      }
    }
    return { deals: mergeDeals(lists), provider: "merged" };
  }

  if (provider === "serpapi") {
    return { deals: await searchViaSerpApi(), provider };
  }

  if (provider === "skyscanner") {
    const { searchViaSkyscanner } = await import("./skyscanner");
    return { deals: await searchViaSkyscanner(), provider };
  }

  const { searchCheapRoundTripsFromTlv: amadeusSearch } = await import("./amadeus");
  return { deals: await amadeusSearch(), provider: "amadeus" };
}
