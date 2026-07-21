import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAST_DEALS_FILE = path.join(__dirname, "last-deals.json");

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
let budapestCache = { at: 0, deals: null };
/** Last confirmed Emirates + free-bag Thailand deal (exact watch). */
let emiratesDealCache = { at: 0, deal: null };
let serpCooldownUntil = 0;

async function loadPersistedDeals() {
  if (!existsSync(LAST_DEALS_FILE)) return;
  try {
    const raw = JSON.parse(await readFile(LAST_DEALS_FILE, "utf8"));
    if (Array.isArray(raw?.thailand) && raw.thailand.length) {
      thailandCache = { at: Number(raw.thailandAt ?? Date.now()), deals: raw.thailand };
    }
    if (Array.isArray(raw?.budapest) && raw.budapest.length) {
      budapestCache = { at: Number(raw.budapestAt ?? Date.now()), deals: raw.budapest };
    }
    if (raw?.emirates && typeof raw.emirates === "object") {
      emiratesDealCache = {
        at: Number(raw.emiratesAt ?? Date.now()),
        deal: raw.emirates,
      };
    }
  } catch {
    // ignore
  }
}

async function persistDeals() {
  try {
    await writeFile(
      LAST_DEALS_FILE,
      JSON.stringify(
        {
          thailand: thailandCache.deals ?? [],
          thailandAt: thailandCache.at || Date.now(),
          budapest: budapestCache.deals ?? [],
          budapestAt: budapestCache.at || Date.now(),
          emirates: emiratesDealCache.deal ?? null,
          emiratesAt: emiratesDealCache.at || null,
        },
        null,
        2,
      ) + "\n",
    );
  } catch {
    // ignore
  }
}

// Warm caches from disk ASAP (top-level await not available in all contexts — lazy).
let persistedLoaded = false;
async function ensurePersistedLoaded() {
  if (persistedLoaded) return;
  persistedLoaded = true;
  await loadPersistedDeals();
}

/** Permanent Thailand watch — DD/MM/YYYY 10/02/2027–10/03/2027 */
export function thailandWatchConfig() {
  const ilsToUsd = Number(process.env.FLIGHT_DEALS_ILS_TO_USD ?? "3.7");
  const maxPriceIls = Number(
    process.env.FLIGHT_DEALS_THAILAND_MAX_PRICE_ILS ??
      String(
        Math.round(
          Number(process.env.FLIGHT_DEALS_THAILAND_MAX_PRICE_USD ?? "1200") * ilsToUsd,
        ),
      ),
  );
  return {
    outbound: process.env.FLIGHT_DEALS_THAILAND_OUTBOUND ?? "2027-02-10",
    returnDate: process.env.FLIGHT_DEALS_THAILAND_RETURN ?? "2027-03-10",
    airports: String(process.env.FLIGHT_DEALS_THAILAND_AIRPORTS ?? "BKK")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
    /** Search/compare in ILS — matches what Israelis see on Google Flights. */
    currency: "ILS",
    maxPriceIls,
    ilsToUsd,
    /** Emirates preferred for the fixed schedule (FZ+EK). */
    airlines: String(process.env.FLIGHT_DEALS_THAILAND_AIRLINES ?? "EK")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
    /** Outbound TLV 15:10 → BKK 07:35 */
    outboundDep: process.env.FLIGHT_DEALS_THAILAND_OUT_DEP ?? "15:10",
    outboundArr: process.env.FLIGHT_DEALS_THAILAND_OUT_ARR ?? "07:35",
    /** Return must leave Bangkok at night (20:00–05:59). */
    returnNightOnly: process.env.FLIGHT_DEALS_THAILAND_RETURN_NIGHT !== "false",
  };
}

/** Permanent Budapest watch — 11/11/2026–15/11/2026 */
export function budapestWatchConfig() {
  const ilsToUsd = Number(process.env.FLIGHT_DEALS_ILS_TO_USD ?? "3.7");
  const maxPriceIls = Number(
    process.env.FLIGHT_DEALS_BUDAPEST_MAX_PRICE_ILS ?? "2000",
  );
  return {
    outbound: process.env.FLIGHT_DEALS_BUDAPEST_OUTBOUND ?? "2026-11-11",
    returnDate: process.env.FLIGHT_DEALS_BUDAPEST_RETURN ?? "2026-11-15",
    airports: String(process.env.FLIGHT_DEALS_BUDAPEST_AIRPORTS ?? "BUD")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
    currency: "ILS",
    maxPriceIls,
    ilsToUsd,
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
  const forced = String(process.env.FLIGHT_DEALS_PROVIDER ?? "")
    .trim()
    .toLowerCase();
  if (forced === "travelpayouts" || forced === "aviasales") {
    return process.env.TRAVELPAYOUTS_TOKEN ? "travelpayouts" : null;
  }
  if (forced === "serpapi") {
    return process.env.SERPAPI_API_KEY ? "serpapi" : null;
  }
  // Prefer cheap Travelpayouts when available; SerpAPI is optional deep source.
  if (process.env.TRAVELPAYOUTS_TOKEN) return "travelpayouts";
  if (process.env.SERPAPI_API_KEY) return "serpapi";
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
      const dealRank = Number(deal.priceIls ?? deal.priceUsd);
      const existingRank = existing
        ? Number(existing.priceIls ?? existing.priceUsd)
        : null;
      if (!existing || dealRank < existingRank) {
        const priceIls = deal.priceIls ?? existing?.priceIls ?? null;
        const priceUsd = Number(
          deal.priceUsd ??
            (priceIls != null ? priceIls / 3.7 : existing?.priceUsd),
        );
        byKey.set(key, {
          ...existing,
          ...deal,
          priceIls,
          priceUsd,
          id: buildDealId(
            deal.origin,
            deal.destination,
            deal.departureDate,
            deal.returnDate,
            priceIls ?? priceUsd,
          ),
          imageUrl: deal.imageUrl || existing?.imageUrl || null,
          bookingUrl: deal.bookingUrl || existing?.bookingUrl || null,
          destinationNameHe: deal.destinationNameHe || existing?.destinationNameHe || null,
          countryNameHe: deal.countryNameHe || existing?.countryNameHe || null,
          airlineLabelHe: deal.airlineLabelHe || existing?.airlineLabelHe || null,
          baggageLabelHe: deal.baggageLabelHe || existing?.baggageLabelHe || null,
        });
      }
    }
  }
  return [...byKey.values()].sort(
    (a, b) => Number(a.priceIls ?? a.priceUsd) - Number(b.priceIls ?? b.priceUsd),
  );
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

function watchStatusSnapshot(cfg, cache) {
  const top = cache.deals?.[0] ?? null;
  return {
    outbound: cfg.outbound,
    returnDate: cfg.returnDate,
    airports: cfg.airports,
    maxPriceIls: cfg.maxPriceIls,
    cached: cache.deals?.length ?? 0,
    lowestIls: top?.priceIls ?? null,
    lowest: top?.priceIls ?? null,
    scheduleLabelHe: top?.scheduleLabelHe ?? null,
    baggageLabelHe: top?.baggageLabelHe ?? null,
    airlineLabelHe: top?.airlineLabelHe ?? null,
    bookingUrl: top?.bookingUrl ?? null,
    deal: top,
  };
}

export function getSearchStatus() {
  const windows = preferredDateWindows();
  const next = windows[weekendRotate % Math.max(windows.length, 1)];
  return {
    cachedDeals: serpCache.deals?.length ?? 0,
    cacheAgeMin: serpCache.at
      ? Math.round((Date.now() - serpCache.at) / 60_000)
      : null,
    nextWindow: next
      ? `${next.label} ${next.outbound_date}→${next.return_date}`
      : null,
    skyCooldown: Date.now() < skyCooldownUntil,
    thailand: watchStatusSnapshot(thailandWatchConfig(), thailandCache),
    budapest: watchStatusSnapshot(budapestWatchConfig(), budapestCache),
  };
}

/** Best cached deal per permanent watch (for status replies). */
export function getCachedWatchDeals() {
  const status = getSearchStatus();
  return [status.thailand?.deal, status.budapest?.deal].filter(Boolean);
}

const THAILAND_META = {
  BKK: { nameHe: "בנגקוק", countryHe: "תאילנד" },
  DMK: { nameHe: "בנגקוק (דון מויאנג)", countryHe: "תאילנד" },
  HKT: { nameHe: "פוקט", countryHe: "תאילנד" },
  CNX: { nameHe: "צ׳יאנג מאי", countryHe: "תאילנד" },
};

const AIRLINE_LABELS_HE = {
  EK: "אמירטס",
  EY: "איתיחאד",
  LY: "אל על",
  W6: "וויז אייר",
  W9: "וויז אייר",
  FR: "ריאנאייר",
  U2: "איזיג׳ט",
  A3: "אייג׳יאן",
  RO: "טארום",
  LO: "לוט",
  OS: "אוסטריאן",
  LH: "לופטהנזה",
  Emirates: "אמירטס",
  Etihad: "איתיחאד",
  "El Al": "אל על",
  Wizz: "וויז אייר",
  Ryanair: "ריאנאייר",
};

function itineraryAirlineCodes(item) {
  const codes = [];
  for (const leg of item?.flights ?? []) {
    const fromNumber = String(leg.flight_number ?? "")
      .trim()
      .split(/\s+/)[0]
      ?.toUpperCase();
    if (fromNumber && /^[A-Z0-9]{2}$/.test(fromNumber)) codes.push(fromNumber);
    const name = String(leg.airline ?? "").trim();
    if (/^emirates$/i.test(name)) codes.push("EK");
    if (/^etihad$/i.test(name)) codes.push("EY");
    if (/^flydubai$/i.test(name)) codes.push("FZ");
  }
  return codes;
}

/** All segments EK/EY, or Emirates↔flydubai codeshare marketed as Emirates. */
function isAllowedThailandAirline(item, allowedCodes) {
  const allowed = new Set(allowedCodes.map((c) => c.toUpperCase()));
  const codes = itineraryAirlineCodes(item);
  if (!codes.length) return false;
  if (codes.every((c) => allowed.has(c))) return true;

  const ticketBits = []
    .concat(item?.ticket_also_sold_by ?? [], item?.ticket ?? [])
    .map((v) => String(v));
  const soldAsEmirates = ticketBits.some((t) => /emirates/i.test(t)) || codes.includes("EK");
  const soldAsEtihad = ticketBits.some((t) => /etihad/i.test(t)) || codes.includes("EY");

  if (
    allowed.has("EK") &&
    soldAsEmirates &&
    codes.every((c) => c === "EK" || c === "FZ")
  ) {
    return true;
  }
  if (allowed.has("EY") && soldAsEtihad && codes.every((c) => c === "EY")) {
    return true;
  }
  return false;
}

function thailandAirlineLabel(item) {
  const codes = [...new Set(itineraryAirlineCodes(item))];
  if (codes.includes("EY") && !codes.includes("EK") && !codes.includes("FZ")) {
    return "איתיחאד";
  }
  if (codes.includes("EK") || codes.includes("FZ")) return "אמירטס";
  if (codes.includes("EY")) return "איתיחאד";
  return "אמירטס/איתיחאד";
}

function flightTimeHHMM(value) {
  const match = String(value ?? "").match(/(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

function itineraryEndpoints(item) {
  const legs = item?.flights ?? [];
  if (!legs.length) return { dep: null, arr: null };
  return {
    dep: flightTimeHHMM(legs[0]?.departure_airport?.time),
    arr: flightTimeHHMM(legs[legs.length - 1]?.arrival_airport?.time),
  };
}

/** Night departure from destination: 20:00–05:59 local. */
function isNightDeparture(item) {
  const { dep } = itineraryEndpoints(item);
  if (!dep) return false;
  const hour = Number(dep.slice(0, 2));
  return hour >= 20 || hour <= 5;
}

function matchesOutboundSchedule(item, cfg) {
  const { dep, arr } = itineraryEndpoints(item);
  if (!dep || !arr) return false;
  if (cfg.outboundDep && dep !== cfg.outboundDep) return false;
  if (cfg.outboundArr && arr !== cfg.outboundArr) return false;
  return true;
}

function scheduleLabelHe(outboundItem, returnItem) {
  const out = itineraryEndpoints(outboundItem);
  const ret = itineraryEndpoints(returnItem);
  const parts = [];
  if (out.dep && out.arr) parts.push(`יציאה ${out.dep}→${out.arr}`);
  if (ret.dep && ret.arr) parts.push(`חזרה ${ret.dep}→${ret.arr}`);
  return parts.join(" · ");
}

function baggageTextList(...sources) {
  const out = [];
  for (const source of sources) {
    if (!source) continue;
    if (Array.isArray(source)) {
      for (const row of source) out.push(...baggageTextList(row));
      continue;
    }
    if (typeof source === "string") {
      out.push(source);
      continue;
    }
    if (typeof source === "object") {
      for (const value of Object.values(source)) out.push(...baggageTextList(value));
    }
  }
  return out;
}

/** True when fare text includes free checked luggage (not "for a fee" / "No checked"). */
export function hasFreeCheckedBag(baggagePrices) {
  const texts = baggageTextList(baggagePrices).map((t) => String(t).toLowerCase());
  if (!texts.length) return false;
  const joined = texts.join(" | ");
  if (
    /\d+\s*free checked bag/.test(joined) ||
    /\d+\s*free checked bags/.test(joined) ||
    /free checked bag/.test(joined)
  ) {
    return true;
  }
  // Hebrew variants
  if (/מזווד/.test(joined) && /(כלול|חינם)/.test(joined) && /צ.?ק|כבודה|מזוודה/.test(joined)) {
    return true;
  }
  if (/no checked bags/.test(joined)) return false;
  if (/checked baggage for a fee/.test(joined)) return false;
  return false;
}

async function fetchGoogleFlights(params) {
  if (Date.now() < serpCooldownUntil) {
    throw new Error(
      `SerpAPI cooling down ${Math.ceil((serpCooldownUntil - Date.now()) / 1000)}s after rate-limit`,
    );
  }
  const timeoutMs = Number(process.env.SERPAPI_TIMEOUT_MS ?? "45000");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://serpapi.com/search.json?${new URLSearchParams(params)}`,
      { signal: controller.signal },
    );
    if (res.status === 429) {
      serpCooldownUntil = Date.now() + 30 * 60_000;
      throw new Error("SerpAPI HTTP 429 — rate limited, cooling 30m");
    }
    if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`);
    const payload = await res.json();
    if (payload.error) {
      if (/rate|limit|quota/i.test(String(payload.error))) {
        serpCooldownUntil = Date.now() + 30 * 60_000;
      }
      throw new Error(payload.error);
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`SerpAPI timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Deep-check a candidate: outbound → return → booking options.
 * Returns lowest airline/official fare that includes free checked bag(s).
 * Prices are in ILS (Israeli Google Flights market).
 */
async function findBagIncludedFare({
  apiKey,
  airport,
  outbound,
  returnDate,
  outboundItem,
  allowedAirlines,
  maxPriceIls,
  currency = "ILS",
  returnNightOnly = true,
}) {
  if (!outboundItem?.departure_token) return null;

  const common = {
    engine: "google_flights",
    departure_id: ORIGIN,
    arrival_id: airport,
    outbound_date: outbound,
    return_date: returnDate,
    type: "1",
    currency,
    // English keeps baggage strings stable ("2 free checked bags").
    hl: "en",
    gl: "il",
    api_key: apiKey,
  };

  const returnsPayload = await fetchGoogleFlights({
    ...common,
    departure_token: outboundItem.departure_token,
  });
  const returns = [
    ...(returnsPayload.best_flights ?? []),
    ...(returnsPayload.other_flights ?? []),
  ]
    .filter((item) => item?.booking_token)
    .filter((item) => (returnNightOnly ? isNightDeparture(item) : true))
    .filter((item) => isAllowedThailandAirline(item, allowedAirlines))
    .sort((a, b) => Number(a.price ?? 9e9) - Number(b.price ?? 9e9));

  let bestOverall = null;

  for (const ret of returns.slice(0, 5)) {
    const booking = await fetchGoogleFlights({
      ...common,
      booking_token: ret.booking_token,
    });

    for (const option of booking.booking_options ?? []) {
      const together = option.together ?? option;
      const baggage = together.baggage_prices ?? booking.baggage_prices;
      if (!hasFreeCheckedBag(baggage)) continue;

      const priceIls = Number(together.price ?? ret.price ?? outboundItem.price);
      if (!Number.isFinite(priceIls) || priceIls > maxPriceIls) continue;

      const airlinePreferred = Boolean(together.airline);
      if (
        !bestOverall ||
        (airlinePreferred && !bestOverall.airlinePreferred) ||
        (airlinePreferred === bestOverall.airlinePreferred &&
          priceIls < bestOverall.priceIls)
      ) {
        bestOverall = {
          priceIls,
          airlinePreferred,
          baggage,
          outboundItem,
          returnItem: ret,
          bookWith: together.book_with ?? null,
          scheduleLabelHe: scheduleLabelHe(outboundItem, ret),
        };
      }
    }

    if (bestOverall?.airlinePreferred) break;
  }

  if (!bestOverall) return null;

  const bagTexts = baggageTextList(bestOverall.baggage);
  const bagLabel =
    bagTexts.find((t) => /checked bag/i.test(t)) ||
    bagTexts.find((t) => /מזווד/i.test(t)) ||
    "מזוודה כלולה";
  return {
    ...bestOverall,
    baggageLabelHe: /checked bags?/i.test(bagLabel)
      ? bagLabel.replace(/(\d+)\s*free checked bags?/i, "$1 מזוודות כלולות")
      : "מזוודה כלולה",
    baggageLabel: bagLabel,
  };
}

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
  const maxCandidates = Number(
    process.env.FLIGHT_DEALS_THAILAND_BAG_CANDIDATES ?? "6",
  );
  const deals = [];

  for (const airport of cfg.airports) {
    try {
      // Search each airline separately so bag-included Emirates isn't
      // crowded out by cheaper bagless Etihad Light fares.
      const airlineLists = [];
      for (const airline of cfg.airlines) {
        try {
          const payload = await fetchGoogleFlights({
            engine: "google_flights",
            departure_id: ORIGIN,
            arrival_id: airport,
            outbound_date: cfg.outbound,
            return_date: cfg.returnDate,
            type: "1",
            currency: cfg.currency,
            hl: "en",
            gl: "il",
            include_airlines: airline,
            api_key: apiKey,
          });
          airlineLists.push({
            airline,
            payload,
            flights: [
              ...(payload.best_flights ?? []),
              ...(payload.other_flights ?? []),
            ],
          });
        } catch (error) {
          console.warn("[thailand] airline search failed", airport, airline, error);
        }
      }

      const candidates = [];
      const seenTokens = new Set();
      for (const { flights } of airlineLists) {
        for (const item of flights) {
          if (!isAllowedThailandAirline(item, cfg.airlines)) continue;
          if (!matchesOutboundSchedule(item, cfg)) continue;
          const priceIls = Number(item.price);
          if (!Number.isFinite(priceIls) || priceIls > cfg.maxPriceIls) continue;
          const token = item.departure_token || `${item.price}-${itineraryAirlineCodes(item).join("-")}`;
          if (seenTokens.has(token)) continue;
          seenTokens.add(token);
          candidates.push(item);
        }
      }

      candidates.sort((a, b) => Number(a.price) - Number(b.price));
      const toCheck = candidates.slice(0, maxCandidates);
      console.log(
        `[thailand] ${airport}: ${candidates.length} schedule-match candidates (out ${cfg.outboundDep}→${cfg.outboundArr}${cfg.returnNightOnly ? ", night return" : ""}), deep-checking ${toCheck.length}`,
      );

      let lowest = null;
      for (const candidate of toCheck) {
        try {
          const bagFare = await findBagIncludedFare({
            apiKey,
            airport,
            outbound: cfg.outbound,
            returnDate: cfg.returnDate,
            outboundItem: candidate,
            allowedAirlines: cfg.airlines,
            maxPriceIls: cfg.maxPriceIls,
            currency: cfg.currency,
            returnNightOnly: cfg.returnNightOnly,
          });
          if (!bagFare) continue;
          if (!lowest || bagFare.priceIls < lowest.priceIls) {
            lowest = bagFare;
          }
          // Official airline bag fare — stop early.
          if (lowest.airlinePreferred) break;
        } catch (error) {
          console.warn("[thailand] bag-check failed", airport, error);
        }
      }

      if (!lowest) {
        console.log(
          `[thailand] ${airport}: no Emirates fare with free checked bag on ${cfg.outboundDep}→${cfg.outboundArr} + night return`,
        );
        continue;
      }

      const meta = THAILAND_META[airport] ?? {
        nameHe: "תאילנד",
        countryHe: "תאילנד",
      };
      const bookingUrl =
        airlineLists[0]?.payload?.search_metadata?.google_flights_url ||
        `https://www.google.com/travel/flights?hl=he&gl=il&curr=ILS#flt=${ORIGIN}.${airport}.${cfg.outbound}*${airport}.${ORIGIN}.${cfg.returnDate}`;

      const priceIls = lowest.priceIls;
      const priceUsd = Number((priceIls / cfg.ilsToUsd).toFixed(2));

      deals.push({
        id: buildDealId(ORIGIN, airport, cfg.outbound, cfg.returnDate, priceIls),
        origin: ORIGIN,
        destination: airport,
        destinationNameHe: meta.nameHe,
        countryNameHe: meta.countryHe,
        departureDate: cfg.outbound,
        returnDate: cfg.returnDate,
        priceUsd,
        priceIls,
        currency: "ILS",
        bookingUrl,
        imageUrl: null,
        watch: "thailand",
        airlineLabelHe: thailandAirlineLabel(lowest.outboundItem),
        baggageIncluded: true,
        baggageLabelHe: lowest.baggageLabelHe,
        scheduleLabelHe: lowest.scheduleLabelHe,
        bookWith: lowest.bookWith,
      });
    } catch (error) {
      console.warn("[thailand]", airport, error);
    }
  }

  const merged = mergeDeals([deals]).sort(
    (a, b) => (a.priceIls ?? a.priceUsd) - (b.priceIls ?? b.priceUsd),
  );
  if (!merged.length && thailandCache.deals?.length) {
    // Keep previous good result only if it is a real Emirates+bag deal.
    const kept = thailandCache.deals.filter((d) => isEmiratesBagDeal(d));
    if (kept.length) {
      console.warn("[thailand] empty refresh — keeping previous Emirates+bag");
      return kept;
    }
    console.warn("[thailand] empty refresh — no Emirates+bag cache to keep");
    return [];
  }
  thailandCache = { at: Date.now(), deals: merged };
  if (merged[0]) await rememberEmiratesDeal(merged[0]);
  await persistDeals();
  console.log(
    `[thailand] Emirates + bag ${cfg.outbound}→${cfg.returnDate}` +
      ` airports=${cfg.airports.join(",")}` +
      ` → ${merged.length} deals ≤₪${cfg.maxPriceIls}` +
      (merged[0]
        ? ` (lowest ₪${merged[0].priceIls} ${merged[0].airlineLabelHe || ""} · ${merged[0].baggageLabelHe || "bag"})`
        : ""),
  );
  return merged;
}

function genericAirlineLabelHe(item) {
  const codes = [...new Set(itineraryAirlineCodes(item))];
  for (const code of codes) {
    if (AIRLINE_LABELS_HE[code]) return AIRLINE_LABELS_HE[code];
  }
  const name = String(item?.flights?.[0]?.airline ?? "").trim();
  if (!name) return null;
  for (const [key, label] of Object.entries(AIRLINE_LABELS_HE)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return label;
  }
  return name;
}

function outboundScheduleLabelHe(item) {
  const { dep, arr } = itineraryEndpoints(item);
  if (dep && arr) return `יציאה ${dep}→${arr}`;
  return null;
}

/** Permanent Budapest watch — TLV→BUD fixed Nov 11–15 (no airline/bag filter). */
async function searchBudapestWatch({ forceRefresh = false } = {}) {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return [];

  const cacheMs = Number(process.env.SERPAPI_CACHE_MS ?? String(6 * 60 * 60_000));
  if (
    !forceRefresh &&
    budapestCache.deals &&
    Date.now() - budapestCache.at < cacheMs
  ) {
    return budapestCache.deals;
  }

  const cfg = budapestWatchConfig();
  const deals = [];

  for (const airport of cfg.airports) {
    try {
      const payload = await fetchGoogleFlights({
        engine: "google_flights",
        departure_id: ORIGIN,
        arrival_id: airport,
        outbound_date: cfg.outbound,
        return_date: cfg.returnDate,
        type: "1",
        currency: cfg.currency,
        hl: "en",
        gl: "il",
        api_key: apiKey,
      });

      const flights = [
        ...(payload.best_flights ?? []),
        ...(payload.other_flights ?? []),
      ];

      let best = null;
      for (const item of flights) {
        const priceIls = Number(item.price);
        if (!Number.isFinite(priceIls) || priceIls <= 0) continue;
        if (priceIls > cfg.maxPriceIls) continue;
        if (!best || priceIls < best.priceIls) {
          best = { item, priceIls };
        }
      }

      if (!best) {
        console.log(
          `[budapest] ${airport}: no fares ≤₪${cfg.maxPriceIls} on ${cfg.outbound}→${cfg.returnDate}`,
        );
        continue;
      }

      const bookingUrl =
        payload?.search_metadata?.google_flights_url ||
        `https://www.google.com/travel/flights?hl=he&gl=il&curr=ILS#flt=${ORIGIN}.${airport}.${cfg.outbound}*${airport}.${ORIGIN}.${cfg.returnDate}`;
      const priceIls = best.priceIls;
      const priceUsd = Number((priceIls / cfg.ilsToUsd).toFixed(2));

      deals.push({
        id: buildDealId(ORIGIN, airport, cfg.outbound, cfg.returnDate, priceIls),
        origin: ORIGIN,
        destination: airport,
        destinationNameHe: "בודפשט",
        countryNameHe: "הונגריה",
        departureDate: cfg.outbound,
        returnDate: cfg.returnDate,
        priceUsd,
        priceIls,
        currency: "ILS",
        bookingUrl,
        imageUrl: null,
        watch: "budapest",
        airlineLabelHe: genericAirlineLabelHe(best.item),
        baggageIncluded: false,
        baggageLabelHe: null,
        scheduleLabelHe: outboundScheduleLabelHe(best.item),
        bookWith: null,
      });
    } catch (error) {
      console.warn("[budapest]", airport, error);
    }
  }

  const merged = mergeDeals([deals]).sort(
    (a, b) => (a.priceIls ?? a.priceUsd) - (b.priceIls ?? b.priceUsd),
  );
  if (!merged.length && budapestCache.deals?.length) {
    console.warn("[budapest] empty refresh — keeping previous good result");
    return budapestCache.deals;
  }
  budapestCache = { at: Date.now(), deals: merged };
  await persistDeals();
  console.log(
    `[budapest] ${cfg.outbound}→${cfg.returnDate}` +
      ` airports=${cfg.airports.join(",")}` +
      ` → ${merged.length} deals ≤₪${cfg.maxPriceIls}` +
      (merged[0]
        ? ` (lowest ₪${merged[0].priceIls} ${merged[0].airlineLabelHe || ""})`
        : ""),
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

/**
 * Cheap free provider — Travelpayouts / Aviasales Data API.
 * Great for fixed-date watches. Less precise than SerpAPI for bags/schedule.
 */
function toMonth(isoDate) {
  const s = String(isoDate ?? "");
  return s.length >= 7 ? s.slice(0, 7) : s;
}

function rowDate(iso) {
  const s = String(iso ?? "");
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function daysBetween(a, b) {
  const ta = Date.parse(`${a}T12:00:00Z`);
  const tb = Date.parse(`${b}T12:00:00Z`);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 999;
  return Math.abs(Math.round((ta - tb) / 86400000));
}

async function fetchTravelpayoutsPricesForDatesOnce({
  origin,
  destination,
  departureAt,
  returnAt,
  currency = "ils",
  limit = 30,
  market = "il",
}) {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) throw new Error("Missing TRAVELPAYOUTS_TOKEN");
  const params = new URLSearchParams({
    origin,
    destination,
    departure_at: departureAt,
    return_at: returnAt,
    one_way: "false",
    sorting: "price",
    direct: "false",
    currency,
    limit: String(limit),
    page: "1",
    unique: "false",
    market,
    token,
  });
  const res = await fetch(
    `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`,
    { headers: { "X-Access-Token": token, Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Travelpayouts HTTP ${res.status}`);
  const payload = await res.json();
  if (payload.success === false) {
    throw new Error(payload.error ?? "Travelpayouts failed");
  }
  return Array.isArray(payload.data) ? payload.data : [];
}

/**
 * Aviasales Data API is a recent-search cache: exact YYYY-MM-DD often returns
 * empty even when the month has fares. Try exact dates, then month fallback.
 */
async function fetchTravelpayoutsPricesForDates({
  origin,
  destination,
  departureAt,
  returnAt,
  currency = "ils",
  limit = 50,
}) {
  const exact = await fetchTravelpayoutsPricesForDatesOnce({
    origin,
    destination,
    departureAt,
    returnAt,
    currency,
    limit,
  });
  if (exact.length) return { rows: exact, mode: "exact" };

  const monthOut = toMonth(departureAt);
  const monthBack = toMonth(returnAt);
  const monthly = await fetchTravelpayoutsPricesForDatesOnce({
    origin,
    destination,
    departureAt: monthOut,
    returnAt: monthBack,
    currency,
    limit,
  });
  return { rows: monthly, mode: monthly.length ? "month" : "empty" };
}

function pickTravelpayoutsBest(rows, {
  targetOut,
  targetBack,
  maxPriceIls,
  preferredAirlines = [],
  maxDateDriftDays = 14,
}) {
  const preferred = new Set(
    preferredAirlines.map((a) => String(a).toUpperCase()).filter(Boolean),
  );
  const ranked = [...rows]
    .map((row) => {
      const priceIls = Number(row.price);
      const airline = String(row.airline ?? row.airline_code ?? "")
        .trim()
        .toUpperCase();
      const depDate = rowDate(row.departure_at ?? row.depart_date);
      const retDate = rowDate(row.return_at ?? row.return_date);
      const drift =
        daysBetween(depDate, targetOut) + daysBetween(retDate, targetBack);
      const exact =
        depDate === targetOut && retDate === targetBack ? 0 : 1;
      return { row, priceIls, airline, depDate, retDate, drift, exact };
    })
    .filter(
      (x) =>
        Number.isFinite(x.priceIls) &&
        x.priceIls > 0 &&
        x.priceIls <= maxPriceIls &&
        x.depDate &&
        x.retDate &&
        x.drift <= maxDateDriftDays,
    )
    .sort((a, b) => {
      if (a.exact !== b.exact) return a.exact - b.exact;
      if (a.drift !== b.drift) return a.drift - b.drift;
      const aPref = preferred.has(a.airline) ? 0 : 1;
      const bPref = preferred.has(b.airline) ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
      return a.priceIls - b.priceIls;
    });
  return ranked[0] ?? null;
}

function travelpayoutsAirlineLabel(code) {
  const c = String(code ?? "").toUpperCase();
  return (
    {
      EK: "אמירטס",
      FZ: "פליי דובאי",
      EY: "איתיחאד",
      LY: "אל על",
      W6: "וויז אייר",
      W9: "וויז אייר",
      FR: "ריאנאייר",
      U2: "איזיג׳ט",
      A3: "אייג׳יאן",
      BA: "בריטיש",
      LH: "לופטהנזה",
    }[c] || c || null
  );
}

function rowDepartureLocal(row) {
  const raw = String(row.departure_at ?? row.depart_date ?? "");
  const m = raw.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : null;
}

async function searchThailandViaTravelpayouts() {
  await ensurePersistedLoaded();
  const cfg = thailandWatchConfig();
  const airport = cfg.airports[0] || "BKK";
  try {
    const { rows, mode } = await fetchTravelpayoutsPricesForDates({
      origin: ORIGIN,
      destination: airport,
      departureAt: cfg.outbound,
      returnAt: cfg.returnDate,
      currency: "ils",
      limit: 50,
    });

    let best = pickTravelpayoutsBest(rows, {
      targetOut: cfg.outbound,
      targetBack: cfg.returnDate,
      maxPriceIls: cfg.maxPriceIls,
      preferredAirlines: cfg.airlines,
      maxDateDriftDays: 21,
    });
    if (!best) {
      best = pickTravelpayoutsBest(rows, {
        targetOut: cfg.outbound,
        targetBack: cfg.returnDate,
        maxPriceIls: cfg.maxPriceIls,
        preferredAirlines: cfg.airlines,
        maxDateDriftDays: 366,
      });
    }
    if (!best) {
      console.log(
        `[travelpayouts/thailand] no fares ≤₪${cfg.maxPriceIls} (${mode}, ${rows.length} cached)`,
      );
      return thailandCache.deals?.length ? thailandCache.deals : [];
    }

    const dep = rowDepartureLocal(best.row);
    const priceIls = best.priceIls;
    const priceUsd = Number((priceIls / cfg.ilsToUsd).toFixed(2));
    const outDate = best.depDate;
    const backDate = best.retDate;
    const linkDateOut = outDate.replace(/-/g, "").slice(2);
    const linkDateBack = backDate.replace(/-/g, "").slice(2);
    const dateNote =
      outDate === cfg.outbound && backDate === cfg.returnDate
        ? null
        : `תאריכי מטמון ${outDate}→${backDate} (יעד ${cfg.outbound}→${cfg.returnDate})`;
    const deal = {
      id: buildDealId(ORIGIN, airport, outDate, backDate, priceIls),
      origin: ORIGIN,
      destination: airport,
      destinationNameHe: "בנגקוק",
      countryNameHe: "תאילנד",
      departureDate: outDate,
      returnDate: backDate,
      priceUsd,
      priceIls,
      currency: "ILS",
      bookingUrl: `https://www.aviasales.com/search/${ORIGIN}${linkDateOut}${airport}${linkDateBack}1`,
      imageUrl: null,
      watch: "thailand",
      airlineLabelHe: travelpayoutsAirlineLabel(best.airline),
      baggageIncluded: false,
      baggageLabelHe: "מטמון Aviasales · בדקו מזוודה לפני הזמנה",
      scheduleLabelHe:
        [dep ? `יציאה ~${dep}` : null, dateNote].filter(Boolean).join(" · ") ||
        null,
      bookWith: "travelpayouts",
      provider: "travelpayouts",
    };

    thailandCache = { at: Date.now(), deals: [deal] };
    await persistDeals();
    console.log(
      `[travelpayouts/thailand] ${outDate}→${backDate} ₪${priceIls} ${deal.airlineLabelHe || best.airline} (${mode})`,
    );
    return [deal];
  } catch (error) {
    console.warn("[travelpayouts/thailand]", error);
    return thailandCache.deals?.length ? thailandCache.deals : [];
  }
}

function isTravelpayoutsDeal(deal) {
  return (
    deal?.provider === "travelpayouts" || deal?.bookWith === "travelpayouts"
  );
}

/** True only for the fixed Emirates + free checked-bag Thailand watch deal. */
export function isEmiratesBagDeal(deal) {
  if (!deal || deal.watch !== "thailand") return false;
  if (isTravelpayoutsDeal(deal)) return false;
  if (!deal.baggageIncluded) return false;
  const label = String(deal.airlineLabelHe ?? "").toLowerCase();
  const airline = String(deal.airline ?? deal.airlineCode ?? "").toUpperCase();
  return (
    airline === "EK" ||
    label.includes("אמירטס") ||
    label.includes("emirates")
  );
}

async function rememberEmiratesDeal(deal) {
  if (!isEmiratesBagDeal(deal)) return;
  emiratesDealCache = { at: Date.now(), deal };
  await persistDeals();
}

/**
 * Command אמירטס / תאילנד — returns ONLY the fixed Emirates+bag deal.
 * Never mixes in Budapest or non-Emirates Travelpayouts fares.
 */
export async function searchThailandFixedWatch({ forceRefresh = true } = {}) {
  await ensurePersistedLoaded();
  const cfg = thailandWatchConfig();

  let deep = [];
  try {
    deep = await searchThailandWatch({ forceRefresh });
  } catch (error) {
    console.warn("[thailand-fixed] deep Emirates+bag search failed", error);
  }

  const emirates = deep.filter((d) => isEmiratesBagDeal(d));
  if (emirates.length) {
    await rememberEmiratesDeal(emirates[0]);
    console.log(
      `[thailand-fixed] Emirates+bag ₪${emirates[0].priceIls} ${cfg.outbound}→${cfg.returnDate}`,
    );
    return [emirates[0]];
  }

  if (emiratesDealCache.deal && isEmiratesBagDeal(emiratesDealCache.deal)) {
    console.warn(
      `[thailand-fixed] live miss — serving last Emirates+bag ₪${emiratesDealCache.deal.priceIls}`,
    );
    return [emiratesDealCache.deal];
  }

  console.warn("[thailand-fixed] no Emirates+bag deal available");
  return [];
}

async function searchBudapestViaTravelpayouts() {
  await ensurePersistedLoaded();
  const cfg = budapestWatchConfig();
  const airport = cfg.airports[0] || "BUD";
  try {
    const { rows, mode } = await fetchTravelpayoutsPricesForDates({
      origin: ORIGIN,
      destination: airport,
      departureAt: cfg.outbound,
      returnAt: cfg.returnDate,
      currency: "ils",
      limit: 50,
    });

    let best = pickTravelpayoutsBest(rows, {
      targetOut: cfg.outbound,
      targetBack: cfg.returnDate,
      maxPriceIls: cfg.maxPriceIls,
      preferredAirlines: [],
      maxDateDriftDays: 10,
    });
    if (!best) {
      best = pickTravelpayoutsBest(rows, {
        targetOut: cfg.outbound,
        targetBack: cfg.returnDate,
        maxPriceIls: cfg.maxPriceIls,
        preferredAirlines: [],
        maxDateDriftDays: 366,
      });
    }

    if (!best) {
      console.log(
        `[travelpayouts/budapest] no fares ≤₪${cfg.maxPriceIls} (${mode}, ${rows.length} cached)`,
      );
      return budapestCache.deals?.length ? budapestCache.deals : [];
    }

    const depLocal = rowDepartureLocal(best.row);
    const priceUsd = Number((best.priceIls / cfg.ilsToUsd).toFixed(2));
    const outDate = best.depDate;
    const backDate = best.retDate;
    const linkDateOut = outDate.replace(/-/g, "").slice(2);
    const linkDateBack = backDate.replace(/-/g, "").slice(2);
    const dateNote =
      outDate === cfg.outbound && backDate === cfg.returnDate
        ? null
        : `תאריכי מטמון ${outDate}→${backDate} (יעד ${cfg.outbound}→${cfg.returnDate})`;
    const deal = {
      id: buildDealId(ORIGIN, airport, outDate, backDate, best.priceIls),
      origin: ORIGIN,
      destination: airport,
      destinationNameHe: "בודפשט",
      countryNameHe: "הונגריה",
      departureDate: outDate,
      returnDate: backDate,
      priceUsd,
      priceIls: best.priceIls,
      currency: "ILS",
      bookingUrl: `https://www.aviasales.com/search/${ORIGIN}${linkDateOut}${airport}${linkDateBack}1`,
      imageUrl: null,
      watch: "budapest",
      airlineLabelHe: travelpayoutsAirlineLabel(best.airline),
      baggageIncluded: false,
      baggageLabelHe: null,
      scheduleLabelHe:
        [depLocal ? `יציאה ~${depLocal}` : null, dateNote]
          .filter(Boolean)
          .join(" · ") || null,
      bookWith: "travelpayouts",
      provider: "travelpayouts",
    };

    budapestCache = { at: Date.now(), deals: [deal] };
    await persistDeals();
    console.log(
      `[travelpayouts/budapest] ${outDate}→${backDate} ₪${best.priceIls} ${deal.airlineLabelHe || best.airline} (${mode})`,
    );
    return [deal];
  } catch (error) {
    console.warn("[travelpayouts/budapest]", error);
    return budapestCache.deals?.length ? budapestCache.deals : [];
  }
}

export async function searchDeals({ forceRefresh = false } = {}) {
  await ensurePersistedLoaded();
  const provider = resolveProvider();
  if (!provider) {
    throw new Error(
      "הגדר TRAVELPAYOUTS_TOKEN (מומלץ/חינם) או SERPAPI_API_KEY, או FLIGHT_DEALS_DEMO=true",
    );
  }

  if (provider === "demo") {
    const [th, bud] = await Promise.all([
      searchThailandWatch({ forceRefresh: true }),
      searchBudapestWatch({ forceRefresh: true }),
    ]);
    const merged = mergeDeals([th, bud]);
    return merged.length ? merged : demoDeals();
  }

  if (provider === "travelpayouts") {
    const results = await Promise.allSettled([
      searchThailandViaTravelpayouts(),
      searchBudapestViaTravelpayouts(),
    ]);
    const lists = [];
    for (const [i, label] of [
      [0, "thailand"],
      [1, "budapest"],
    ]) {
      if (results[i].status === "fulfilled") lists.push(results[i].value);
      else console.warn(`[${label}]`, results[i].reason);
    }
    const merged = mergeDeals(lists);
    if (merged.length) return merged;
    const cached = [
      ...(thailandCache.deals ?? []),
      ...(budapestCache.deals ?? []),
    ];
    return cached.length ? mergeDeals([cached]) : [];
  }

  // SerpAPI path — auto-fallback to Travelpayouts when rate-limited/empty.
  if (Date.now() < serpCooldownUntil) {
    if (process.env.TRAVELPAYOUTS_TOKEN) {
      console.warn("[serpapi] cooling down — switching to Travelpayouts");
      const results = await Promise.allSettled([
        searchThailandViaTravelpayouts(),
        searchBudapestViaTravelpayouts(),
      ]);
      const lists = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);
      const merged = mergeDeals(lists);
      if (merged.length) return merged;
    }
    const cached = [
      ...(thailandCache.deals ?? []),
      ...(budapestCache.deals ?? []),
    ];
    if (cached.length) {
      console.warn(
        `[serpapi] cooling down — serving ${cached.length} cached deals`,
      );
      return mergeDeals([cached]);
    }
  }

  const results = await Promise.allSettled([
    searchThailandWatch({ forceRefresh }),
    searchBudapestWatch({ forceRefresh }),
  ]);

  const lists = [];
  for (const [i, label] of [
    [0, "thailand"],
    [1, "budapest"],
  ]) {
    if (results[i].status === "fulfilled") lists.push(results[i].value);
    else console.warn(`[${label}]`, results[i].reason);
  }
  const merged = mergeDeals(lists);
  if (!merged.length) {
    if (process.env.TRAVELPAYOUTS_TOKEN) {
      console.warn("[serpapi] empty — trying Travelpayouts fallback");
      const fb = await Promise.allSettled([
        searchThailandViaTravelpayouts(),
        searchBudapestViaTravelpayouts(),
      ]);
      const fbLists = fb
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);
      const fbMerged = mergeDeals(fbLists);
      if (fbMerged.length) return fbMerged;
    }
    const cached = [
      ...(thailandCache.deals ?? []),
      ...(budapestCache.deals ?? []),
    ];
    if (cached.length) {
      console.warn(`[serpapi] empty live search — using ${cached.length} cached`);
      return mergeDeals([cached]);
    }
  }
  return merged;
}
