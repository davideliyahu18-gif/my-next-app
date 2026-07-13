const ORIGIN = process.env.FLIGHT_DEALS_ORIGIN ?? "TLV";

function maxPrice() {
  return Number(process.env.FLIGHT_DEALS_MAX_PRICE_USD ?? "100");
}

function buildDealId(origin, destination, departureDate, returnDate, priceUsd) {
  return `${origin}-${destination}-${departureDate}-${returnDate}-${priceUsd.toFixed(2)}`;
}

function isoDateOnly(value) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function resolveProvider() {
  if (process.env.FLIGHT_DEALS_DEMO === "true") return "demo";
  if (process.env.TRAVELPAYOUTS_TOKEN) return "travelpayouts";
  const hasSerp = Boolean(process.env.SERPAPI_API_KEY);
  const hasSky = Boolean(
    process.env.SKYSCANNER_RAPIDAPI_KEY ?? process.env.RAPIDAPI_KEY,
  );
  if (hasSerp && hasSky) return "merged";
  if (hasSerp) return "serpapi";
  if (hasSky) return "skyscanner";
  if (process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET) return "amadeus";
  return null;
}

function demoDeals() {
  const foundAt = new Date().toISOString();
  const depart = new Date(Date.now() + 14 * 86_400_000);
  const ret = new Date(depart.getTime() + 5 * 86_400_000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return [
    {
      id: buildDealId(ORIGIN, "ATH", fmt(depart), fmt(ret), 49.9),
      origin: ORIGIN,
      destination: "ATH",
      departureDate: fmt(depart),
      returnDate: fmt(ret),
        priceUsd: 49.9,
        bookingUrl: null,
        imageUrl: null,
      },
    ];
  }

async function searchTravelpayouts() {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  const params = new URLSearchParams({ origin: ORIGIN, currency: "usd", market: "il" });
  const res = await fetch(`https://api.travelpayouts.com/v1/city-directions?${params}`, {
    headers: { "X-Access-Token": token },
  });
  if (!res.ok) throw new Error(`Travelpayouts HTTP ${res.status}`);
  const payload = await res.json();
  if (!payload.success) throw new Error(payload.error ?? "Travelpayouts failed");

  const deals = [];
  for (const row of Object.values(payload.data ?? {})) {
    const destination = String(row.destination ?? "").trim();
    const departureDate = isoDateOnly(row.departure_at);
    const returnDate = isoDateOnly(row.return_at);
    const priceUsd = Number(row.price);
    if (!destination || !departureDate || !returnDate || !Number.isFinite(priceUsd)) continue;
    if (priceUsd > maxPrice()) continue;
    deals.push({
      id: buildDealId(ORIGIN, destination, departureDate, returnDate, priceUsd),
      origin: row.origin ?? ORIGIN,
      destination,
      departureDate,
      returnDate,
      priceUsd,
      bookingUrl: `https://www.aviasales.com/search/${ORIGIN}${departureDate}${destination}${returnDate}1`,
      imageUrl: null,
    });
  }
  return deals.sort((a, b) => a.priceUsd - b.priceUsd);
}

async function searchSerpApi() {
  // Don't send max_price to Google — it omits flight_price when the cap is too low.
  const params = new URLSearchParams({
    engine: "google_travel_explore",
    departure_id: ORIGIN,
    type: "1",
    currency: "USD",
    gl: "il",
    hl: "he",
    api_key: process.env.SERPAPI_API_KEY,
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`);
  const payload = await res.json();
  if (payload.error) throw new Error(payload.error);

  const deals = [];
  for (const row of payload.destinations ?? []) {
    const destination = String(row.destination_airport?.code ?? row.name ?? "").trim();
    const departureDate = String(row.start_date ?? "").trim();
    const returnDate = String(row.end_date ?? "").trim();
    const priceUsd = Number(row.flight_price);
    if (!destination || !departureDate || !returnDate || !Number.isFinite(priceUsd)) continue;
    if (priceUsd > maxPrice()) continue;
    deals.push({
      id: buildDealId(ORIGIN, destination, departureDate, returnDate, priceUsd),
      origin: ORIGIN,
      destination,
      departureDate,
      returnDate,
      priceUsd,
      bookingUrl: row.link ?? null,
      imageUrl: row.thumbnail ?? null,
    });
  }
  return deals.sort((a, b) => a.priceUsd - b.priceUsd);
}

async function searchAmadeus() {
  const base = process.env.AMADEUS_API_BASE ?? "https://test.api.amadeus.com";
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AMADEUS_CLIENT_ID,
    client_secret: process.env.AMADEUS_CLIENT_SECRET,
  });
  const authRes = await fetch(`${base}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!authRes.ok) throw new Error(`Amadeus auth HTTP ${authRes.status}`);
  const auth = await authRes.json();

  const params = new URLSearchParams({
    origin: ORIGIN,
    maxPrice: String(maxPrice()),
    currency: "USD",
    oneWay: "false",
  });
  const res = await fetch(`${base}/v1/shopping/flight-destinations?${params}`, {
    headers: { Authorization: `Bearer ${auth.access_token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Amadeus HTTP ${res.status}`);
  const payload = await res.json();

  const deals = [];
  for (const row of payload.data ?? []) {
    const priceUsd = Number(row.price?.total);
    if (!row.destination || !row.departureDate || !row.returnDate) continue;
    if (!Number.isFinite(priceUsd) || priceUsd > maxPrice()) continue;
    deals.push({
      id: buildDealId(ORIGIN, row.destination, row.departureDate, row.returnDate, priceUsd),
      origin: row.origin ?? ORIGIN,
      destination: row.destination,
      departureDate: row.departureDate,
      returnDate: row.returnDate,
      priceUsd,
      bookingUrl: row.links?.flightOffers ?? null,
      imageUrl: null,
    });
  }
  return deals.sort((a, b) => a.priceUsd - b.priceUsd);
}

async function searchSkyscanner() {
  const key =
    process.env.SKYSCANNER_RAPIDAPI_KEY ?? process.env.RAPIDAPI_KEY ?? "";
  const host = "sky-scrapper.p.rapidapi.com";
  const headers = {
    "X-RapidAPI-Key": key,
    "X-RapidAPI-Host": host,
  };

  const airportRes = await fetch(
    `https://${host}/api/v1/flights/searchAirport?query=Tel%20Aviv&locale=en-US`,
    { headers },
  );
  if (!airportRes.ok) throw new Error(`Skyscanner airport HTTP ${airportRes.status}`);
  const airportPayload = await airportRes.json();
  const place =
    (airportPayload.data ?? []).find((row) =>
      /tel aviv|tlv/i.test(`${row.skyId ?? ""} ${row.presentation?.title ?? ""}`),
    ) ?? airportPayload.data?.[0];
  if (!place?.skyId || !place?.entityId) {
    throw new Error("Skyscanner TLV resolve failed");
  }

  const params = new URLSearchParams({
    originSkyId: place.skyId,
    originEntityId: place.entityId,
    cabinClass: "economy",
    journeyType: "round_trip",
    currency: "USD",
    countryCode: "IL",
    market: "he-IL",
  });
  const res = await fetch(
    `https://${host}/api/v2/flights/searchFlightEverywhere?${params}`,
    { headers },
  );
  if (!res.ok) throw new Error(`Skyscanner everywhere HTTP ${res.status}`);
  const payload = await res.json();
  const data = payload.data ?? payload;
  const rows =
    data.everywhereDestination ??
    data.destinations ??
    data.results ??
    (Array.isArray(data) ? data : []) ??
    [];

  const deals = [];
  for (const row of rows) {
    const destination = String(
      row.content?.location?.skyCode ??
        row.destination?.iata ??
        row.destination?.skyId ??
        row.skyId ??
        "",
    )
      .trim()
      .toUpperCase()
      .slice(0, 3);
    const priceUsd = Number(
      row.price?.raw ??
        row.price ??
        row.flightQuotes?.cheapestDirect?.rawPrice ??
        row.content?.flightQuotes?.cheapest?.rawPrice ??
        row.content?.flightQuotes?.cheapest?.price,
    );
    let departureDate = isoDateOnly(row.departureDate ?? row.outboundDate);
    let returnDate = isoDateOnly(row.returnDate ?? row.inboundDate);
    if (!departureDate || !returnDate) {
      const depart = new Date(Date.now() + 21 * 86_400_000);
      const ret = new Date(depart.getTime() + 7 * 86_400_000);
      departureDate = departureDate || depart.toISOString().slice(0, 10);
      returnDate = returnDate || ret.toISOString().slice(0, 10);
    }
    if (!destination || !Number.isFinite(priceUsd) || priceUsd > maxPrice()) continue;
    const out = departureDate.replace(/-/g, "").slice(2);
    const ret = returnDate.replace(/-/g, "").slice(2);
    deals.push({
      id: `sky-${buildDealId(ORIGIN, destination, departureDate, returnDate, priceUsd)}`,
      origin: ORIGIN,
      destination,
      departureDate,
      returnDate,
      priceUsd,
      bookingUrl: `https://www.skyscanner.co.il/transport/flights/${ORIGIN.toLowerCase()}/${destination.toLowerCase()}/${out}/${ret}/`,
      imageUrl:
        row.content?.location?.image ??
        row.content?.image?.url ??
        row.imageUrl ??
        null,
    });
  }
  return deals.sort((a, b) => a.priceUsd - b.priceUsd);
}

function mergeDeals(lists) {
  const byKey = new Map();
  for (const list of lists) {
    for (const deal of list) {
      const key = `${deal.origin}-${deal.destination}-${deal.departureDate}-${deal.returnDate}`;
      const existing = byKey.get(key);
      if (!existing || deal.priceUsd < existing.priceUsd) {
        byKey.set(key, {
          ...deal,
          imageUrl: deal.imageUrl || existing?.imageUrl || null,
          bookingUrl: deal.bookingUrl || existing?.bookingUrl || null,
        });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.priceUsd - b.priceUsd);
}

export async function searchDeals() {
  const provider = resolveProvider();
  if (!provider) {
    throw new Error(
      "הגדר SERPAPI_API_KEY ו/או SKYSCANNER_RAPIDAPI_KEY, או FLIGHT_DEALS_DEMO=true",
    );
  }

  if (provider === "demo") return demoDeals();
  if (provider === "travelpayouts") return searchTravelpayouts();
  if (provider === "merged") {
    const results = await Promise.allSettled([searchSerpApi(), searchSkyscanner()]);
    const lists = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);
    for (const r of results) {
      if (r.status === "rejected") console.warn("[providers]", r.reason);
    }
    return mergeDeals(lists);
  }
  if (provider === "serpapi") return searchSerpApi();
  if (provider === "skyscanner") return searchSkyscanner();
  return searchAmadeus();
}
