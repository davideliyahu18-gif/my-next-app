const ORIGIN = process.env.FLIGHT_DEALS_ORIGIN ?? "TLV";
const HOST = "sky-scrapper.p.rapidapi.com";

const DEST_QUERIES = [
  "Athens", "Larnaca", "Budapest", "Sofia", "Bucharest", "Krakow",
  "Warsaw", "Rome", "Milan", "Barcelona", "Venice", "Prague",
  "Vienna", "Paphos", "Istanbul",
];

let rotateIndex = 0;
const placeCache = new Map();

function maxPrice() {
  return Number(process.env.FLIGHT_DEALS_MAX_PRICE_USD ?? "100");
}

function rapidKey() {
  return process.env.SKYSCANNER_RAPIDAPI_KEY ?? process.env.RAPIDAPI_KEY ?? "";
}

function headers() {
  return {
    "X-RapidAPI-Key": rapidKey(),
    "X-RapidAPI-Host": HOST,
  };
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
  const hasSky = Boolean(rapidKey());
  if (hasSerp && hasSky) return "merged";
  if (hasSerp) return "serpapi";
  if (hasSky) return "skyscanner";
  if (process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET) return "amadeus";
  return null;
}

function demoDeals() {
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

async function resolvePlace(query) {
  if (placeCache.has(query)) return placeCache.get(query);
  const res = await fetch(
    `https://${HOST}/api/v1/flights/searchAirport?query=${encodeURIComponent(query)}&locale=en-US`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`Skyscanner airport HTTP ${res.status}`);
  const payload = await res.json();
  const params = payload.data?.[0]?.navigation?.relevantFlightParams;
  if (!params?.skyId || !params?.entityId) return null;
  const place = { skyId: params.skyId, entityId: params.entityId };
  placeCache.set(query, place);
  return place;
}

async function searchSkyscanner() {
  const origin = await resolvePlace("Tel Aviv");
  if (!origin) throw new Error("Skyscanner TLV resolve failed");

  const batchSize = Number(process.env.SKYSCANNER_DEST_BATCH ?? "4");
  const batch = [];
  for (let i = 0; i < Math.min(batchSize, DEST_QUERIES.length); i += 1) {
    batch.push(DEST_QUERIES[(rotateIndex + i) % DEST_QUERIES.length]);
  }
  rotateIndex = (rotateIndex + batchSize) % DEST_QUERIES.length;

  const depart = new Date(Date.now() + 21 * 86_400_000);
  const ret = new Date(depart.getTime() + 7 * 86_400_000);
  const departureDate = depart.toISOString().slice(0, 10);
  const returnDate = ret.toISOString().slice(0, 10);
  const deals = [];

  for (const query of batch) {
    try {
      const dest = await resolvePlace(query);
      if (!dest) continue;
      const params = new URLSearchParams({
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
      });
      const res = await fetch(
        `https://${HOST}/api/v1/flights/searchFlights?${params}`,
        { headers: headers() },
      );
      if (!res.ok) continue;
      const payload = await res.json();
      for (const item of (payload.data?.itineraries ?? []).slice(0, 3)) {
        const priceUsd = Number(item.price?.raw);
        if (!Number.isFinite(priceUsd) || priceUsd > maxPrice()) continue;
        const outLeg = item.legs?.[0];
        const retLeg = item.legs?.[1];
        const outDate = outLeg?.departure?.slice(0, 10) || departureDate;
        const inDate = retLeg?.departure?.slice(0, 10) || returnDate;
        const destCode = String(
          outLeg?.destination?.displayCode ?? outLeg?.destination?.id ?? dest.skyId,
        )
          .trim()
          .toUpperCase()
          .slice(0, 3);
        const out = outDate.replace(/-/g, "").slice(2);
        const inn = inDate.replace(/-/g, "").slice(2);
        deals.push({
          id: `sky-${buildDealId(ORIGIN, destCode, outDate, inDate, priceUsd)}`,
          origin: ORIGIN,
          destination: destCode,
          departureDate: outDate,
          returnDate: inDate,
          priceUsd,
          bookingUrl: `https://www.skyscanner.co.il/transport/flights/${ORIGIN.toLowerCase()}/${destCode.toLowerCase()}/${out}/${inn}/`,
          imageUrl: null,
        });
      }
    } catch (error) {
      console.warn("[skyscanner]", query, error);
    }
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
    const lists = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    for (const r of results) {
      if (r.status === "rejected") console.warn("[providers]", r.reason);
    }
    return mergeDeals(lists);
  }
  if (provider === "serpapi") return searchSerpApi();
  if (provider === "skyscanner") return searchSkyscanner();
  return searchAmadeus();
}
