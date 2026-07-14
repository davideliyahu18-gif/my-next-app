const ORIGIN = process.env.FLIGHT_DEALS_ORIGIN ?? "TLV";
const HOST = "sky-scrapper.p.rapidapi.com";
/** Europe Knowledge Graph id — surfaces more cheap regional destinations. */
const EUROPE_AREA_ID = "/m/02j9z";

const DEST_QUERIES = [
  "Athens", "Larnaca", "Paphos", "Budapest", "Sofia", "Bucharest", "Krakow",
  "Warsaw", "Rome", "Milan", "Barcelona", "Venice", "Prague",
  "Vienna", "Istanbul", "Naples",
];

let rotateIndex = 0;
/** Rotate through July→December weekend windows from the start. */
let weekendRotate = 0;
let skyCooldownUntil = 0;
const placeCache = new Map();
let serpCache = { at: 0, deals: null };
let thailandCache = { at: 0, deals: null };

/** Permanent Thailand watch — DD/MM/YYYY 10/02/2027–10/03/2027 */
export function thailandWatchConfig() {
  return {
    outbound: process.env.FLIGHT_DEALS_THAILAND_OUTBOUND ?? "2027-02-10",
    returnDate: process.env.FLIGHT_DEALS_THAILAND_RETURN ?? "2027-03-10",
    airports: String(process.env.FLIGHT_DEALS_THAILAND_AIRPORTS ?? "BKK,DMK")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
    maxPrice: Number(process.env.FLIGHT_DEALS_THAILAND_MAX_PRICE_USD ?? "1200"),
  };
}

/** JS getUTCDay(): Sun=0 … Sat=6 */
const DOW = { sun: 0, mon: 1, wed: 3, thu: 4 };

function maxPrice() {
  return Number(process.env.FLIGHT_DEALS_MAX_PRICE_USD ?? "150");
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

/** Fingerprint without price — used for soft dedup / price-drop alerts. */
export function dealFingerprint(deal) {
  return `${deal.origin}-${deal.destination}-${deal.departureDate}-${deal.returnDate}`;
}

function isoDateOnly(value) {
  if (!value) return "";
  return value.slice(0, 10);
}

function utcDay(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return -1;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** רביעי→שני או חמישי→ראשון בלבד */
export function matchesPreferredTripDays(departureDate, returnDate) {
  const out = utcDay(departureDate);
  const back = utcDay(returnDate);
  if (out === DOW.wed && back === DOW.mon) return true;
  if (out === DOW.thu && back === DOW.sun) return true;
  return false;
}

function toIso(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Fixed windows רביעי→שני / חמישי→ראשון from July through December.
 * Uses the current calendar year (or next year if we're already past Dec).
 * Skips dates that are already in the past (+ minLeadDays).
 */
export function preferredDateWindows({
  minLeadDays = 3,
  startMonth = Number(process.env.FLIGHT_DEALS_START_MONTH ?? "7"),
  endMonth = Number(process.env.FLIGHT_DEALS_END_MONTH ?? "12"),
} = {}) {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  let year = now.getUTCFullYear();
  // If we're past the end month, roll to next year's Jul–Dec range.
  if (now.getUTCMonth() + 1 > endMonth) year += 1;

  const rangeStart = new Date(Date.UTC(year, startMonth - 1, 1));
  const rangeEnd = new Date(Date.UTC(year, endMonth, 0)); // last day of endMonth

  const earliest = new Date(now);
  earliest.setUTCDate(earliest.getUTCDate() + minLeadDays);
  const cursorStart = rangeStart > earliest ? rangeStart : earliest;

  const windows = [];
  const cursor = new Date(cursorStart);
  // walk day-by-day and collect matching outbound days
  while (cursor <= rangeEnd) {
    const dow = cursor.getUTCDay();
    if (dow === DOW.wed) {
      const mon = new Date(cursor);
      mon.setUTCDate(mon.getUTCDate() + 5);
      if (mon <= rangeEnd || mon.getUTCMonth() + 1 <= endMonth + 1) {
        windows.push({
          label: "wed-mon",
          outbound_date: toIso(cursor),
          return_date: toIso(mon),
        });
      }
    } else if (dow === DOW.thu) {
      const sun = new Date(cursor);
      sun.setUTCDate(sun.getUTCDate() + 3);
      windows.push({
        label: "thu-sun",
        outbound_date: toIso(cursor),
        return_date: toIso(sun),
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const seen = new Set();
  return windows.filter((win) => {
    const key = `${win.outbound_date}_${win.return_date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    // Keep outbound inside Jul–Dec of the search year.
    const [y, m] = win.outbound_date.split("-").map(Number);
    if (y !== year) return false;
    if (m < startMonth || m > endMonth) return false;
    return true;
  });
}

/** Departure must be in the configured Jul–Dec search season. */
export function matchesSearchSeason(departureDate) {
  const startMonth = Number(process.env.FLIGHT_DEALS_START_MONTH ?? "7");
  const endMonth = Number(process.env.FLIGHT_DEALS_END_MONTH ?? "12");
  const [y, m] = String(departureDate).split("-").map(Number);
  if (!y || !m) return false;
  const now = new Date();
  let year = now.getUTCFullYear();
  if (now.getUTCMonth() + 1 > endMonth) year += 1;
  return y === year && m >= startMonth && m <= endMonth;
}

function filterPreferredDeals(deals) {
  return deals.filter(
    (deal) =>
      matchesPreferredTripDays(deal.departureDate, deal.returnDate) &&
      matchesSearchSeason(deal.departureDate),
  );
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
  const win = preferredDateWindows({ minLeadDays: 7 })[0];
  if (!win) return [];
  return [
    {
      id: buildDealId(ORIGIN, "ATH", win.outbound_date, win.return_date, 49.9),
      origin: ORIGIN,
      destination: "ATH",
      destinationNameHe: "אתונה",
      countryNameHe: "יוון",
      departureDate: win.outbound_date,
      returnDate: win.return_date,
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
      destinationNameHe: null,
      countryNameHe: null,
      departureDate,
      returnDate,
      priceUsd,
      bookingUrl: `https://www.aviasales.com/search/${ORIGIN}${departureDate}${destination}${returnDate}1`,
      imageUrl: null,
    });
  }
  return deals.sort((a, b) => a.priceUsd - b.priceUsd);
}

function parseExploreDestinations(payload) {
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
      destinationNameHe: String(row.name ?? "").trim() || null,
      countryNameHe: String(row.country ?? "").trim() || null,
      departureDate,
      returnDate,
      priceUsd,
      bookingUrl: row.link ?? null,
      imageUrl: row.thumbnail ?? null,
    });
  }
  return deals;
}

async function fetchExplore(extra = {}) {
  const params = new URLSearchParams({
    engine: "google_travel_explore",
    departure_id: ORIGIN,
    type: "1",
    currency: "USD",
    gl: "il",
    hl: "he",
    api_key: process.env.SERPAPI_API_KEY,
    ...Object.fromEntries(
      Object.entries(extra).filter(([, v]) => v !== undefined && v !== null && v !== ""),
    ),
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`);
  const payload = await res.json();
  if (payload.error) throw new Error(payload.error);
  return parseExploreDestinations(payload);
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
          id: buildDealId(
            deal.origin,
            deal.destination,
            deal.departureDate,
            deal.returnDate,
            Math.min(deal.priceUsd, existing?.priceUsd ?? deal.priceUsd),
          ),
          priceUsd: Math.min(deal.priceUsd, existing?.priceUsd ?? deal.priceUsd),
          imageUrl: deal.imageUrl || existing?.imageUrl || null,
          bookingUrl: deal.bookingUrl || existing?.bookingUrl || null,
          destinationNameHe: deal.destinationNameHe || existing?.destinationNameHe || null,
          countryNameHe: deal.countryNameHe || existing?.countryNameHe || null,
        });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.priceUsd - b.priceUsd);
}

/**
 * Search fixed רביעי→שני / חמישי→ראשון date windows via Google Explore.
 * Rotates 2 windows per cache miss to stay within SerpAPI free quota.
 */
async function searchSerpApi({ forceRefresh = false } = {}) {
  const cacheMs = Number(process.env.SERPAPI_CACHE_MS ?? String(6 * 60 * 60_000));
  if (
    !forceRefresh &&
    serpCache.deals &&
    Date.now() - serpCache.at < cacheMs
  ) {
    return filterPreferredDeals(serpCache.deals);
  }

  async function fetchNextPair() {
    const windows = preferredDateWindows();
    if (!windows.length) return { lists: [], meta: null };
    const w1 = windows[weekendRotate % windows.length];
    const w2 = windows[(weekendRotate + 1) % windows.length];
    weekendRotate = (weekendRotate + 2) % Math.max(windows.length, 1);

    const results = await Promise.allSettled([
      fetchExplore({
        outbound_date: w1.outbound_date,
        return_date: w1.return_date,
        arrival_area_id: EUROPE_AREA_ID,
      }),
      fetchExplore({
        outbound_date: w2.outbound_date,
        return_date: w2.return_date,
      }),
    ]);
    const pairLists = [];
    for (const r of results) {
      if (r.status === "fulfilled") pairLists.push(r.value);
      else console.warn("[serpapi]", r.reason);
    }
    console.log(
      `[serpapi] ${w1.label} ${w1.outbound_date}→${w1.return_date}` +
        ` + ${w2.label} ${w2.outbound_date}→${w2.return_date}`,
    );
    return { lists: pairLists, meta: w1 };
  }

  function jumpToMonth(month /* 1-12 */) {
    const windows = preferredDateWindows();
    const year = windows[0]?.outbound_date?.slice(0, 4);
    if (!year) return;
    const target = `${year}-${String(month).padStart(2, "0")}-01`;
    const idx = windows.findIndex((w) => w.outbound_date >= target);
    if (idx >= 0) {
      weekendRotate = idx;
      console.log(`[serpapi] jump to month ${month} @ ${windows[idx].outbound_date}`);
    }
  }

  const first = await fetchNextPair();
  const lists = [...first.lists];
  let deals = filterPreferredDeals(mergeDeals(lists));

  // On refresh / empty early season: jump to October and sample several windows.
  const month = first.meta?.outbound_date
    ? Number(first.meta.outbound_date.slice(5, 7))
    : 7;
  const shouldSweep = forceRefresh || deals.length === 0;
  if (shouldSweep && month <= 9) jumpToMonth(10);

  const extraPairs = forceRefresh ? 5 : deals.length === 0 ? 3 : 0;
  for (let i = 0; i < extraPairs; i += 1) {
    const next = await fetchNextPair();
    lists.push(...next.lists);
  }

  if (serpCache.deals?.length) lists.push(serpCache.deals);

  deals = filterPreferredDeals(mergeDeals(lists));
  serpCache = { at: Date.now(), deals };
  console.log(`[serpapi] total preferred ≤$${maxPrice()}: ${deals.length}`);
  return deals;
}

export function getCachedDealCount() {
  return serpCache.deals?.length ?? 0;
}

export function getSearchStatus() {
  const windows = preferredDateWindows();
  const next = windows[weekendRotate % Math.max(windows.length, 1)];
  const th = thailandWatchConfig();
  return {
    cachedDeals: serpCache.deals?.length ?? 0,
    cacheAgeMin: serpCache.at
      ? Math.round((Date.now() - serpCache.at) / 60_000)
      : null,
    nextWindow: next
      ? `${next.label} ${next.outbound_date}→${next.return_date}`
      : null,
    skyCooldown: Date.now() < skyCooldownUntil,
    thailand: {
      outbound: th.outbound,
      returnDate: th.returnDate,
      airports: th.airports,
      maxPrice: th.maxPrice,
      cached: thailandCache.deals?.length ?? 0,
      lowest: thailandCache.deals?.[0]?.priceUsd ?? null,
    },
  };
}

const THAILAND_META = {
  BKK: { nameHe: "בנגקוק", countryHe: "תאילנד" },
  DMK: { nameHe: "בנגקוק (דון מויאנג)", countryHe: "תאילנד" },
  HKT: { nameHe: "פוקט", countryHe: "תאילנד" },
  CNX: { nameHe: "צ׳יאנג מאי", countryHe: "תאילנד" },
};

async function searchThailandWatch({ forceRefresh = false } = {}) {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return [];

  const cacheMs = Number(process.env.SERPAPI_CACHE_MS ?? String(6 * 60 * 60_000));
  if (
    !forceRefresh &&
    thailandCache.deals &&
    Date.now() - thailandCache.at < cacheMs
  ) {
    return thailandCache.deals;
  }

  const cfg = thailandWatchConfig();
  const deals = [];

  for (const airport of cfg.airports) {
    try {
      const params = new URLSearchParams({
        engine: "google_flights",
        departure_id: ORIGIN,
        arrival_id: airport,
        outbound_date: cfg.outbound,
        return_date: cfg.returnDate,
        type: "1",
        currency: "USD",
        hl: "he",
        gl: "il",
        api_key: apiKey,
      });
      const res = await fetch(`https://serpapi.com/search.json?${params}`);
      if (!res.ok) {
        console.warn("[thailand] HTTP", res.status, airport);
        continue;
      }
      const payload = await res.json();
      if (payload.error) {
        console.warn("[thailand]", airport, payload.error);
        continue;
      }

      const flights = [
        ...(payload.best_flights ?? []),
        ...(payload.other_flights ?? []),
      ];
      let lowest = null;
      for (const item of flights) {
        const priceUsd = Number(item.price);
        if (!Number.isFinite(priceUsd)) continue;
        if (lowest === null || priceUsd < lowest.priceUsd) {
          lowest = { priceUsd, item };
        }
      }
      const insightLow = Number(payload.price_insights?.lowest_price);
      if (Number.isFinite(insightLow) && (lowest === null || insightLow < lowest.priceUsd)) {
        lowest = { priceUsd: insightLow, item: lowest?.item ?? null };
      }
      if (!lowest || lowest.priceUsd > cfg.maxPrice) continue;

      const meta = THAILAND_META[airport] ?? {
        nameHe: "תאילנד",
        countryHe: "תאילנד",
      };
      const bookingUrl =
        payload.search_metadata?.google_flights_url ||
        `https://www.google.com/travel/flights?hl=he&gl=il&curr=USD#flt=${ORIGIN}.${airport}.${cfg.outbound}*${airport}.${ORIGIN}.${cfg.returnDate}`;

      deals.push({
        id: buildDealId(ORIGIN, airport, cfg.outbound, cfg.returnDate, lowest.priceUsd),
        origin: ORIGIN,
        destination: airport,
        destinationNameHe: meta.nameHe,
        countryNameHe: meta.countryHe,
        departureDate: cfg.outbound,
        returnDate: cfg.returnDate,
        priceUsd: lowest.priceUsd,
        bookingUrl,
        imageUrl: null,
        watch: "thailand",
      });
    } catch (error) {
      console.warn("[thailand]", airport, error);
    }
  }

  const merged = mergeDeals([deals]).sort((a, b) => a.priceUsd - b.priceUsd);
  thailandCache = { at: Date.now(), deals: merged };
  console.log(
    `[thailand] ${cfg.outbound}→${cfg.returnDate} airports=${cfg.airports.join(",")}` +
      ` → ${merged.length} deals ≤$${cfg.maxPrice}` +
      (merged[0] ? ` (lowest $${merged[0].priceUsd})` : ""),
  );
  return merged;
}

async function resolvePlace(query) {
  if (placeCache.has(query)) return placeCache.get(query);
  const res = await fetch(
    `https://${HOST}/api/v1/flights/searchAirport?query=${encodeURIComponent(query)}&locale=en-US`,
    { headers: headers() },
  );
  if (res.status === 429) {
    skyCooldownUntil = Date.now() + 6 * 60 * 60_000;
    throw new Error("Skyscanner rate limited (429) — cooling down 6h");
  }
  if (!res.ok) throw new Error(`Skyscanner airport HTTP ${res.status}`);
  const payload = await res.json();
  const params = payload.data?.[0]?.navigation?.relevantFlightParams;
  if (!params?.skyId || !params?.entityId) return null;
  const place = { skyId: params.skyId, entityId: params.entityId };
  placeCache.set(query, place);
  return place;
}

async function searchSkyscanner() {
  if (Date.now() < skyCooldownUntil) {
    console.warn("[skyscanner] skipped — still in rate-limit cooldown");
    return [];
  }

  const origin = await resolvePlace("Tel Aviv");
  if (!origin) throw new Error("Skyscanner TLV resolve failed");

  const batchSize = Number(process.env.SKYSCANNER_DEST_BATCH ?? "3");
  const batch = [];
  for (let i = 0; i < Math.min(batchSize, DEST_QUERIES.length); i += 1) {
    batch.push(DEST_QUERIES[(rotateIndex + i) % DEST_QUERIES.length]);
  }
  rotateIndex = (rotateIndex + batchSize) % DEST_QUERIES.length;

  const windows = preferredDateWindows({ minLeadDays: 7 });
  const win = windows[weekendRotate % Math.max(windows.length, 1)] ?? windows[0];
  const departureDate = win?.outbound_date;
  const returnDate = win?.return_date;
  if (!departureDate || !returnDate) return [];
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
      if (res.status === 429) {
        skyCooldownUntil = Date.now() + 6 * 60 * 60_000;
        console.warn("[skyscanner] 429 — cooling down 6h");
        break;
      }
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
          destinationNameHe: null,
          countryNameHe: null,
          departureDate: outDate,
          returnDate: inDate,
          priceUsd,
          bookingUrl: `https://www.skyscanner.co.il/transport/flights/${ORIGIN.toLowerCase()}/${destCode.toLowerCase()}/${out}/${inn}/`,
          imageUrl: null,
        });
      }
    } catch (error) {
      console.warn("[skyscanner]", query, error);
      if (String(error?.message ?? "").includes("429")) break;
    }
  }

  return filterPreferredDeals(deals).sort((a, b) => a.priceUsd - b.priceUsd);
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
      destinationNameHe: null,
      countryNameHe: null,
      departureDate: row.departureDate,
      returnDate: row.returnDate,
      priceUsd,
      bookingUrl: row.links?.flightOffers ?? null,
      imageUrl: null,
    });
  }
  return filterPreferredDeals(deals).sort((a, b) => a.priceUsd - b.priceUsd);
}

export async function searchDeals({ forceRefresh = false } = {}) {
  const provider = resolveProvider();
  if (!provider) {
    throw new Error(
      "הגדר SERPAPI_API_KEY ו/או SKYSCANNER_RAPIDAPI_KEY, או FLIGHT_DEALS_DEMO=true",
    );
  }

  let deals;
  if (provider === "demo") deals = demoDeals();
  else if (provider === "travelpayouts") deals = await searchTravelpayouts();
  else if (provider === "merged") {
    const results = await Promise.allSettled([
      searchSerpApi({ forceRefresh }),
      searchSkyscanner(),
    ]);
    const lists = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    for (const r of results) {
      if (r.status === "rejected") console.warn("[providers]", r.reason);
    }
    deals = mergeDeals(lists);
  } else if (provider === "serpapi") deals = await searchSerpApi({ forceRefresh });
  else if (provider === "skyscanner") deals = await searchSkyscanner();
  else deals = await searchAmadeus();

  const preferred = filterPreferredDeals(deals);
  const thailandResult = await Promise.allSettled([
    searchThailandWatch({ forceRefresh }),
  ]);
  const thailand =
    thailandResult[0].status === "fulfilled" ? thailandResult[0].value : [];
  if (thailandResult[0].status === "rejected") {
    console.warn("[thailand]", thailandResult[0].reason);
  }

  return mergeDeals([preferred, thailand]);
}
