#!/usr/bin/env node
/**
 * Standalone WhatsApp flight-deals bot.
 *
 * Runs locally / on a VPS (Baileys needs a persistent session).
 * Scans Amadeus every 30 minutes for TLV round-trips ≤ $50 and posts to a group.
 *
 * Setup:
 *   cd scripts/flight-deals-whatsapp
 *   npm install
 *   cp ../../.env.example .env   # fill AMADEUS_* and WHATSAPP_GROUP_CHAT_ID
 *   npm start
 *
 * On first run, scan the QR code with WhatsApp → Linked Devices.
 */

import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cron from "node-cron";
import pino from "pino";
import qrcode from "qrcode-terminal";

const require = createRequire(import.meta.url);
const baileys = require("@whiskeysockets/baileys");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = baileys;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, "auth");
const SEEN_FILE = path.join(__dirname, "seen-deals.json");

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

const ORIGIN = process.env.FLIGHT_DEALS_ORIGIN ?? "TLV";
const MAX_PRICE = Number(process.env.FLIGHT_DEALS_MAX_PRICE_USD ?? "50");
const CURRENCY = process.env.FLIGHT_DEALS_CURRENCY ?? "USD";
const GROUP_JID = process.env.WHATSAPP_GROUP_CHAT_ID ?? "";
const AMADEUS_BASE = process.env.AMADEUS_API_BASE ?? "https://test.api.amadeus.com";
const AMADEUS_ID = process.env.AMADEUS_CLIENT_ID ?? "";
const AMADEUS_SECRET = process.env.AMADEUS_CLIENT_SECRET ?? "";
const CRON_EXPR = process.env.FLIGHT_DEALS_SCAN_CRON ?? "*/30 * * * *";

const AIRPORT_LABELS = {
  TLV: "תל אביב",
  ATH: "אתונה",
  LCA: "לרנקה",
  PFO: "פאפוס",
  BUD: "בודפשט",
  OTP: "בוקרשט",
  SOF: "סופיה",
  IST: "איסטנבול",
  AYT: "אנטליה",
  DXB: "דובאי",
  BCN: "ברצלונה",
  FCO: "רומא",
  PRG: "פראג",
  WAW: "ורשה",
};

let sock = null;
let tokenCache = null;
let seenDeals = new Set();
let scanRunning = false;

function airportLabel(code) {
  return AIRPORT_LABELS[code] ?? code;
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function formatDealMessage(deal) {
  return [
    "🛫 *דיל טיסה עד $50!*",
    "",
    `✈️ מסלול: ${airportLabel(deal.origin)} (${deal.origin}) ↔ ${airportLabel(deal.destination)} (${deal.destination})`,
    `📅 יציאה: ${formatDate(deal.departureDate)}`,
    `📅 חזרה: ${formatDate(deal.returnDate)}`,
    `💰 מחיר: $${deal.priceUsd.toFixed(2)} (הלוך-חזור)`,
    deal.bookingUrl ? `\n🔗 ${deal.bookingUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function loadSeen() {
  if (!existsSync(SEEN_FILE)) return;
  try {
    const raw = await readFile(SEEN_FILE, "utf8");
    const ids = JSON.parse(raw);
    if (Array.isArray(ids)) seenDeals = new Set(ids);
  } catch (error) {
    log.warn({ error }, "Could not load seen-deals.json");
  }
}

async function saveSeen() {
  await writeFile(SEEN_FILE, JSON.stringify([...seenDeals], null, 2));
}

async function getAmadeusToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: AMADEUS_ID,
    client_secret: AMADEUS_SECRET,
  });

  const res = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`Amadeus auth HTTP ${res.status}`);
  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
  };
  return tokenCache.token;
}

async function searchDeals() {
  const token = await getAmadeusToken();
  const params = new URLSearchParams({
    origin: ORIGIN,
    maxPrice: String(MAX_PRICE),
    currency: CURRENCY,
    oneWay: "false",
  });

  const res = await fetch(
    `${AMADEUS_BASE}/v1/shopping/flight-destinations?${params}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Amadeus search HTTP ${res.status}: ${text}`);
  }

  const payload = await res.json();
  const deals = [];

  for (const row of payload.data ?? []) {
    const priceUsd = Number(row.price?.total);
    if (!row.destination || !row.departureDate || !row.returnDate) continue;
    if (!Number.isFinite(priceUsd) || priceUsd > MAX_PRICE) continue;

    const id = `${row.origin}-${row.destination}-${row.departureDate}-${row.returnDate}-${priceUsd.toFixed(2)}`;
    deals.push({
      id,
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

async function sendToGroup(text) {
  if (!sock || !GROUP_JID) {
    log.warn("Socket or WHATSAPP_GROUP_CHAT_ID not ready");
    return false;
  }

  await sock.sendMessage(GROUP_JID, { text });
  return true;
}

async function runScan() {
  if (scanRunning) {
    log.info("Scan already running, skipping");
    return;
  }

  scanRunning = true;

  try {
    log.info("Scanning Amadeus for TLV deals ≤ $%d", MAX_PRICE);
    const deals = await searchDeals();
    log.info("Found %d deals at or below max price", deals.length);

    let sent = 0;
    for (const deal of deals) {
      if (seenDeals.has(deal.id)) continue;
      seenDeals.add(deal.id);
      const ok = await sendToGroup(formatDealMessage(deal));
      if (ok) {
        sent += 1;
        log.info({ deal: deal.id }, "Sent deal to group");
      }
    }

    await saveSeen();
    log.info("Scan done — %d new messages sent", sent);
  } catch (error) {
    log.error({ error }, "Scan failed");
  } finally {
    scanRunning = false;
  }
}

async function connectWhatsApp() {
  await mkdir(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 סרוק את קוד ה-QR עם WhatsApp → מכשירים מקושרים:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      log.info("WhatsApp connected — group: %s", GROUP_JID || "(not set)");
      runScan();
    }

    if (connection === "close") {
      const status = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = status !== DisconnectReason.loggedOut;
      log.warn({ status }, "WhatsApp disconnected");
      if (shouldReconnect) {
        setTimeout(connectWhatsApp, 5_000);
      }
    }
  });
}

async function main() {
  if (!AMADEUS_ID || !AMADEUS_SECRET) {
    console.error("❌ Set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET in .env");
    process.exit(1);
  }

  if (!GROUP_JID) {
    console.error("❌ Set WHATSAPP_GROUP_CHAT_ID (group JID, e.g. 120363...@g.us)");
    process.exit(1);
  }

  await loadSeen();
  await connectWhatsApp();

  cron.schedule(CRON_EXPR, () => {
    log.info("Cron triggered (%s)", CRON_EXPR);
    runScan();
  });

  log.info("Flight deals bot started — cron: %s", CRON_EXPR);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
