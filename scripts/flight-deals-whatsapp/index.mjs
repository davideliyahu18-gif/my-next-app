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
import { resolveProvider, searchDeals as fetchDeals } from "./providers.mjs";

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
    cronExpr: process.env.FLIGHT_DEALS_SCAN_CRON ?? "*/10 * * * *",
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
  RAK: "מרקש",
  WAW: "ורשה",
};

let sock = null;
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

const COUNTRY_LABELS = {
  ATH: "יוון", LCA: "קפריסין", PFO: "קפריסין", BUD: "הונגריה",
  OTP: "רומניה", SOF: "בולגריה", IST: "טורקיה", AYT: "טורקיה",
  RAK: "מרוקו", RBA: "מרוקו", CMN: "מרוקו",
};

function formatDealMessage(deal) {
  const dest = airportLabel(deal.destination);
  const country = COUNTRY_LABELS[deal.destination] ?? "";
  const ils = Math.round(deal.priceUsd * 3.7);
  return [
    "🔥 *מכירה מצוינת!*",
    "",
    country ? `*${dest}, ${country}*` : `*${dest}*`,
    `📅 יציאה: ${formatDate(deal.departureDate)}`,
    `📅 חזרה: ${formatDate(deal.returnDate)}`,
    `💰 ₪${ils} (~$${deal.priceUsd.toFixed(0)}) *הלוך ושוב*`,
    `✈️ מ-TLV`,
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

async function sendToGroup(text) {
  if (!sock || !groupJid) return false;
  await sock.sendMessage(groupJid, { text });
  return true;
}

function normalizeHebrewCommand(text) {
  return String(text ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isStatusCheckCommand(text) {
  const t = normalizeHebrewCommand(text);
  return (
    t === "בוט מחפש טיסות" ||
    t === "בוט מחפש?" ||
    t === "בוט?" ||
    t.includes("בוט מחפש טיסות")
  );
}

async function handleIncomingMessage(msg) {
  try {
    if (!msg?.message || msg.key?.fromMe) return;

    const chatId = msg.key.remoteJid;
    if (!chatId) return;
    if (groupJid && chatId !== groupJid) return;

    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      "";

    if (!isStatusCheckCommand(body)) return;

    const reply = [
      "כן ✅ *מחפש*",
      "",
      `סורק כל 10 דקות טיסות הלוך-חזור מ-TLV עד $${cfg.maxPrice}.`,
      "כשיימצא דיל — אשלח לכאן.",
    ].join("\n");

    await sock.sendMessage(chatId, { text: reply }, { quoted: msg });
    log.info({ from: chatId }, "Replied to status check command");
  } catch (error) {
    log.warn({ error }, "Failed to handle incoming message");
  }
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

  if (!resolveProvider()) {
    log.warn("No flight provider configured");
    return;
  }

  scanRunning = true;

  try {
    log.info("Scanning for TLV deals ≤ $%d", cfg.maxPrice);
    const deals = await fetchDeals();
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
  const phone = (process.env.WHATSAPP_PHONE ?? "").replace(/\D/g, "");

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      await handleIncomingMessage(msg);
    }
  });

  let pairingRequested = false;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qr)}`;
      const pairLink = `https://wa.me/`;
      console.log("\n════════════════════════════════════════");
      console.log("📱 קישור ל-QR (פתח במחשב / טאב אחר וסרוק מהטלפון):");
      console.log(qrLink);
      console.log("════════════════════════════════════════\n");
      console.log("או בטלפון: WhatsApp → הגדרות → מכשירים מקושרים → קשר מכשיר\n");
      qrcode.generate(qr, { small: true });

      // Pairing code alternative (no QR scan) when phone is set
      if (phone && !pairingRequested && !sock.authState?.creds?.registered) {
        pairingRequested = true;
        try {
          const code = await sock.requestPairingCode(phone);
          console.log("\n════════════════════════════════════════");
          console.log("🔑 קוד חיבור (בלי QR):");
          console.log(`   WhatsApp → מכשירים מקושרים → קשר מכשיר → קישור עם מספר טלפון`);
          console.log(`   הזן את הקוד: ${code}`);
          console.log("════════════════════════════════════════\n");
        } catch (error) {
          log.warn({ error }, "Pairing code failed — use QR link above");
        }
      }
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

  if (!resolveProvider()) {
    console.error("❌ חסר מקור מחירים. בחר אחד:");
    console.error("   TRAVELPAYOUTS_TOKEN=...  (הכי קל — travelpayouts.com)");
    console.error("   SERPAPI_API_KEY=...       (serpapi.com — עם Google)");
    console.error("   FLIGHT_DEALS_DEMO=true    (בדיקה בלי הרשמה)");
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
