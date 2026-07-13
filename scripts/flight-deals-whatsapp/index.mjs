#!/usr/bin/env node
/**
 * WhatsApp flight-deals bot — TLV round-trip ≤ $50, every 30 min.
 *
 * The bot finds the WhatsApp group automatically by WHATSAPP_GROUP_NAME.
 * You only need to create the group with that name and add this linked number.
 */

import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cron from "node-cron";
import pino from "pino";
import qrcode from "qrcode-terminal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const AUTH_DIR = path.join(__dirname, "auth");
const SEEN_FILE = path.join(__dirname, "seen-deals.json");
const STATE_FILE = path.join(__dirname, "bot-state.json");

const require = createRequire(import.meta.url);
const baileys = require("@whiskeysockets/baileys");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = baileys;

async function loadEnvFile() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const text = await readFile(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function envConfig() {
  return {
    origin: process.env.FLIGHT_DEALS_ORIGIN ?? "TLV",
    maxPrice: Number(process.env.FLIGHT_DEALS_MAX_PRICE_USD ?? "50"),
    currency: process.env.FLIGHT_DEALS_CURRENCY ?? "USD",
    groupJidEnv: process.env.WHATSAPP_GROUP_CHAT_ID ?? "",
    groupName: process.env.WHATSAPP_GROUP_NAME ?? "",
    demoMode: process.env.FLIGHT_DEALS_DEMO === "true",
    amadeusBase: process.env.AMADEUS_API_BASE ?? "https://test.api.amadeus.com",
    amadeusId: process.env.AMADEUS_CLIENT_ID ?? "",
    amadeusSecret: process.env.AMADEUS_CLIENT_SECRET ?? "",
    cronExpr: process.env.FLIGHT_DEALS_SCAN_CRON ?? "*/30 * * * *",
  };
}

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

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
let groupJid = "";
let groupPollTimer = null;
let welcomeSent = false;
let cfg = envConfig();

const GROUP_POLL_MS = 10_000;

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

async function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function loadSeen() {
  const ids = await loadJson(SEEN_FILE, []);
  if (Array.isArray(ids)) seenDeals = new Set(ids);
}

async function saveSeen() {
  await writeFile(SEEN_FILE, JSON.stringify([...seenDeals], null, 2));
}

async function loadState() {
  const state = await loadJson(STATE_FILE, {});
  if (state.groupJid && !groupJid) groupJid = state.groupJid;
  welcomeSent = Boolean(state.welcomeSent);
}

async function saveState() {
  await writeFile(
    STATE_FILE,
    JSON.stringify({ groupJid, welcomeSent, groupName: cfg.groupName }, null, 2),
  );
}

async function getAmadeusToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.amadeusId,
    client_secret: cfg.amadeusSecret,
  });

  const res = await fetch(`${cfg.amadeusBase}/v1/security/oauth2/token`, {
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
  if (cfg.demoMode) {
    const today = new Date();
    const depart = new Date(today.getTime() + 14 * 86_400_000);
    const ret = new Date(depart.getTime() + 5 * 86_400_000);
    const fmt = (d) => d.toISOString().slice(0, 10);
    return [
      {
        id: `demo-${fmt(depart)}`,
        origin: "TLV",
        destination: "ATH",
        departureDate: fmt(depart),
        returnDate: fmt(ret),
        priceUsd: 49.9,
        bookingUrl: null,
      },
    ];
  }

  const token = await getAmadeusToken();
  const params = new URLSearchParams({
    origin: cfg.origin,
    maxPrice: String(cfg.maxPrice),
    currency: cfg.currency,
    oneWay: "false",
  });

  const res = await fetch(
    `${cfg.amadeusBase}/v1/shopping/flight-destinations?${params}`,
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
    if (!Number.isFinite(priceUsd) || priceUsd > cfg.maxPrice) continue;

    const id = `${row.origin}-${row.destination}-${row.departureDate}-${row.returnDate}-${priceUsd.toFixed(2)}`;
    deals.push({
      id,
      origin: row.origin ?? cfg.origin,
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
  if (!sock || !groupJid) return false;
  await sock.sendMessage(groupJid, { text });
  return true;
}

async function resolveGroupByName() {
  if (!sock || !cfg.groupName || groupJid) return groupJid;

  try {
    const participating = await sock.groupFetchAllParticipating();
    const groups = Object.values(participating ?? {});
    const match = groups.find(
      (g) => String(g.subject ?? "").trim() === cfg.groupName.trim(),
    );

    if (match?.id) {
      groupJid = match.id;
      await saveState();
      console.log(`\n✅ נמצאה קבוצה: "${cfg.groupName}" → ${groupJid}\n`);
      return groupJid;
    }
  } catch (error) {
    log.warn({ error }, "Group lookup failed");
  }

  return null;
}

function startGroupPolling() {
  if (groupJid || !cfg.groupName) return;

  console.log(`\n⏳ מחכה לקבוצה בשם: "${cfg.groupName}"`);
  console.log("   פתח את הקבוצה, הוסף את המספר המקושר, ואז הבוט יתחבר אוטומטית.\n");

  groupPollTimer = setInterval(async () => {
    const found = await resolveGroupByName();
    if (found) {
      clearInterval(groupPollTimer);
      groupPollTimer = null;
      await onGroupReady();
    }
  }, GROUP_POLL_MS);
}

async function onGroupReady() {
  if (!welcomeSent) {
    await sendToGroup(
      [
        "✅ *הבוט מחובר!*",
        "",
        `אני סורק כל 30 דקות טיסות הלוך-חזור מ-TLV עד $${cfg.maxPrice}.`,
        "כשאמצא דיל — אשלח לכאן תאריכים ומחיר.",
        cfg.demoMode ? "\n_מצב דמו פעיל — הודעת בדיקה תישלח בסריקה הראשונה._" : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    welcomeSent = true;
    await saveState();
  }

  await runScan();
}

async function runScan() {
  if (!groupJid) {
    log.info("No group yet — skipping scan");
    return;
  }

  if (scanRunning) {
    log.info("Scan already running, skipping");
    return;
  }

  if (!cfg.demoMode && (!cfg.amadeusId || !cfg.amadeusSecret)) {
    log.warn("Amadeus keys missing — set AMADEUS_CLIENT_ID/SECRET or FLIGHT_DEALS_DEMO=true");
    return;
  }

  scanRunning = true;

  try {
    log.info("Scanning for TLV deals ≤ $%d", cfg.maxPrice);
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
      console.log("\n📱 סרוק QR: WhatsApp → הגדרות → מכשירים מקושרים → קשר מכשיר\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      log.info("WhatsApp connected");
      if (groupJid) {
        onGroupReady();
      } else if (cfg.groupName) {
        resolveGroupByName().then((found) => {
          if (found) onGroupReady();
          else startGroupPolling();
        });
      } else {
        console.error("❌ הגדר WHATSAPP_GROUP_NAME או WHATSAPP_GROUP_CHAT_ID");
      }
    }

    if (connection === "close") {
      const status = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = status !== DisconnectReason.loggedOut;
      log.warn({ status }, "WhatsApp disconnected");
      if (shouldReconnect) setTimeout(connectWhatsApp, 5_000);
    }
  });
}

async function main() {
  await loadEnvFile();
  cfg = envConfig();
  groupJid = cfg.groupJidEnv;

  if (!cfg.groupJidEnv && !cfg.groupName) {
    console.error("❌ הגדר WHATSAPP_GROUP_NAME (שם הקבוצה) או WHATSAPP_GROUP_CHAT_ID");
    process.exit(1);
  }

  if (!cfg.demoMode && (!cfg.amadeusId || !cfg.amadeusSecret)) {
    console.error("❌ חסרים מפתחות Amadeus — הדבק ב-.env.local");
    console.error("   או הפעל מצב בדיקה: FLIGHT_DEALS_DEMO=true");
    process.exit(1);
  }

  await loadSeen();
  await loadState();
  await connectWhatsApp();

  cron.schedule(cfg.cronExpr, () => {
    log.info("Cron triggered (%s)", cfg.cronExpr);
    runScan();
  });

  log.info("Flight deals bot started — cron: %s", cfg.cronExpr);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
