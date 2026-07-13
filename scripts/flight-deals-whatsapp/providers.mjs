const ORIGIN = process.env.FLIGHT_DEALS_ORIGIN ?? "TLV";
const MAX_PRICE = Number(process.env.FLIGHT_DEALS_MAX_PRICE_USD ?? "50");

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
  if (process.env.SERPAPI_API_KEY) return "serpapi";
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
    if (priceUsd > MAX_PRICE) continue;
    deals.push({
      id: buildDealId(ORIGIN, destination, departureDate, returnDate, priceUsd),
      origin: row.origin ?? ORIGIN,
      destination,
      departureDate,
      returnDate,
      priceUsd,
      bookingUrl: `https://www.aviasales.com/search/${ORIGIN}${departureDate}${destination}${returnDate}1`,
    });
  }
  return deals.sort((a, b) => a.priceUsd - b.priceUsd);
}

async function searchSerpApi() {
  const params = new URLSearchParams({
    engine: "google_travel_explore",
    departure_id: ORIGIN,
    type: "1",
    max_price: String(MAX_PRICE),
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
    const destination = String(row.destination_airport?.code ?? "").trim();
    const departureDate = String(row.start_date ?? "").trim();
    const returnDate = String(row.end_date ?? "").trim();
    const priceUsd = Number(row.flight_price);
    if (!destination || !departureDate || !returnDate || !Number.isFinite(priceUsd)) continue;
    if (priceUsd > MAX_PRICE) continue;
    deals.push({
      id: buildDealId(ORIGIN, destination, departureDate, returnDate, priceUsd),
      origin: ORIGIN,
      destination,
      departureDate,
      returnDate,
      priceUsd,
      bookingUrl: row.link ?? null,
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
    maxPrice: String(MAX_PRICE),
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
    if (!Number.isFinite(priceUsd) || priceUsd > MAX_PRICE) continue;
    deals.push({
      id: buildDealId(ORIGIN, row.destination, row.departureDate, row.returnDate, priceUsd),
      origin: row.origin ?? ORIGIN,
      destination: row.destination,
      departureDate: row.departureDate,
      returnDate: row.returnDate,
      priceUsd,
      bookingUrl: row.links?.flightOffers ?? null,
    });
  }
  return deals.sort((a, b) => a.priceUsd - b.priceUsd);
}

export async function searchDeals() {
  const provider = resolveProvider();
  if (!provider) {
    throw new Error(
      "הגדר TRAVELPAYOUTS_TOKEN, SERPAPI_API_KEY, Amadeus, או FLIGHT_DEALS_DEMO=true",
    );
  }

  if (provider === "demo") return demoDeals();
  if (provider === "travelpayouts") return searchTravelpayouts();
  if (provider === "serpapi") return searchSerpApi();
  return searchAmadeus();
}
