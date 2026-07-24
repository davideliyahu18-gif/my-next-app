#!/usr/bin/env node
/**
 * FIFA World Cup WhatsApp bot — two groups:
 *
 *  MAIN (LIVE): 🏆 דוד | עדכוני מונדיאל LIVE ⚽🔥
 *    → everything except corners
 *
 *  VIP: 🔥⚽ דוד VIP עדכוני מונדיאל
 *    → everything except open-play goals (שער / כובש)
 *
 * Remote commands work in both groups.
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
  for (const name of [".env.local", ".env"]) {
    const envPath = path.join(ROOT, name);
    if (!existsSync(envPath)) continue;
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
}

function envConfig() {
  const site =
    process.env.FIFA_BOT_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://127.0.0.1:3000";
  const base = site.startsWith("http") ? site : `https://${site}`;

  return {
    siteUrl: base.replace(/\/$/, ""),
    secret:
      process.env.FIFA_BOT_SECRET ||
      process.env.FEED_API_SECRET ||
      process.env.CRON_SECRET ||
      "",
    mainJidEnv:
      process.env.FIFA_WHATSAPP_MAIN_CHAT_ID ||
      process.env.WHATSAPP_GROUP_CHAT_ID ||
      "",
    vipJidEnv: process.env.FIFA_WHATSAPP_VIP_CHAT_ID || "",
    mainName:
      process.env.FIFA_WHATSAPP_MAIN_GROUP_NAME ||
      "דוד | עדכוני מונדיאל LIVE",
    vipName:
      process.env.FIFA_WHATSAPP_VIP_GROUP_NAME || "דוד VIP עדכוני מונדיאל",
    pollCron: process.env.FIFA_BOT_POLL_CRON ?? "*/1 * * * *",
    alertsEnabled: process.env.FIFA_BOT_ALERTS !== "false",
  };
}

/** MAIN = no corners. VIP = no open-play goals. */
function channelsForAlert(kind) {
  const channels = [];
  if (kind !== "corner") channels.push("main");
  if (kind !== "goal" && kind !== "goal_scorer") channels.push("vip");
  return channels;
}

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

let sock = null;
/** @type {{ main: string, vip: string }} */
let groups = { main: "", vip: "" };
let groupPollTimer = null;
let welcomeSent = { main: false, vip: false };
let pollRunning = false;
let cfg = envConfig();

async function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function loadState() {
  const state = await loadJson(STATE_FILE, {});
  if (state.mainJid) groups.main = state.mainJid;
  if (state.vipJid) groups.vip = state.vipJid;
  // Legacy single-group state
  if (state.groupJid && !groups.main) groups.main = state.groupJid;
  welcomeSent = {
    main: Boolean(state.welcomeMain ?? state.welcomeSent),
    vip: Boolean(state.welcomeVip),
  };
}

async function saveState() {
  await writeFile(
    STATE_FILE,
    JSON.stringify(
      {
        mainJid: groups.main,
        vipJid: groups.vip,
        welcomeMain: welcomeSent.main,
        welcomeVip: welcomeSent.vip,
      },
      null,
      2,
    ),
    "utf8",
  );
}

function sameChatId(a, b) {
  if (!a || !b) return false;
  return String(a).split("@")[0] === String(b).split("@")[0];
}

function knownGroupIds() {
  return [groups.main, groups.vip].filter(Boolean);
}

function channelForChatId(chatId) {
  if (groups.main && sameChatId(chatId, groups.main)) return "main";
  if (groups.vip && sameChatId(chatId, groups.vip)) return "vip";
  return null;
}

function extractText(msg) {
  const m = msg.message;
  if (!m) return "";
  if (typeof m.conversation === "string") return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return m.imageMessage.caption;
  if (m.videoMessage?.caption) return m.videoMessage.caption;
  return "";
}

function looksLikeRemoteCommand(raw) {
  const t = raw.trim().toLowerCase();
  if (!t) return false;
  const keys = [
    "עזרה",
    "help",
    "בוט",
    "סטטוס",
    "תוצאה",
    "תוצאות",
    "מחר",
    "לוח",
    "לוז",
    "לו״ז",
    "הרכב",
    "הרכבים",
    "מלך",
    "כובשים",
    "חי",
    "לייב",
    "פקודות",
  ];
  return keys.some((k) => t === k || t.startsWith(`${k} `) || t.includes(k));
}

async function apiFetch(pathname, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (cfg.secret) headers.Authorization = `Bearer ${cfg.secret}`;

  const response = await fetch(`${cfg.siteUrl}${pathname}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    const err = new Error(
      `API ${pathname} failed: ${response.status} ${text.slice(0, 200)}`,
    );
    err.status = response.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function runRemoteCommand(text) {
  const result = await apiFetch("/api/fifa-bot/command", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  return result.reply || "אין תשובה מהשרת.";
}

async function sendToJid(jid, text) {
  if (!sock || !jid) return false;
  await sock.sendMessage(jid, { text });
  return true;
}

async function sendToChannel(channel, text) {
  const jid = groups[channel];
  return sendToJid(jid, text);
}

async function sendAlert(alert) {
  const kind = alert?.kind || "unknown";
  const channels = channelsForAlert(kind);
  let sent = 0;
  for (const channel of channels) {
    if (await sendToChannel(channel, alert.text)) sent += 1;
  }
  return sent;
}

function subjectMatches(subject, wanted) {
  const s = subject.toLowerCase();
  const w = wanted.toLowerCase().trim();
  if (!w) return false;
  if (s.includes(w) || w.includes(s)) return true;
  // Loose token match (VIP / LIVE)
  if (w.includes("vip") && s.includes("vip")) return true;
  if (w.includes("live") && s.includes("live")) return true;
  return false;
}

async function resolveGroupsByName() {
  if (!sock) return false;

  if (cfg.mainJidEnv) groups.main = cfg.mainJidEnv;
  if (cfg.vipJidEnv) groups.vip = cfg.vipJidEnv;

  if (groups.main && groups.vip) {
    await saveState();
    return true;
  }

  try {
    const all = await sock.groupFetchAllParticipating();
    for (const [jid, meta] of Object.entries(all)) {
      const subject = String(meta.subject || "");
      if (!groups.main && subjectMatches(subject, cfg.mainName)) {
        groups.main = jid;
        log.info({ jid, subject }, "Resolved MAIN WhatsApp group");
      }
      if (!groups.vip && subjectMatches(subject, cfg.vipName)) {
        groups.vip = jid;
        log.info({ jid, subject }, "Resolved VIP WhatsApp group");
      }
    }
    await saveState();
  } catch (error) {
    log.warn({ error }, "groupFetchAllParticipating failed");
  }

  return Boolean(groups.main || groups.vip);
}

async function handleIncomingMessage(msg) {
  try {
    if (msg.key.fromMe) return;
    const chatId = msg.key.remoteJid;
    if (!chatId) return;

    const isGroup = chatId.endsWith("@g.us");
    if (!isGroup) return;

    const known = knownGroupIds();
    let channel = channelForChatId(chatId);

    if (known.length && !channel) return;

    const body = extractText(msg).trim();
    if (!body || !looksLikeRemoteCommand(body)) return;

    // Learn group if names not resolved yet
    if (!channel) {
      if (!groups.main) {
        groups.main = chatId;
        channel = "main";
      } else if (!groups.vip && !sameChatId(chatId, groups.main)) {
        groups.vip = chatId;
        channel = "vip";
      } else {
        return;
      }
      await saveState();
    }

    log.info({ from: chatId, channel, body }, "Remote command received");
    await sendToJid(chatId, "⏳ רגע, בודק…");

    try {
      const reply = await runRemoteCommand(body);
      await sendToJid(chatId, reply);
    } catch (error) {
      log.warn({ error }, "Command API failed");
      await sendToJid(
        chatId,
        "⚠️ לא הצלחתי לדבר עם שרת האתר.\nבדקו ש-`npm run dev` רץ ו־FIFA_BOT_SITE_URL נכון.",
      );
    }
  } catch (error) {
    log.warn({ error }, "Failed to handle incoming message");
  }
}

async function pollAlerts() {
  if (!cfg.alertsEnabled) return;
  if (!sock || (!groups.main && !groups.vip) || pollRunning) return;
  pollRunning = true;
  try {
    const summary = await apiFetch("/api/cron/fifa-bot?dry=1", {
      method: "GET",
    });
    const alerts = Array.isArray(summary.alerts) ? summary.alerts : [];
    let posted = 0;
    for (const alert of alerts) {
      if (!alert?.text) continue;
      posted += await sendAlert(alert);
    }
    if (alerts.length) {
      log.info(
        { alerts: alerts.length, sends: posted },
        "Posted FIFA alerts to WhatsApp channels",
      );
    }
  } catch (error) {
    log.warn({ error: String(error.message || error) }, "Alert poll failed");
  } finally {
    pollRunning = false;
  }
}

async function welcomeChannel(channel) {
  if (welcomeSent[channel] || !groups[channel]) return;
  welcomeSent[channel] = true;
  await saveState();

  const isVip = channel === "vip";
  await sendToChannel(
    channel,
    [
      isVip
        ? "✅ *בוט VIP מחובר!*"
        : "✅ *בוט LIVE מחובר!*",
      "",
      isVip
        ? "כאן: התראות בלי *שערים* (יש קרנות, מחצית, סיום, פנדלים…)"
        : "כאן: התראות מלאות בלי *קרנות*",
      "",
      "שלט רחוק: *תוצאה* · *מחר* · *לוח* · *הרכב* · *מלך שערים* · *עזרה*",
    ].join("\n"),
  );
}

async function onConnected() {
  console.log("\n✅ מחובר לוואטסאפ.");
  console.log(`   MAIN: "${cfg.mainName}"`);
  console.log(`   VIP:  "${cfg.vipName}"`);
  console.log("   הוסיפו את המספר המקושר לשתי הקבוצות.\n");

  groupPollTimer = setInterval(async () => {
    await resolveGroupsByName();
    if (groups.main) await welcomeChannel("main");
    if (groups.vip) await welcomeChannel("vip");

    if (groups.main && groups.vip) {
      clearInterval(groupPollTimer);
      groupPollTimer = null;
      pollAlerts().catch(() => {});
    }
  }, 10_000);

  cron.schedule(cfg.pollCron, () => {
    pollAlerts().catch(() => {});
  });
}

async function startSocket() {
  await mkdir(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" && type !== "append") return;
    for (const msg of messages) {
      await handleIncomingMessage(msg);
    }
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📷 סרקו את ה-QR עם WhatsApp → מכשירים מקושרים:\n");
      qrcode.generate(qr, { small: true });
      const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qr)}`;
      console.log(`\nאו פתחו במובייל: ${qrLink}\n`);
    }

    if (connection === "open") {
      await onConnected();
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      log.warn({ code }, "WhatsApp connection closed");
      if (shouldReconnect) {
        setTimeout(() => startSocket().catch(console.error), 2000);
      } else {
        console.log("התנתקתם מהמכשיר המקושר. מחקו את תיקיית auth וסרקו שוב.");
      }
    }
  });
}

async function main() {
  await loadEnvFile();
  cfg = envConfig();
  await loadState();
  if (cfg.mainJidEnv) groups.main = cfg.mainJidEnv;
  if (cfg.vipJidEnv) groups.vip = cfg.vipJidEnv;

  console.log("⚽ בוט מונדיאל — LIVE + VIP");
  console.log(`   Site API: ${cfg.siteUrl}`);
  console.log(`   MAIN (no corners): ${cfg.mainName}`);
  console.log(`   VIP  (no goals):   ${cfg.vipName}`);
  console.log(`   Alerts: ${cfg.alertsEnabled ? "on" : "off"}`);
  console.log("");

  await startSocket();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
