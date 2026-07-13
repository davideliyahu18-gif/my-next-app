import {
  AMADEUS_API_BASE,
  AMADEUS_CLIENT_ID,
  AMADEUS_CLIENT_SECRET,
  FLIGHT_DEALS_CURRENCY,
  FLIGHT_DEALS_MAX_PRICE_USD,
  FLIGHT_DEALS_ORIGIN,
} from "./constants";
import type { FlightDeal } from "./types";

type AmadeusTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type AmadeusDestinationRow = {
  type?: string;
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  price?: {
    total?: string;
  };
  links?: {
    flightOffers?: string;
  };
};

type AmadeusDestinationsResponse = {
  data?: AmadeusDestinationRow[];
  errors?: Array<{ title?: string; detail?: string }>;
};

declare global {
  var __amadeusTokenCache:
    | { token: string; expiresAt: number }
    | undefined;
}

function isAmadeusConfigured(): boolean {
  return Boolean(AMADEUS_CLIENT_ID && AMADEUS_CLIENT_SECRET);
}

export function amadeusConfigured(): boolean {
  return isAmadeusConfigured();
}

async function fetchAmadeusToken(): Promise<string> {
  const cached = globalThis.__amadeusTokenCache;
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: AMADEUS_CLIENT_ID,
    client_secret: AMADEUS_CLIENT_SECRET,
  });

  const response = await fetch(`${AMADEUS_API_BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Amadeus auth failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as AmadeusTokenResponse;
  if (!payload.access_token) {
    throw new Error("Amadeus auth returned no access_token");
  }

  const expiresInMs = (payload.expires_in ?? 1800) * 1000;
  globalThis.__amadeusTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + expiresInMs,
  };

  return payload.access_token;
}

function buildDealId(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  priceUsd: number,
): string {
  return `${origin}-${destination}-${departureDate}-${returnDate}-${priceUsd.toFixed(2)}`;
}

export async function searchCheapRoundTripsFromTlv(): Promise<FlightDeal[]> {
  if (!isAmadeusConfigured()) {
    throw new Error(
      "Amadeus API is not configured. Set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET.",
    );
  }

  const token = await fetchAmadeusToken();
  const params = new URLSearchParams({
    origin: FLIGHT_DEALS_ORIGIN,
    maxPrice: String(FLIGHT_DEALS_MAX_PRICE_USD),
    currency: FLIGHT_DEALS_CURRENCY,
    oneWay: "false",
  });

  const response = await fetch(
    `${AMADEUS_API_BASE}/v1/shopping/flight-destinations?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Amadeus flight-destinations HTTP ${response.status}: ${text}`);
  }

  const payload = (await response.json()) as AmadeusDestinationsResponse;
  if (payload.errors?.length) {
    const detail = payload.errors.map((e) => e.detail || e.title).join("; ");
    throw new Error(`Amadeus API error: ${detail}`);
  }

  const foundAt = new Date().toISOString();
  const deals: FlightDeal[] = [];

  for (const row of payload.data ?? []) {
    const origin = String(row.origin ?? FLIGHT_DEALS_ORIGIN).trim();
    const destination = String(row.destination ?? "").trim();
    const departureDate = String(row.departureDate ?? "").trim();
    const returnDate = String(row.returnDate ?? "").trim();
    const priceUsd = Number(row.price?.total);

    if (!destination || !departureDate || !returnDate || !Number.isFinite(priceUsd)) {
      continue;
    }

    if (priceUsd > FLIGHT_DEALS_MAX_PRICE_USD) continue;

    deals.push({
      id: buildDealId(origin, destination, departureDate, returnDate, priceUsd),
      origin,
      destination,
      departureDate,
      returnDate,
      priceUsd,
      currency: FLIGHT_DEALS_CURRENCY,
      bookingUrl: row.links?.flightOffers ?? null,
      imageUrl: null,
      destinationNameHe: null,
      countryNameHe: null,
      foundAt,
    });
  }

  return deals.sort((a, b) => a.priceUsd - b.priceUsd);
}
