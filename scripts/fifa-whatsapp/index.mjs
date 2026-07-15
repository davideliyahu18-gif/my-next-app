#!/usr/bin/env node
/**
 * FIFA World Cup WhatsApp remote-control bot (Baileys).
 *
 * - Auto-finds the WhatsApp group by WHATSAPP_GROUP_NAME
 * - Remote commands in the group: תוצאה / מחר / הרכב / מלך שערים / לוח / סטטוס / עזרה
 * - Polls /api/cron/fifa-bot?dry=1 and posts alerts (goal / FT / reminder)
 *
 * Requires NEXT.js app reachable at FIFA_BOT_SITE_URL (default http://127.0.0.1:3000).
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
    groupJidEnv: process.env.WHATSAPP_GROUP_CHAT_ID ?? "",
    groupName:
      process.env.FIFA_WHATSAPP_GROUP_NAME ||
      process.env.WHATSAPP_GROUP_NAME ||
      "מונדיאל",
    pollCron: process.env.FIFA_BOT_POLL_CRON ?? "*/1 * * * *",
    alertsEnabled: process.env.FIFA_BOT_ALERTS !== "false",
  };
}

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

let sock = null;
let groupJid = "";
let groupPollTimer = null;
let welcomeSent = false;
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
  if (state.groupJid && !groupJid) groupJid = state.groupJid;
  welcomeSent = Boolean(state.welcomeSent);
}

async function saveState() {
  await writeFile(
    STATE_FILE,
    JSON.stringify({ groupJid, welcomeSent }, null, 2),
    "utf8",
  );
}

function sameChatId(a, b) {
  if (!a || !b) return false;
  return String(a).split("@")[0] === String(b).split("@")[0];
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

async function sendToGroup(text) {
  if (!sock || !groupJid) return false;
  await sock.sendMessage(groupJid, { text });
  return true;
}

async function resolveGroupByName() {
  if (!sock) return false;
  if (cfg.groupJidEnv) {
    groupJid = cfg.groupJidEnv;
    await saveState();
    return true;
  }
  if (groupJid) return true;

  try {
    const groups = await sock.groupFetchAllParticipating();
    const wanted = cfg.groupName.trim().toLowerCase();
    for (const [jid, meta] of Object.entries(groups)) {
      const subject = String(meta.subject || "").toLowerCase();
      if (subject.includes(wanted) || wanted.includes(subject)) {
        groupJid = jid;
        await saveState();
        log.info({ jid, subject: meta.subject }, "Resolved WhatsApp group");
        return true;
      }
    }
  } catch (error) {
    log.warn({ error }, "groupFetchAllParticipating failed");
  }
  return false;
}

async function handleIncomingMessage(msg) {
  try {
    if (msg.key.fromMe) return;
    const chatId = msg.key.remoteJid;
    if (!chatId) return;

    const isGroup = chatId.endsWith("@g.us");
    if (groupJid && isGroup && !sameChatId(chatId, groupJid)) return;

    const body = extractText(msg).trim();
    if (!body || !looksLikeRemoteCommand(body)) return;

    if (!groupJid && isGroup) {
      groupJid = chatId;
      await saveState();
    }

    log.info({ from: chatId, body }, "Remote command received");
    await sendToGroup("⏳ רגע, בודק…");

    try {
      const reply = await runRemoteCommand(body);
      await sendToGroup(reply);
    } catch (error) {
      log.warn({ error }, "Command API failed");
      await sendToGroup(
        "⚠️ לא הצלחתי לדבר עם שרת האתר.\nבדקו ש-`npm run dev` רץ ו־FIFA_BOT_SITE_URL נכון.",
      );
    }
  } catch (error) {
    log.warn({ error }, "Failed to handle incoming message");
  }
}

async function pollAlerts() {
  if (!cfg.alertsEnabled) return;
  if (!sock || !groupJid || pollRunning) return;
  pollRunning = true;
  try {
    const summary = await apiFetch("/api/cron/fifa-bot?dry=1", {
      method: "GET",
    });
    const alerts = Array.isArray(summary.alerts) ? summary.alerts : [];
    for (const alert of alerts) {
      if (alert?.text) await sendToGroup(alert.text);
    }
    if (alerts.length) {
      log.info({ count: alerts.length }, "Posted FIFA alerts to WhatsApp");
    }
  } catch (error) {
    log.warn({ error: String(error.message || error) }, "Alert poll failed");
  } finally {
    pollRunning = false;
  }
}

async function onConnected() {
  console.log("\n✅ מחובר לוואטסאפ.");
  console.log(`   מחפש קבוצה עם השם: "${cfg.groupName}"`);
  console.log("   הוסיפו את המספר המקושר לקבוצה.\n");

  groupPollTimer = setInterval(async () => {
    const found = await resolveGroupByName();
    if (!found) return;
    clearInterval(groupPollTimer);
    groupPollTimer = null;

    if (!welcomeSent) {
      welcomeSent = true;
      await saveState();
      await sendToGroup(
        [
          "✅ *בוט מונדיאל מחובר!*",
          "",
          "שלט רחוק מהקבוצה:",
          "• *תוצאה* · *מחר* · *לוח*",
          "• *הרכב* · *מלך שערים*",
          "• *סטטוס* / *עזרה*",
          "",
          "אשלח גם התראות על שערים, סיום ותזכורת 30 דק׳ לפני.",
        ].join("\n"),
      );
    }

    pollAlerts().catch(() => {});
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
  if (cfg.groupJidEnv) groupJid = cfg.groupJidEnv;

  console.log("⚽ בוט מונדיאל — שלט רחוק בוואטסאפ");
  console.log(`   Site API: ${cfg.siteUrl}`);
  console.log(`   Group name filter: ${cfg.groupName}`);
  console.log(`   Alerts: ${cfg.alertsEnabled ? "on" : "off"}`);
  console.log("");

  await startSocket();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
