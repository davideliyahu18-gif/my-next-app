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
import {
  resolveProvider,
  searchDeals as fetchDeals,
  dealFingerprint,
  getSearchStatus,
} from "./providers.mjs";

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

let sock = null;
/** @type {Map<string, { priceUsd: number, at: number, id: string }>} */
let seenDeals = new Map();
let scanRunning = false;
let lastScanAt = 0;
let lastScanFound = 0;
let lastScanSent = 0;
let lastForceRefreshAt = 0;
let groupJid = "";
let groupPollTimer = null;
let welcomeSent = false;
let cfg = envConfig();
const GROUP_POLL_MS = 10_000;

const AIRPORT_LABELS = {
  TLV: "תל אביב", ATH: "אתונה", LCA: "לרנקה", PFO: "פאפוס", BUD: "בודפשט",
  OTP: "בוקרשט", SOF: "סופיה", IST: "איסטנבול", AYT: "אנטליה", DXB: "דובאי",
  BCN: "ברצלונה", FCO: "רומא", CIA: "רומא", MXP: "מילאנו", LIN: "מילאנו",
  PRG: "פראג", RAK: "מרקש", WAW: "ורשה", KRK: "קרקוב", VCE: "ונציה",
  NAP: "נאפולי", LGW: "לונדון", LHR: "לונדון", STN: "לונדון", VIE: "וינה",
  BER: "ברלין", AMS: "אמסטרדם", CDG: "פריז", MAD: "מדריד", SKG: "סלוניקי",
  BKK: "בנגקוק", DMK: "בנגקוק", HKT: "פוקט", CNX: "צ׳יאנג מאי",
};

const COUNTRY_LABELS = {
  ATH: "יוון", SKG: "יוון", LCA: "קפריסין", PFO: "קפריסין", BUD: "הונגריה",
  OTP: "רומניה", SOF: "בולגריה", IST: "טורקיה", AYT: "טורקיה",
  RAK: "מרוקו", RBA: "מרוקו", CMN: "מרוקו", VCE: "איטליה", FCO: "איטליה",
  CIA: "איטליה", MXP: "איטליה", NAP: "איטליה", BCN: "ספרד", MAD: "ספרד",
  PRG: "צ׳כיה", WAW: "פולין", KRK: "פולין", LGW: "בריטניה", LHR: "בריטניה",
  VIE: "אוסטריה", BER: "גרמניה", AMS: "הולנד", CDG: "צרפת", DXB: "איחוד האמירויות",
  BKK: "תאילנד", DMK: "תאילנד", HKT: "תאילנד", CNX: "תאילנד",
};

function hasHebrew(value) {
  return /[\u0590-\u05FF]/.test(value);
}

function isAirportCode(value) {
  return /^[A-Za-z]{3}$/.test(String(value).trim());
}

const ENGLISH_CITY_TO_HEBREW = {
  athens: "אתונה",
  budapest: "בודפשט",
  rome: "רומא",
  milan: "מילאנו",
  venice: "ונציה",
  barcelona: "ברצלונה",
  madrid: "מדריד",
  london: "לונדון",
  paris: "פריז",
  prague: "פראג",
  vienna: "וינה",
  warsaw: "ורשה",
  krakow: "קרקוב",
  sofia: "סופיה",
  bucharest: "בוקרשט",
  istanbul: "איסטנבול",
  larnaca: "לרנקה",
  paphos: "פאפוס",
  dubai: "דובאי",
  naples: "נאפולי",
  berlin: "ברלין",
  amsterdam: "אמסטרדם",
};

function hebrewDestination(deal) {
  const candidates = [
    deal.destinationNameHe,
    AIRPORT_LABELS[deal.destination],
    deal.destination,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const value = String(raw).trim();
    if (!value) continue;
    if (isAirportCode(value)) {
      const mapped = AIRPORT_LABELS[value.toUpperCase()];
      if (mapped) return mapped;
      continue;
    }
    if (hasHebrew(value)) return value;
    const mappedEnglish = ENGLISH_CITY_TO_HEBREW[value.toLowerCase()];
    if (mappedEnglish) return mappedEnglish;
  }
  return AIRPORT_LABELS[deal.destination] || "יעד לא ידוע";
}

function hebrewCountry(deal) {
  const fromDeal = String(deal.countryNameHe || "").trim();
  if (fromDeal && hasHebrew(fromDeal)) return fromDeal;
  return COUNTRY_LABELS[deal.destination] || "";
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

const DAY_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function hebrewDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return DAY_HE[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "";
}

function formatDealMessage(deal) {
  const dest = hebrewDestination(deal);
  const country = hebrewCountry(deal);
  const ils = Math.round(deal.priceUsd * 3.7);
  const outDay = hebrewDay(deal.departureDate);
  const backDay = hebrewDay(deal.returnDate);
  const isThailand = deal.watch === "thailand";
  return [
    isThailand ? "🇹🇭 *מעקב תאילנד*" : "🔥 *מכירה מצוינת!*",
    "",
    country ? `*${dest}, ${country}*` : `*${dest}*`,
    `📅 יציאה ${outDay}: ${formatDate(deal.departureDate)}`,
    `📅 חזרה ${backDay}: ${formatDate(deal.returnDate)}`,
    `💰 ₪${ils} (כ־$${deal.priceUsd.toFixed(0)}) *הלוך ושוב*`,
    isThailand
      ? `✈️ מתל אביב · מעקב קבוע לתאריכים אלו`
      : `✈️ מתל אביב · רביעי→שני / חמישי→ראשון · יולי–דצמבר · עד ${cfg.maxPrice}$`,
    deal.bookingUrl ? `\n🔗 קישור להזמנה:\n${deal.bookingUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendToGroup(content) {
  if (!sock || !groupJid) return false;

  if (typeof content === "string") {
    await sock.sendMessage(groupJid, { text: content });
    return true;
  }

  const caption = formatDealMessage(content);
  if (content.imageUrl) {
    try {
      await sock.sendMessage(groupJid, {
        image: { url: content.imageUrl },
        caption,
      });
      return true;
    } catch (error) {
      log.warn({ error }, "Image send failed — falling back to text");
    }
  }

  await sock.sendMessage(groupJid, { text: caption });
  return true;
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
  const raw = await loadJson(SEEN_FILE, []);
  seenDeals = new Map();
  // Legacy format: string[] of full deal ids
  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (typeof id !== "string") continue;
      const parts = id.split("-");
      // TLV-ATH-2026-10-02-2026-10-11-118.00
      if (parts.length >= 7) {
        const fp = parts.slice(0, -1).join("-");
        const priceUsd = Number(parts.at(-1));
        seenDeals.set(fp, {
          priceUsd: Number.isFinite(priceUsd) ? priceUsd : 9999,
          at: Date.now(),
          id,
        });
      } else {
        seenDeals.set(id, { priceUsd: 9999, at: Date.now(), id });
      }
    }
    return;
  }
  // New format: { fingerprint: { priceUsd, at, id } }
  if (raw && typeof raw === "object") {
    for (const [fp, meta] of Object.entries(raw)) {
      seenDeals.set(fp, {
        priceUsd: Number(meta?.priceUsd ?? 9999),
        at: Number(meta?.at ?? Date.now()),
        id: String(meta?.id ?? fp),
      });
    }
  }
}

async function saveSeen() {
  const obj = Object.fromEntries(seenDeals.entries());
  await writeFile(SEEN_FILE, JSON.stringify(obj, null, 2));
}

function shouldNotifyDeal(deal) {
  const fp = dealFingerprint(deal);
  const prev = seenDeals.get(fp);
  if (!prev) return true;

  // Thailand fixed watch: re-alert on meaningful price drops.
  if (deal.watch === "thailand") {
    const dropUsd = Number(process.env.FLIGHT_DEALS_THAILAND_PRICE_DROP_USD ?? "30");
    return deal.priceUsd <= prev.priceUsd - dropUsd;
  }

  // Europe deals: only brand-new fingerprints.
  return false;
}

function markDealSeen(deal) {
  seenDeals.set(dealFingerprint(deal), {
    priceUsd: deal.priceUsd,
    at: Date.now(),
    id: deal.id,
  });
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

function normalizeHebrewCommand(text) {
  return String(text ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[?؟！!.,，、~`'"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isStatusCheckCommand(text) {
  const t = normalizeHebrewCommand(text);
  if (!t) return false;
  if (t === "בוט") return true;
  if (t.includes("בוט מחפש")) return true;
  if (t.includes("הבוט מחפש")) return true;
  if (t.startsWith("בוט ") && (t.includes("מחפש") || t.includes("טיסות"))) return true;
  return false;
}

function sameChatId(a, b) {
  if (!a || !b) return false;
  const left = String(a).split(":")[0];
  const right = String(b).split(":")[0];
  return left === right || left.split("@")[0] === right.split("@")[0];
}

function extractMessageText(msg) {
  const m = msg?.message;
  if (!m) return "";
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    ""
  );
}

function buildStatusReply() {
  const status = getSearchStatus();
  const ago = lastScanAt
    ? `${Math.max(1, Math.round((Date.now() - lastScanAt) / 60_000))} דק׳`
    : "עדיין לא";
  const th = status.thailand;
  const thLine = th
    ? `תאילנד קבוע: 10/02/2027–10/03/2027` +
      (th.lowest != null ? ` · נמוך כרגע $${th.lowest}` : "")
    : "";
  return [
    "כן ✅ *מחפש*",
    "",
    `סורק כל 10 דקות · TLV הלוך-חזור עד $${cfg.maxPrice}`,
    "רק *רביעי→שני* או *חמישי→ראשון*",
    "טווח חיפוש: *יולי–דצמבר*",
    thLine,
    `סריקה אחרונה: ${ago} | נמצאו ${lastScanFound} | נשלחו חדשים ${lastScanSent}`,
    `במאגר כרגע: ${status.cachedDeals} דילים`,
    status.nextWindow ? `חלון הבא: ${status.nextWindow}` : "",
    "כשיימצא דיל חדש — אשלח לכאן.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function handleIncomingMessage(msg) {
  try {
    if (!msg?.message || msg.key?.fromMe) return;

    const chatId = msg.key.remoteJid;
    if (!chatId) return;

    // Accept the configured group, and also learn group JID if missing.
    const isGroup = chatId.endsWith("@g.us");
    if (groupJid && isGroup && !sameChatId(chatId, groupJid)) {
      // Ignore other groups silently.
      return;
    }
    if (!isGroup && groupJid) {
      // Ignore DMs when we are bound to a group.
      return;
    }

    const body = extractMessageText(msg);
    if (!body) return;

    if (!isStatusCheckCommand(body)) {
      // Help debug silent command issues without spamming logs.
      if (/בוט/.test(body)) {
        log.info({ body, chatId }, "Ignored bot-like message (no command match)");
      }
      return;
    }

    if (!groupJid && isGroup) {
      groupJid = chatId;
      await saveState();
    }

    const reply = buildStatusReply();
    await sock.sendMessage(chatId, { text: reply }, { quoted: msg });
    log.info({ from: chatId, body }, "Replied to status check command");

    // Kick a refresh scan so status checks can surface new windows/deals.
    runScan({ forceRefresh: true, reason: "status-command" }).catch((error) => {
      log.warn({ error }, "Status-triggered scan failed");
    });
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
        `אני סורק כל 10 דקות טיסות הלוך-חזור מ-TLV עד $${cfg.maxPrice}.`,
        "רק רביעי→שני או חמישי→ראשון · יולי עד דצמבר.",
        "מעקב קבוע גם לתאילנד: 10/02/2027–10/03/2027.",
        "כתבו *בוט מחפש?* לבדיקת סטטוס.",
        "כשאמצא דיל חדש — אשלח לכאן תאריכים ומחיר.",
        cfg.demoMode ? "\n_מצב דמו פעיל — הודעת בדיקה תישלח בסריקה הראשונה._" : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    welcomeSent = true;
    await saveState();
  }

  await runScan({ forceRefresh: true, reason: "group-ready" });
}

async function runScan({ forceRefresh = false, reason = "cron" } = {}) {
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
    // If everything in cache was already sent, force the next date windows.
    const shouldForce =
      forceRefresh ||
      (Date.now() - lastForceRefreshAt > 90 * 60_000 &&
        lastScanFound > 0 &&
        lastScanSent === 0 &&
        Date.now() - lastScanAt > 8 * 60_000);

    if (shouldForce) lastForceRefreshAt = Date.now();

    log.info(
      "Scanning for TLV deals ≤ $%d (%s%s)",
      cfg.maxPrice,
      reason,
      shouldForce ? ", force-refresh" : "",
    );
    const deals = await fetchDeals({ forceRefresh: shouldForce });
    lastScanFound = deals.length;
    log.info("Found %d deals at or below max price", deals.length);

    let sent = 0;
    for (const deal of deals) {
      if (!shouldNotifyDeal(deal)) continue;
      markDealSeen(deal);
      const ok = await sendToGroup(deal);
      if (ok) {
        sent += 1;
        log.info({ deal: deal.id }, "Sent deal to group");
      }
    }

    lastScanSent = sent;
    lastScanAt = Date.now();
    await saveSeen();
    log.info("Scan done — %d new messages sent", sent);

    // If we only hit already-sent deals, roll windows forward once more.
    if (sent === 0 && deals.length > 0 && reason !== "followup-refresh") {
      const followGap = Date.now() - lastForceRefreshAt;
      if (followGap > 2 * 60_000) {
        lastForceRefreshAt = Date.now();
        scanRunning = false;
        await runScan({ forceRefresh: true, reason: "followup-refresh" });
        return;
      }
    }
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
    // Baileys may deliver live group texts as "notify" or "append".
    if (type !== "notify" && type !== "append") return;
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
    runScan({ reason: "cron" });
  });

  log.info("Flight deals bot started — cron: %s", cfg.cronExpr);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
