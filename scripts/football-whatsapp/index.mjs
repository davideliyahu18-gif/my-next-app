#!/usr/bin/env node
/**
 * Multi-league football WhatsApp bot (Baileys).
 *
 * 1) npm run football-bot:setup
 * 2) npm run football-bot:start  → scan QR
 * 3) Add the linked number to your WhatsApp group
 * 4) Bot sends alerts + answers commands in the group
 */

import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cron from "node-cron";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const AUTH_DIR = path.join(__dirname, "auth");
const STATE_FILE = path.join(__dirname, "bot-state.json");
const QR_FILE = path.join(__dirname, "qr.png");

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
}

function envConfig() {
  const site =
    process.env.FOOTBALL_BOT_SITE_URL ||
    process.env.FIFA_BOT_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://127.0.0.1:3000";
  const base = site.startsWith("http") ? site : `https://${site}`;

  return {
    siteUrl: base.replace(/\/$/, ""),
    secret:
      process.env.FOOTBALL_BOT_SECRET ||
      process.env.FIFA_BOT_SECRET ||
      process.env.FEED_API_SECRET ||
      process.env.CRON_SECRET ||
      "",
    groupJidEnv:
      process.env.FOOTBALL_WHATSAPP_CHAT_ID ||
      process.env.WHATSAPP_GROUP_CHAT_ID ||
      "",
    groupName:
      process.env.FOOTBALL_WHATSAPP_GROUP_NAME ||
      "דוד | עדכוני כדורגל",
    pollCron: process.env.FOOTBALL_BOT_POLL_CRON ?? "*/1 * * * *",
    morningCron: process.env.FOOTBALL_BOT_MORNING_CRON ?? "0 8 * * *",
    morningTimezone:
      process.env.FOOTBALL_BOT_MORNING_TZ ?? "Asia/Jerusalem",
    morningEnabled: process.env.FOOTBALL_BOT_MORNING !== "false",
    alertsEnabled: process.env.FOOTBALL_BOT_ALERTS !== "false",
  };
}

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

let sock = null;
let groupJid = "";
let groupPollTimer = null;
let welcomeSent = false;
let pollRunning = false;
let cfg = envConfig();
/** @type {Map<string, { intent: "schedule" | "lineup"; expiresAt: number }>} */
const pendingByChat = new Map();
const PENDING_TTL_MS = 5 * 60 * 1000;

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
  if (state.groupJid) groupJid = state.groupJid;
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
    "ליגות",
    "ליגה",
    "חי",
    "לייב",
    "פקודות",
    "אנגלית",
    "ספרדית",
    "ישראלית",
    "איטלקית",
    "הכל",
    "פרמייר",
    "סרייה",
    "סריה",
    "הרכב",
    "הרכבים",
    "lineup",
    "עקוב",
    "מעקב",
    "הסר",
    "follow",
    "watch",
    "ברצלונה",
    "בוקר",
    "morning",
  ];
  if (keys.some((k) => t === k || t.startsWith(`${k} `) || t.includes(k))) {
    return true;
  }
  // Menu picks: 0-4
  if (/^[0-4]$/.test(t.trim())) return true;
  return false;
}

function getPending(chatId) {
  const pending = pendingByChat.get(chatId);
  if (!pending) return null;
  if (Date.now() > pending.expiresAt) {
    pendingByChat.delete(chatId);
    return null;
  }
  return pending;
}

function setPending(chatId, intent) {
  pendingByChat.set(chatId, {
    intent,
    expiresAt: Date.now() + PENDING_TTL_MS,
  });
}

function clearPending(chatId) {
  pendingByChat.delete(chatId);
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
    throw err;
  }
  return json;
}

async function runRemoteCommand(text) {
  const result = await apiFetch("/api/football-bot/command", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  return {
    reply: result.reply || "אין תשובה מהשרת.",
    command: result.command || "",
  };
}

async function sendToGroup(text) {
  if (!sock || !groupJid) return false;
  await sock.sendMessage(groupJid, { text });
  return true;
}

function subjectMatches(subject, wanted) {
  const s = subject.toLowerCase();
  const w = wanted.toLowerCase().trim();
  if (!w) return false;
  if (s === w) return true;
  if (s.includes(w) || w.includes(s)) return true;
  if (w.includes("ליגות") && s.includes("ליגות")) return true;
  if (w.includes("כדורגל") && s.includes("כדורגל") && s.includes("ליגות")) {
    return true;
  }
  if (w.includes("football") && s.includes("football")) return true;
  return false;
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
    const all = await sock.groupFetchAllParticipating();
    for (const [jid, meta] of Object.entries(all)) {
      const subject = String(meta.subject || "");
      if (subjectMatches(subject, cfg.groupName)) {
        groupJid = jid;
        log.info({ jid, subject }, "Resolved WhatsApp football group");
        await saveState();
        return true;
      }
    }
  } catch (error) {
    log.warn({ error }, "groupFetchAllParticipating failed");
  }
  return Boolean(groupJid);
}

async function handleIncomingMessage(msg) {
  try {
    if (msg.key.fromMe) return;
    const chatId = msg.key.remoteJid;
    if (!chatId || !chatId.endsWith("@g.us")) return;

    const body = extractText(msg).trim();
    if (!body) return;

    const pending = getPending(chatId);
    const treatAsCommand =
      looksLikeRemoteCommand(body) || Boolean(pending);
    if (!treatAsCommand) return;

    if (groupJid && !sameChatId(chatId, groupJid)) return;

    if (!groupJid) {
      groupJid = chatId;
      await saveState();
    }

    let commandText = body;
    if (pending?.intent === "schedule") {
      const alreadySchedule = /^(לוח|לוז|לו״ז|schedule)\b/i.test(body.trim());
      if (!alreadySchedule) {
        commandText = `לוח ${body}`;
      }
    } else if (pending?.intent === "lineup") {
      const alreadyLineup = /^(הרכב|הרכבים|lineup|lineups)\b/i.test(body.trim());
      if (!alreadyLineup) {
        commandText = `הרכב ${body}`;
      }
    }

    log.info({ from: chatId, body, commandText }, "Remote command received");
    await sock.sendMessage(chatId, { text: "⏳ רגע, בודק…" });

    try {
      const { reply, command } = await runRemoteCommand(commandText);
      if (command === "schedule_menu") {
        setPending(chatId, "schedule");
      } else if (command === "lineup_menu") {
        setPending(chatId, "lineup");
      } else if (command === "schedule" || command === "lineup") {
        clearPending(chatId);
      } else if (command && command !== "unknown") {
        clearPending(chatId);
      }
      await sock.sendMessage(chatId, { text: reply });
    } catch (error) {
      log.warn({ error }, "Command API failed");
      await sock.sendMessage(chatId, {
        text: "⚠️ לא הצלחתי לדבר עם שרת האתר.\nבדקו ש-`npm run dev` רץ ו־FOOTBALL_BOT_SITE_URL נכון.",
      });
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
    const summary = await apiFetch("/api/cron/football-bot?dry=1", {
      method: "GET",
    });
    const alerts = Array.isArray(summary.alerts) ? summary.alerts : [];
    let posted = 0;
    for (const alert of alerts) {
      if (!alert?.text) continue;
      if (await sendToGroup(alert.text)) posted += 1;
    }
    if (alerts.length) {
      log.info(
        { alerts: alerts.length, sends: posted },
        "Posted football alerts to WhatsApp group",
      );
    }
  } catch (error) {
    log.warn({ error: String(error.message || error) }, "Alert poll failed");
  } finally {
    pollRunning = false;
  }
}

async function sendMorningStatus() {
  if (!cfg.morningEnabled) return;
  if (!sock || !groupJid) return;
  try {
    const { reply } = await runRemoteCommand("בוקר");
    if (reply) {
      await sendToGroup(reply);
      log.info("Sent morning football status to WhatsApp group");
    }
  } catch (error) {
    log.warn({ error: String(error.message || error) }, "Morning status failed");
  }
}

async function welcomeGroup() {
  if (welcomeSent || !groupJid) return;
  welcomeSent = true;
  await saveState();
  await sendToGroup(
    [
      "✅ *בוט כדורגל מחובר!*",
      "",
      "התראות ליגות + מעקב קבוצות.",
      "כל יום ב־08:00 — סטטוס בוקר עם משחקים קרובים ⚽️🔥",
      "",
      "שלט רחוק: *לוח* · *הרכב* · *מעקב* · *בוקר* · *עזרה*",
    ].join("\n"),
  );
}

async function saveQrPng(qr) {
  try {
    await QRCode.toFile(QR_FILE, qr, {
      width: 512,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
    console.log(`\n🖼️  קובץ ברקוד לשמירה/סריקה: ${QR_FILE}`);
  } catch (error) {
    log.warn({ error }, "Failed to write qr.png");
  }
}

async function onConnected() {
  console.log("\n✅ מחובר לוואטסאפ.");
  console.log(`   קבוצה: "${cfg.groupName}"`);
  console.log(
    `   בוקר 08:00 (${cfg.morningTimezone}): ${cfg.morningEnabled ? "on" : "off"}`,
  );
  console.log("   הוסיפו את המספר המקושר לקבוצה — ואז הבוט ישלח הודעת חיבור.\n");

  groupPollTimer = setInterval(async () => {
    await resolveGroupByName();
    if (groupJid) {
      await welcomeGroup();
      clearInterval(groupPollTimer);
      groupPollTimer = null;
      pollAlerts().catch(() => {});
    }
  }, 8_000);

  cron.schedule(cfg.pollCron, () => {
    pollAlerts().catch(() => {});
  });

  if (cfg.morningEnabled) {
    cron.schedule(
      cfg.morningCron,
      () => {
        sendMorningStatus().catch(() => {});
      },
      { timezone: cfg.morningTimezone },
    );
  }
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
      console.log("\n📷 סרקו את הברקוד עם WhatsApp → מכשירים מקושרים:\n");
      qrcodeTerminal.generate(qr, { small: true });
      await saveQrPng(qr);
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
        console.log(
          "התנתקתם מהמכשיר המקושר. מחקו את תיקיית auth וסרקו ברקוד מחדש.",
        );
      }
    }
  });
}

async function main() {
  await loadEnvFile();
  cfg = envConfig();
  await loadState();
  if (cfg.groupJidEnv) groupJid = cfg.groupJidEnv;

  console.log("⚽ בוט כדורגל — כל הליגות (FIFA)");
  console.log(`   Site API: ${cfg.siteUrl}`);
  console.log(`   Group: ${cfg.groupName}`);
  console.log(`   Alerts: ${cfg.alertsEnabled ? "on" : "off"}`);
  console.log("");

  await startSocket();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
