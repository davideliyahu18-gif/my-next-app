#!/usr/bin/env node
/**
 * WhatsApp Thailand flight-deals bot (Emirates schedule watch).
 *
 * Single process. Pin WHATSAPP_GROUP_CHAT_ID. Never run two instances.
 */

import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { existsSync, openSync, writeSync, closeSync, unlinkSync } from "node:fs";
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
  getCachedWatchDeals,
  thailandWatchConfig,
  budapestWatchConfig,
} from "./providers.mjs";
import {
  loadPersonalUsers,
  upsertPersonalUser,
  getPersonalUser,
  listActivePersonalUsers,
  parsePersonalCommand,
  personalHelpText,
  personalStatusText,
  shouldAlertPersonalUser,
  formatWatchesHe,
  DEFAULT_WATCHES,
} from "./personal-users.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const AUTH_DIR = path.join(__dirname, "auth");
const SEEN_FILE = path.join(__dirname, "seen-deals.json");
const STATE_FILE = path.join(__dirname, "bot-state.json");
const TRIGGER_FILE = path.join(__dirname, "test-trigger.json");
const LOCK_FILE = path.join(__dirname, "bot.lock");

const require = createRequire(import.meta.url);
const baileys = require("@whiskeysockets/baileys");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
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
    let value = trimmed.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

/** Legacy — prefer `npm run flight-deals:repair-auth`. */
async function healSignalSessions() {
  if (process.env.FLIGHT_DEALS_HEAL_SESSION !== "true") return;
  try {
    const files = await readdir(AUTH_DIR);
    let removed = 0;
    for (const name of files) {
      if (name.startsWith("session-") && name.endsWith(".json")) {
        await unlink(path.join(AUTH_DIR, name));
        removed += 1;
      }
    }
    if (removed) log.info({ removed }, "Healed WhatsApp signal sessions");
  } catch (error) {
    log.warn({ error }, "Session heal skipped");
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
let scanQueued = false;
let startupScanDone = false;
let whatsappConnected = false;
let pairingRefreshTimer = null;
let pairingStarted = false;
let reconnectTimer = null;
let connecting = false;
let connectGeneration = 0;
let reconnectFailures = 0;
/** @type {Map<string, import("@whiskeysockets/baileys").proto.IMessage>} */
const messageStore = new Map();
const handledMsgIds = new Set();
let lastScanAt = 0;
let lastScanFound = 0;
let lastScanSent = 0;
let lastForceRefreshAt = 0;
let groupJid = "";
let groupPollTimer = null;
let welcomeSent = false;
let cfg = envConfig();
let lockFd = null;
const GROUP_POLL_MS = 10_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function acquireInstanceLock() {
  try {
    lockFd = openSync(LOCK_FILE, "wx");
    writeSync(lockFd, String(process.pid));
  } catch (error) {
    if (error?.code === "EEXIST") {
      let other = "";
      try {
        other = ` (pid ${require("node:fs").readFileSync(LOCK_FILE, "utf8").trim()})`;
      } catch {
        // ignore
      }
      console.error(
        `❌ הבוט כבר רץ${other}. עצור אותו לפני הפעלה מחדש:\n   pkill -f 'flight-deals-whatsapp/index.mjs'`,
      );
      process.exit(1);
    }
    throw error;
  }
  const release = () => {
    try {
      if (lockFd != null) closeSync(lockFd);
    } catch {
      // ignore
    }
    try {
      unlinkSync(LOCK_FILE);
    } catch {
      // ignore
    }
    lockFd = null;
  };
  process.on("exit", release);
  process.on("SIGINT", () => {
    release();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    release();
    process.exit(0);
  });
}

function rememberHandledMessage(msg) {
  const id = msg?.key?.id;
  if (!id) return false;
  if (handledMsgIds.has(id)) return true;
  handledMsgIds.add(id);
  if (handledMsgIds.size > 800) {
    const first = handledMsgIds.keys().next().value;
    handledMsgIds.delete(first);
  }
  return false;
}

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
  const isThailand = deal.watch === "thailand";
  const isBudapest = deal.watch === "budapest";
  const ils = Number.isFinite(deal.priceIls)
    ? Math.round(deal.priceIls)
    : Math.round(deal.priceUsd * 3.7);
  const usd = Number.isFinite(deal.priceIls)
    ? (deal.priceIls / 3.7).toFixed(0)
    : deal.priceUsd.toFixed(0);
  const outDay = hebrewDay(deal.departureDate);
  const backDay = hebrewDay(deal.returnDate);
  const header = isThailand
    ? "🇹🇭 *מעקב תאילנד · אמירטס · מזוודה*"
    : isBudapest
      ? "🇭🇺 *מעקב בודפשט*"
      : "🔥 *מכירה מצוינת!*";
  const footer = isThailand
    ? "✈️ מתל אביב · יציאה 15:10→07:35 · חזרה בלילה · אמירטס + מזוודה"
    : isBudapest
      ? "✈️ מתל אביב · 11/11/2026–15/11/2026 · מעקב קבוע"
      : `✈️ מתל אביב · עד ${cfg.maxPrice}$`;
  return [
    header,
    "",
    country ? `*${dest}, ${country}*` : `*${dest}*`,
    `📅 יציאה ${outDay}: ${formatDate(deal.departureDate)}`,
    `📅 חזרה ${backDay}: ${formatDate(deal.returnDate)}`,
    deal.scheduleLabelHe ? `🕕 *לוח זמנים:* ${deal.scheduleLabelHe}` : "",
    `💰 *₪${ils}* (כ־$${usd}) *הלוך ושוב*`,
    deal.airlineLabelHe ? `🛫 חברת תעופה: *${deal.airlineLabelHe}*` : "",
    isThailand ? `🧳 *מזוודה כלולה*` : "",
    isThailand && deal.baggageLabelHe ? `   (${deal.baggageLabelHe})` : "",
    footer,
    deal.bookingUrl ? `\n🔗 קישור להזמנה:\n${deal.bookingUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendChat(chatId, content) {
  if (!sock || !chatId) return false;
  try {
    if (typeof content === "string") {
      await sock.sendMessage(chatId, { text: content });
      return true;
    }
    const caption = formatDealMessage(content);
    await sock.sendMessage(chatId, { text: caption });
    return true;
  } catch (error) {
    log.warn({ error, chatId }, "sendChat failed");
    return false;
  }
}

async function sendToGroup(content) {
  if (!groupJid) return false;
  return sendChat(groupJid, content);
}

async function notifyPersonalSubscribers(deal) {
  if (!deal?.watch) return 0;
  const price = Number(deal.priceIls ?? deal.priceUsd);
  let sent = 0;
  for (const [jid, user] of listActivePersonalUsers()) {
    if (!shouldAlertPersonalUser(user, deal)) continue;
    const ok = await sendChat(
      jid,
      [
        "🔔 *התראה אישית*",
        "",
        formatDealMessage(deal),
        "",
        "_כדי להפסיק: כתוב *עצור*_",
      ].join("\n"),
    );
    if (ok) {
      sent += 1;
      const lastAlertByWatch = {
        ...(user.lastAlertByWatch ?? {}),
        [deal.watch]: price,
      };
      await upsertPersonalUser(jid, { lastAlertByWatch });
      log.info({ jid, watch: deal.watch, priceIls: price }, "Personal alert sent");
    }
    await sleep(400);
  }
  return sent;
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

  // Fixed watches: re-alert on meaningful ILS price drops.
  if (deal.watch === "thailand" || deal.watch === "budapest") {
    const dropEnv =
      deal.watch === "budapest"
        ? process.env.FLIGHT_DEALS_BUDAPEST_PRICE_DROP_ILS
        : process.env.FLIGHT_DEALS_THAILAND_PRICE_DROP_ILS;
    const dropIls = Number(dropEnv ?? (deal.watch === "budapest" ? "50" : "100"));
    const next = Number(deal.priceIls ?? deal.priceUsd);
    const prevPrice = Number(prev.priceIls ?? prev.priceUsd);
    return next <= prevPrice - dropIls;
  }

  return false;
}

function markDealSeen(deal) {
  seenDeals.set(dealFingerprint(deal), {
    priceUsd: deal.priceUsd,
    priceIls: deal.priceIls ?? null,
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
  if (t.includes("בוט") && t.includes("מחפש")) return true;
  if (t.startsWith("בוט ") && t.includes("טיסות")) return true;
  return false;
}

function msgKeyString(key) {
  return `${key.remoteJid}:${key.id}:${key.fromMe}:${key.participant || ""}`;
}

function storeMessage(msg) {
  if (!msg?.key?.id || !msg.message) return;
  messageStore.set(msgKeyString(msg.key), msg.message);
  if (messageStore.size > 500) {
    const first = messageStore.keys().next().value;
    messageStore.delete(first);
  }
}

function isRecentMessage(msg) {
  const ts = Number(msg.messageTimestamp || 0);
  if (!ts) return false;
  const ms = ts > 1e12 ? ts : ts * 1000;
  return Date.now() - ms < 3 * 60_000;
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
  const inner =
    m.ephemeralMessage?.message ||
    m.viewOnceMessage?.message ||
    m.viewOnceMessageV2?.message ||
    m;
  return (
    inner.conversation ||
    inner.extendedTextMessage?.text ||
    inner.imageMessage?.caption ||
    inner.videoMessage?.caption ||
    inner.buttonsResponseMessage?.selectedDisplayText ||
    inner.listResponseMessage?.title ||
    inner.templateButtonReplyMessage?.selectedDisplayText ||
    ""
  );
}

let lastStatusCommandAt = 0;
const STATUS_COMMAND_COOLDOWN_MS = 12_000;

function buildStatusReply({ searching = false, personal = false } = {}) {
  const status = getSearchStatus();
  const thCfg = thailandWatchConfig();
  const budCfg = budapestWatchConfig();
  const ago = lastScanAt
    ? `${Math.max(1, Math.round((Date.now() - lastScanAt) / 60_000))} דק׳`
    : "עדיין לא";
  const th = status.thailand;
  const bud = status.budapest;
  return [
    whatsappConnected ? "כן ✅ *מחפש*" : "⏳ *מתחבר…*",
    personal ? "🔔 *בוט אישי* — התראות רק אליך" : "",
    "",
    "🇹🇭 *תאילנד* · אמירטס · מזוודה",
    `תאריכים: *${formatDate(thCfg.outbound)} – ${formatDate(thCfg.returnDate)}*`,
    `לו״ז: *יציאה ${thCfg.outboundDep}→${thCfg.outboundArr}* · *חזרה בלילה*`,
    th?.lowestIls != null
      ? `מחיר: *₪${th.lowestIls}*`
      : "עדיין אין מחיר תאילנד",
    "",
    "🇭🇺 *בודפשט*",
    `תאריכים: *${formatDate(budCfg.outbound)} – ${formatDate(budCfg.returnDate)}*`,
    bud?.lowestIls != null
      ? `מחיר: *₪${bud.lowestIls}*${bud.airlineLabelHe ? ` · ${bud.airlineLabelHe}` : ""}`
      : "עדיין אין מחיר בודפשט",
    "",
    `סריקה אחרונה: ${ago}`,
    searching || scanRunning
      ? "🔄 *מריץ חיפוש עכשיו ב-Google Flights…*"
      : personal
        ? "כתוב שוב *מחפש* או *סטטוס* לעדכון."
        : "כתבו שוב *בוט מחפש* לעדכון מחיר.",
  ]
    .filter(Boolean)
    .join("\n");
}

function pickWatchDeals(deals = null, watchesFilter = null) {
  const fromScan = Array.isArray(deals) ? deals : [];
  const byWatch = new Map();
  for (const deal of fromScan) {
    if (!deal?.watch) continue;
    const prev = byWatch.get(deal.watch);
    if (
      !prev ||
      Number(deal.priceIls ?? deal.priceUsd) < Number(prev.priceIls ?? prev.priceUsd)
    ) {
      byWatch.set(deal.watch, deal);
    }
  }
  for (const deal of getCachedWatchDeals()) {
    if (!byWatch.has(deal.watch)) byWatch.set(deal.watch, deal);
  }
  const order = Array.isArray(watchesFilter) && watchesFilter.length
    ? watchesFilter
    : DEFAULT_WATCHES;
  return order.map((w) => byWatch.get(w)).filter(Boolean);
}

async function sendCurrentDealResult(chatId, deals = null, watchesFilter = null) {
  if (!sock || !chatId) return false;
  const watchDeals = pickWatchDeals(deals, watchesFilter);
  if (!watchDeals.length) {
    await sock.sendMessage(chatId, {
      text: watchesFilter?.length
        ? `🔎 *תוצאת חיפוש*\nלא נמצאו כרגע טיסות ל־${formatWatchesHe(watchesFilter)}.`
        : "🔎 *תוצאת חיפוש*\nלא נמצאו כרגע טיסות במעקבים הקבועים.",
    });
    return false;
  }

  try {
    for (const deal of watchDeals) {
      const caption = ["🔎 *תוצאת חיפוש עכשיו*", "", formatDealMessage(deal)].join(
        "\n",
      );
      await sock.sendMessage(chatId, { text: caption });
      log.info(
        { priceIls: deal.priceIls, watch: deal.watch, chatId },
        "Sent current deal result",
      );
      await sleep(350);
    }
    return true;
  } catch (error) {
    log.warn({ error }, "Failed to send current deal result");
    return false;
  }
}

async function runStatusSearch(chatId, watchesFilter = null) {
  const personal = Boolean(chatId && !String(chatId).endsWith("@g.us"));
  try {
    await sock.sendMessage(chatId, {
      text: buildStatusReply({ searching: true, personal }),
    });
  } catch (error) {
    log.warn({ error }, "Failed to send status ack");
  }

  try {
    // Wait for any in-flight cron scan, then always run a fresh status search.
    for (let i = 0; i < 120 && scanRunning; i += 1) {
      await sleep(500);
    }
    const deals = await runScan({
      forceRefresh: true,
      reason: "status-command",
      reportCurrent: true,
    });
    await sendCurrentDealResult(chatId, deals, watchesFilter);
  } catch (error) {
    log.warn({ error }, "Status-triggered scan failed");
    try {
      await sock.sendMessage(chatId, {
        text: "⚠️ החיפוש נכשל כרגע. נסו שוב בעוד דקה.",
      });
    } catch {
      // ignore
    }
  }
}

async function processTriggerFile() {
  if (!existsSync(TRIGGER_FILE) || !sock || !groupJid) return;
  try {
    const raw = JSON.parse(await readFile(TRIGGER_FILE, "utf8"));
    await unlink(TRIGGER_FILE);
    if (raw.action === "status") {
      log.info("Queued status search from trigger file");
      await runStatusSearch(groupJid);
      return;
    }
    const text =
      raw.text ||
      "✅ *הודעת בדיקה*\n\nהבוט פעיל ומחובר.";
    await sendToGroup(text);
    log.info("Sent queued test message");
  } catch (error) {
    log.warn({ error }, "Failed to process test trigger");
  }
}

function startTriggerWatcher() {
  setInterval(() => {
    processTriggerFile().catch((error) => {
      log.warn({ error }, "Trigger watcher error");
    });
  }, 5_000);
}

async function isTargetGroup(chatId) {
  if (!chatId?.endsWith("@g.us")) return false;
  if (groupJid) return sameChatId(chatId, groupJid);
  if (!cfg.groupName || !sock) return false;
  try {
    const meta = await sock.groupMetadata(chatId.split(":")[0]);
    return String(meta?.subject ?? "").trim() === cfg.groupName.trim();
  } catch {
    return false;
  }
}

async function handlePersonalDm(chatId, body, pushName) {
  const cmd = parsePersonalCommand(body);
  if (!cmd) {
    await sendChat(
      chatId,
      "לא הבנתי 🙂\nכתוב *עזרה* לתפריט, או *התחל* להצטרף למעקב.",
    );
    return;
  }

  if (cmd.type === "help") {
    await sendChat(chatId, personalHelpText());
    return;
  }

  if (cmd.type === "start") {
    const user = await upsertPersonalUser(chatId, {
      active: true,
      pushName: pushName || null,
    });
    await sendChat(
      chatId,
      [
        "✅ *נרשמת למעקב אישי!*",
        "",
        personalStatusText(user, getSearchStatus()),
        "",
        "בחירת יעד: *רק תאילנד* / *רק בודפשט* / *הכל*",
        "כשמחיר טוב יופיע — אשלח *רק אליך*.",
      ].join("\n"),
    );
    // Immediate personal search
    runStatusSearch(chatId, user.watches).catch((error) => {
      log.warn({ error }, "Personal start search failed");
    });
    return;
  }

  if (cmd.type === "stop") {
    await upsertPersonalUser(chatId, { active: false });
    await sendChat(chatId, "🛑 המעקב האישי הופסק.\nכתוב *התחל* כדי לחזור.");
    return;
  }

  if (cmd.type === "set-watches") {
    const user = await upsertPersonalUser(chatId, {
      active: true,
      pushName: pushName || null,
      watches: cmd.watches,
    });
    await sendChat(
      chatId,
      [
        `✅ היעדים עודכנו: *${formatWatchesHe(user.watches)}*`,
        "",
        personalStatusText(user, getSearchStatus()),
        "",
        "מכאן אשלח התראות *רק* על היעדים שבחרת.",
      ].join("\n"),
    );
    runStatusSearch(chatId, user.watches).catch((error) => {
      log.warn({ error }, "Personal watch-change search failed");
    });
    return;
  }

  if (cmd.type === "watches") {
    const user = getPersonalUser(chatId);
    if (!user?.active) {
      await sendChat(
        chatId,
        "עוד לא נרשמת.\nכתוב *התחל*, ואז *רק תאילנד* / *רק בודפשט* / *הכל*.",
      );
      return;
    }
    await sendChat(
      chatId,
      [
        `📍 היעדים שלך עכשיו: *${formatWatchesHe(user.watches)}*`,
        "",
        "לבחירה מחדש:",
        "• *רק תאילנד*",
        "• *רק בודפשט*",
        "• *הכל*",
      ].join("\n"),
    );
    return;
  }

  if (cmd.type === "budget") {
    const maxPriceIls = Math.max(500, Math.min(20000, Number(cmd.maxPriceIls)));
    const user = await upsertPersonalUser(chatId, {
      active: true,
      maxPriceIls,
    });
    await sendChat(
      chatId,
      `✅ עודכן תקציב ל־*₪${Math.round(maxPriceIls)}*\n\n${personalStatusText(user, getSearchStatus())}`,
    );
    return;
  }

  if (cmd.type === "status") {
    const user = getPersonalUser(chatId);
    if (!user?.active) {
      await sendChat(
        chatId,
        "עוד לא נרשמת.\nכתוב *התחל* כדי לקבל התראות אישיות.",
      );
      return;
    }
    await sendChat(chatId, personalStatusText(user, getSearchStatus()));
    runStatusSearch(chatId, user.watches).catch((error) => {
      log.warn({ error }, "Personal status search failed");
    });
  }
}

async function handleIncomingMessage(msg, upsertType = "notify") {
  try {
    if (msg.key?.fromMe) return;
    if (rememberHandledMessage(msg)) return;

    const chatId = msg.key?.remoteJid;
    if (!chatId) return;

    if (!msg.message) {
      if (msg.messageStubType != null && chatId.endsWith("@g.us")) {
        log.warn(
          { chatId, stub: msg.messageStubType, upsertType },
          "Group message could not be decrypted — run npm run flight-deals:repair-auth",
        );
      }
      return;
    }

    storeMessage(msg);

    // Only live notifies for commands. Append after reconnect is usually history.
    if (upsertType !== "notify") return;

    const body = extractMessageText(msg);
    if (!body) return;

    const isGroup = chatId.endsWith("@g.us");

    // Private personal bot (DM)
    if (!isGroup) {
      log.info({ from: chatId, body }, "Personal DM received");
      await handlePersonalDm(chatId, body, msg.pushName);
      return;
    }

    if (!(await isTargetGroup(chatId))) {
      if (/בוט/.test(body)) {
        log.info({ chatId, expected: groupJid, body }, "Ignored bot message from other group");
      }
      return;
    }

    if (!groupJid && isGroup) {
      groupJid = chatId.split(":")[0];
      await saveState();
      log.info({ groupJid }, "Learned group JID from incoming message");
    }

    if (!isStatusCheckCommand(body)) return;

    const now = Date.now();
    if (now - lastStatusCommandAt < STATUS_COMMAND_COOLDOWN_MS) {
      log.info({ body }, "Status command cooldown — skipping duplicate");
      return;
    }
    lastStatusCommandAt = now;

    log.info({ from: chatId, body, upsertType }, "Status command received");
    runStatusSearch(chatId).catch((error) => {
      log.warn({ error }, "Status search failed");
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
  if (groupJid || !cfg.groupName || groupPollTimer) return;

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
        "מחפש *רק* טיסות תאילנד באמירטס *עם מזוודה כלולה*.",
        "לו״ז: יציאה *15:10→07:35* · חזרה *בלילה*.",
        "תאריכים קבועים: 10/02/2027–10/03/2027.",
        "כתבו *בוט מחפש* או *בוט מחפש?* לסטטוס וחיפוש מיידי.",
        "כשהמחיר יירד — אשלח לכאן.",
        cfg.demoMode ? "\n_מצב דמו פעיל._" : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    welcomeSent = true;
    await saveState();
  }

  await processTriggerFile();

  if (!startupScanDone) {
    startupScanDone = true;
    await runScan({ forceRefresh: true, reason: "group-ready" });
  }
}

async function runScan({
  forceRefresh = false,
  reason = "cron",
  reportCurrent = false,
} = {}) {
  if (!groupJid) {
    log.info("No group yet — skipping scan");
    return [];
  }

  if (scanRunning) {
    if (reason === "status-command" || reportCurrent) {
      log.info("Waiting for in-flight scan before status refresh");
      for (let i = 0; i < 120 && scanRunning; i += 1) {
        await sleep(500);
      }
      if (scanRunning) {
        return getCachedWatchDeals();
      }
    } else {
      if (forceRefresh) scanQueued = true;
      log.info("Scan already running — %s", scanQueued ? "queued follow-up" : "skipping");
      return getCachedWatchDeals();
    }
  }

  if (!resolveProvider()) {
    log.warn("No flight provider configured");
    return [];
  }

  scanRunning = true;
  let deals = [];

  try {
    const shouldForce =
      forceRefresh ||
      (Date.now() - lastForceRefreshAt > 90 * 60_000 &&
        lastScanFound > 0 &&
        lastScanSent === 0 &&
        Date.now() - lastScanAt > 8 * 60_000);

    if (shouldForce) lastForceRefreshAt = Date.now();

    log.info(
      "Scanning permanent watches Thailand+Budapest (%s%s)",
      reason,
      shouldForce ? ", force-refresh" : "",
    );
    deals = await fetchDeals({ forceRefresh: shouldForce });
    lastScanFound = deals.length;
    log.info(
      "Found %d watch options (TH=%d BUD=%d)",
      deals.length,
      deals.filter((d) => d.watch === "thailand").length,
      deals.filter((d) => d.watch === "budapest").length,
    );

    let sent = 0;
    // Cron: alert group + personal DMs on new/drop.
    // Status command reports the result to the requester separately.
    if (!reportCurrent) {
      for (const deal of deals) {
        const personalSent = await notifyPersonalSubscribers(deal);
        sent += personalSent;

        if (!shouldNotifyDeal(deal)) continue;
        markDealSeen(deal);
        const ok = await sendToGroup(deal);
        if (ok) {
          sent += 1;
          log.info({ deal: deal.id, watch: deal.watch }, "Sent deal to group");
        }
      }
    } else {
      const tops = pickWatchDeals(deals);
      for (const deal of tops) {
        const prev = seenDeals.get(dealFingerprint(deal));
        if (!prev) markDealSeen(deal);
        else if (
          Number.isFinite(deal.priceIls) &&
          Number.isFinite(prev.priceIls) &&
          deal.priceIls < prev.priceIls
        ) {
          markDealSeen(deal);
        }
        sent += await notifyPersonalSubscribers(deal);
      }
    }

    lastScanSent = sent;
    lastScanAt = Date.now();
    await saveSeen();
    log.info("Scan done — %d new alert messages sent", sent);
  } catch (error) {
    log.error({ error }, "Scan failed");
  } finally {
    scanRunning = false;
    if (scanQueued) {
      scanQueued = false;
      setTimeout(() => {
        runScan({ forceRefresh: true, reason: "queued" }).catch((error) => {
          log.warn({ error }, "Queued scan failed");
        });
      }, 1_000);
    }
  }

  return deals;
}

function normalizeWhatsAppPhone(raw) {
  let phone = String(raw ?? "").replace(/\D/g, "");
  // Israeli local 05xxxxxxxx → 9725xxxxxxxx
  if (phone.startsWith("0") && phone.length >= 9) {
    phone = `972${phone.slice(1)}`;
  }
  return phone;
}

function printPairingInstructions(code, phone) {
  console.log("\n════════════════════════════════════════");
  console.log("🔑 חיבור בלי QR — קוד בלבד");
  console.log("════════════════════════════════════════");
  console.log(`חשבון: ${phone}`);
  console.log(`קוד:   ${code}`);
  console.log("");
  console.log("בטלפון (0549676816):");
  console.log("1. WhatsApp → הגדרות → מכשירים מקושרים");
  console.log("2. מחק מכשירים ישנים של הבוט");
  console.log("3. קשר מכשיר → מופיע QR");
  console.log("4. למטה לחץ: קישור באמצעות מספר טלפון במקום");
  console.log(`5. הזן רק את הקוד: ${code}  (8 תווים, אותיות+מספרים)`);
  console.log("");
  console.log("⚠️ אל תחכה — הקוד תקף דקות ספורות בלבד");
  console.log("⚠️ אם אין כפתור 'מספר טלפון במקום' — חייבים QR ממסך אחר");
  console.log("════════════════════════════════════════\n");
}

async function startPairingCodeFlow(activeSock, phone, creds) {
  if (creds?.registered || !phone) return;

  if (pairingStarted && creds?.pairingCode) {
    printPairingInstructions(creds.pairingCode, phone);
    return;
  }

  pairingStarted = true;
  try {
    const code =
      creds?.pairingCode || (await activeSock.requestPairingCode(phone));
    printPairingInstructions(code, phone);
  } catch (error) {
    pairingStarted = false;
    log.warn({ error }, "Pairing code request failed");
    console.error("❌ לא הצלחתי ליצור קוד — בדוק ש-WHATSAPP_PHONE מוגדר נכון");
  }
}

function scheduleReconnect(delayMs = 8_000) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWhatsApp().catch((error) => {
      log.error({ error }, "Reconnect failed");
      scheduleReconnect(12_000);
    });
  }, delayMs);
}

async function connectWhatsApp() {
  if (connecting) {
    log.info("WhatsApp connect already in progress");
    return;
  }
  connecting = true;
  const generation = ++connectGeneration;

  await mkdir(AUTH_DIR, { recursive: true });

  if (sock) {
    try {
      sock.ev.removeAllListeners();
      sock.end(undefined);
    } catch {
      // ignore
    }
    sock = null;
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();
    const pairingOnly = process.env.FLIGHT_DEALS_PAIRING_ONLY === "true";
    const phone = normalizeWhatsAppPhone(
      process.env.WHATSAPP_PAIR_PHONE || process.env.WHATSAPP_PHONE,
    );
    const silent = pino({ level: "silent" });
    const retryCache = {
      _data: new Map(),
      get: (key) => retryCache._data.get(key),
      set: (key, value) => retryCache._data.set(key, value),
      del: (key) => retryCache._data.delete(key),
    };

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, silent),
      },
      browser: Browsers.ubuntu("Chrome"),
      logger: silent,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      emitOwnEvents: false,
      // Needed so group sender keys distribute; history sync stays off.
      fireInitQueries: true,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      maxMsgRetryCount: 5,
      msgRetryCounterCache: retryCache,
      getMessage: async (key) => messageStore.get(msgKeyString(key)),
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (generation !== connectGeneration) return;
      for (const msg of messages) {
        try {
          await handleIncomingMessage(msg, type);
        } catch (error) {
          log.warn({ error }, "Message handler error");
        }
      }
    });

    if (pairingOnly && !state.creds.registered && phone) {
      setTimeout(() => {
        if (generation !== connectGeneration) return;
        startPairingCodeFlow(sock, phone, state.creds).catch((error) => {
          log.warn({ error }, "Pairing flow failed");
        });
      }, 3_000);
    }

    sock.ev.on("connection.update", async (update) => {
      if (generation !== connectGeneration) return;
      const { connection, lastDisconnect, qr } = update;

      if (qr && !pairingOnly) {
        const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qr)}`;
        try {
          await writeFile(path.join(__dirname, "qr-link.txt"), `${qrLink}\n`);
        } catch {
          // ignore
        }
        console.log("\n════════════════════════════════════════");
        console.log("📱 פתח את הקישור במחשב / טאבלט וסרוק מהטלפון:");
        console.log(qrLink);
        console.log("════════════════════════════════════════\n");
        console.log("בטלפון: WhatsApp → הגדרות → מכשירים מקושרים → קשר מכשיר → סרוק\n");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "open") {
        whatsappConnected = true;
        reconnectFailures = 0;
        connecting = false;
        if (pairingRefreshTimer) {
          clearInterval(pairingRefreshTimer);
          pairingRefreshTimer = null;
        }
        console.log("\n✅ WhatsApp מחובר בהצלחה!\n");
        log.info("WhatsApp connected");
        if (groupJid) {
          onGroupReady().catch((error) => {
            log.warn({ error }, "onGroupReady failed");
          });
        } else if (cfg.groupName) {
          resolveGroupByName().then((found) => {
            if (found) {
              onGroupReady().catch((error) => {
                log.warn({ error }, "onGroupReady failed");
              });
            } else {
              startGroupPolling();
            }
          });
        } else {
          console.error("❌ הגדר WHATSAPP_GROUP_NAME או WHATSAPP_GROUP_CHAT_ID");
        }
      }

      if (connection === "close") {
        whatsappConnected = false;
        connecting = false;
        const status = lastDisconnect?.error?.output?.statusCode;
        const awaitingPairing =
          pairingOnly && sock?.authState?.creds && !sock.authState.creds.registered;
        log.warn({ status, awaitingPairing }, "WhatsApp disconnected");

        if (status === DisconnectReason.loggedOut) {
          console.error("❌ WhatsApp התנתק לצמיתות (logged out). הריצו: npm run flight-deals:relink");
          process.exit(1);
        }
        if (awaitingPairing) return;

        reconnectFailures += 1;
        if (reconnectFailures >= 8) {
          console.error("❌ יותר מדי ניסיונות חיבור שנכשלו. יוצא.");
          process.exit(1);
        }
        scheduleReconnect(Math.min(30_000, 5_000 + reconnectFailures * 2_000));
      }
    });
  } catch (error) {
    connecting = false;
    throw error;
  }
}

async function main() {
  acquireInstanceLock();

  process.on("uncaughtException", (error) => {
    log.error({ error }, "uncaughtException — keeping bot alive");
  });
  process.on("unhandledRejection", (error) => {
    log.error({ error }, "unhandledRejection — keeping bot alive");
  });

  await loadEnvFile();
  cfg = envConfig();
  groupJid = cfg.groupJidEnv;

  if (!cfg.groupJidEnv && !cfg.groupName) {
    console.error("❌ הגדר WHATSAPP_GROUP_CHAT_ID או WHATSAPP_GROUP_NAME");
    process.exit(1);
  }

  if (!resolveProvider()) {
    console.error("❌ חסר SERPAPI_API_KEY (או FLIGHT_DEALS_DEMO=true)");
    process.exit(1);
  }

  await loadSeen();
  await loadState();
  await loadPersonalUsers();
  // Prefer pinned group JID from env/state — never guess from random groups.
  if (!groupJid && cfg.groupJidEnv) groupJid = cfg.groupJidEnv;
  startTriggerWatcher();
  await connectWhatsApp();

  cron.schedule(cfg.cronExpr, () => {
    log.info("Cron triggered (%s)", cfg.cronExpr);
    runScan({ reason: "cron" }).catch((error) => {
      log.warn({ error }, "Cron scan failed");
    });
  });

  setInterval(() => {
    log.info(
      { connected: whatsappConnected, groupJid: groupJid || null },
      "Bot heartbeat",
    );
  }, 30 * 60_000);

  const bud = budapestWatchConfig();
  log.info(
    "Watches ready — Thailand + Budapest %s→%s | cron %s | group %s",
    bud.outbound,
    bud.returnDate,
    cfg.cronExpr,
    groupJid || cfg.groupName || "?",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
