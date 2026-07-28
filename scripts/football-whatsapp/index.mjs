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
import { mkdir, readFile, writeFile, readdir, rename } from "node:fs/promises";
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
/** Drop JSON jobs here — processed by the RUNNING bot (never open a 2nd WA session). */
const OUTBOX_DIR = path.join(__dirname, "outbox");
const OUTBOX_DONE_DIR = path.join(OUTBOX_DIR, "done");
const OUTBOX_FAILED_DIR = path.join(OUTBOX_DIR, "failed");

const require = createRequire(import.meta.url);
const baileys = require("@whiskeysockets/baileys");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  generateWAMessageFromContent,
  proto,
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
    /** Hourly deep health check (WA probe + site API). Default: every hour. */
    hourlyCron: process.env.FOOTBALL_BOT_HOURLY_CRON ?? "0 * * * *",
    hourlyEnabled: process.env.FOOTBALL_BOT_HOURLY !== "false",
    /** Notify the group after auto-recovery from a drop. */
    notifyOnRecover: process.env.FOOTBALL_BOT_NOTIFY_RECOVER !== "false",
    alertsEnabled: process.env.FOOTBALL_BOT_ALERTS !== "false",
    buttonsEnabled: process.env.FOOTBALL_BOT_BUTTONS === "true",
    /** Allow the linked phone (e.g. 0523123944) to send commands — those arrive as fromMe. */
    allowFromMeCommands: process.env.FOOTBALL_BOT_ALLOW_FROM_ME !== "false",
    /** Optional allowlist. Empty = כל מי שבקבוצה. Example: 0523123944,05XXXXXXXX */
    operators: parseOperatorNumbers(
      process.env.FOOTBALL_BOT_OPERATORS || "",
    ),
    /** If true, only numbers in FOOTBALL_BOT_OPERATORS may run commands. Default: false = שני המספרים בקבוצה. */
    operatorsOnly: process.env.FOOTBALL_BOT_OPERATORS_ONLY === "true",
  };
}

/** Normalize Israeli / intl phone strings to digits (972…). */
function normalizePhoneDigits(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0") && digits.length >= 9) {
    return `972${digits.slice(1)}`;
  }
  if (digits.length === 9 && digits.startsWith("5")) {
    return `972${digits}`;
  }
  return digits;
}

function parseOperatorNumbers(raw) {
  return String(raw || "")
    .split(/[,;\s]+/)
    .map((part) => normalizePhoneDigits(part))
    .filter(Boolean);
}

function linkedAccountDigits() {
  const id = sock?.user?.id || "";
  // 972523123944:9@s.whatsapp.net → 972523123944
  const user = id.split(":")[0] || id.split("@")[0] || "";
  return normalizePhoneDigits(user);
}

function senderDigitsFromMessage(msg) {
  const participant = msg.key?.participant || msg.key?.participantPn || "";
  const remote = msg.key?.remoteJid || "";
  const raw = participant || (remote.endsWith("@s.whatsapp.net") ? remote : "");
  const user = String(raw).split(":")[0].split("@")[0];
  // LID participants won't normalize to phone — return as-is digits for lid match attempts
  return normalizePhoneDigits(user) || user.replace(/\D/g, "");
}

function isOperatorNumber(digits) {
  if (!digits) return false;
  const ops = cfg.operators || [];
  if (!ops.length) return true;
  return ops.some(
    (op) => digits === op || digits.endsWith(op) || op.endsWith(digits),
  );
}

/**
 * Strict command shape for fromMe (linked phone) — avoids loops on bot replies
 * that merely mention words like "לוח" inside longer text.
 */
function looksLikeOperatorCommand(raw) {
  const t = raw.trim().toLowerCase();
  if (!t || t.length > 100) return false;
  if (/^fb:(schedule|lineup|standings):/i.test(t)) return true;
  if (/^[0-5]$/.test(t)) return true;
  const prefixes = [
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
    "הרכב",
    "הרכבים",
    "lineup",
    "טבלה",
    "טבלת",
    "דירוג",
    "standings",
    "table",
    "סגל",
    "שחקנים",
    "רשימת",
    "roster",
    "squad",
    "עקוב",
    "מעקב",
    "הסר",
    "follow",
    "watch",
    "בוקר",
    "morning",
    "אנגלית",
    "ספרדית",
    "ישראלית",
    "איטלקית",
    "גרמנית",
    "בונדסליגה",
    "הכל",
    "פרמייר",
    "סרייה",
    "סריה",
    "ברצלונה",
  ];
  return prefixes.some((k) => t === k || t.startsWith(`${k} `));
}

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

let sock = null;
let groupJid = "";
let groupPollTimer = null;
let welcomeSent = false;
let pollRunning = false;
let cfg = envConfig();
let waConnected = false;
let reconnectAttempts = 0;
let reconnectTimer = null;
let startingSocket = false;
let cronsStarted = false;
let morningTask = null;
let pollTask = null;
let hourlyTask = null;
let watchdogTimer = null;
let outboxTimer = null;
let lastConnectionOpenAt = 0;
let lastSuccessfulSendAt = 0;
let lastWsActivityAt = 0;
/** After a detected failure, announce recovery once we're back. */
let pendingRecoverNotify = false;
let lastHealthFailureAt = 0;
let lastHealthFailureReason = "";
let lastHourlyCheckAt = 0;
let healthCheckRunning = false;
/** @type {Map<string, { intent: "schedule" | "lineup" | "standings"; expiresAt: number }>} */
const pendingByChat = new Map();
/** Prevent one hung chat command from stacking forever. */
const commandInFlight = new Set();
/** @type {Map<string, number>} */
const commandLockStartedAt = new Map();
const PENDING_TTL_MS = 5 * 60 * 1000;
const API_TIMEOUT_MS = 25_000;
const SEND_TIMEOUT_MS = 20_000;
const COMMAND_LOCK_TTL_MS = 20_000;
const MAX_RECONNECT_ATTEMPTS = 80;
const WATCHDOG_MS = 30_000;
/** Idle without traffic before considering a soft probe / reconnect. */
const STALE_CONNECTION_MS = 10 * 60_000;
const HEARTBEAT_FILE = path.join(__dirname, "heartbeat.json");
const HEARTBEAT_EVERY_MS = 10_000;
let heartbeatTimer = null;
let selfHealTimer = null;
let lastReconnectAt = 0;

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

/** Pull selected id from buttons / list / native-flow replies. */
function extractInteractiveId(msg) {
  const m = msg.message;
  if (!m) return "";

  const buttonsId = m.buttonsResponseMessage?.selectedButtonId;
  if (buttonsId) return String(buttonsId);

  const templateId = m.templateButtonReplyMessage?.selectedId;
  if (templateId) return String(templateId);

  const listId =
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.listResponseMessage?.title;
  if (listId) return String(listId);

  const paramsJson =
    m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  if (paramsJson) {
    try {
      const params = JSON.parse(paramsJson);
      const id =
        params.id ||
        params.selectedId ||
        params.row_id ||
        params.rowId ||
        "";
      if (id) return String(id);
    } catch {
      /* ignore */
    }
  }

  return "";
}

/** Map fb:schedule:eng.1 / fb:lineup:all → Hebrew command text. */
function commandFromInteractiveId(rawId) {
  const id = String(rawId || "").trim();
  const match = /^fb:(schedule|lineup|standings):(.+)$/i.exec(id);
  if (!match) return null;
  const intent = match[1].toLowerCase();
  const pick = match[2].trim();
  if (!pick) return null;
  const prefix =
    intent === "lineup" ? "הרכב" : intent === "standings" ? "טבלה" : "לוח";
  const arg = pick.toLowerCase() === "all" ? "הכל" : pick;
  return `${prefix} ${arg}`;
}

function looksLikeRemoteCommand(raw) {
  const t = raw.trim().toLowerCase();
  if (!t) return false;
  if (/^fb:(schedule|lineup|standings):/i.test(t)) return true;
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
    "גרמנית",
    "בונדסליגה",
    "הכל",
    "פרמייר",
    "סרייה",
    "סריה",
    "הרכב",
    "הרכבים",
    "lineup",
    "טבלה",
    "טבלת",
    "דירוג",
    "standings",
    "table",
    "סגל",
    "שחקנים",
    "רשימת",
    "roster",
    "squad",
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
  // Menu picks: 0-5 (all + 5 leagues)
  if (/^[0-5]$/.test(t.trim())) return true;
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

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timeout after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function apiFetch(pathname, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (cfg.secret) headers.Authorization = `Bearer ${cfg.secret}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${cfg.siteUrl}${pathname}`, {
      ...options,
      headers,
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
  }
}

async function runRemoteCommand(text) {
  const result = await apiFetch("/api/football-bot/command", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  return {
    reply: result.reply || "אין תשובה מהשרת.",
    command: result.command || "",
    interactive: result.interactive || null,
    media: result.media || null,
  };
}

async function safeSendMessage(chatId, content) {
  if (!sock || !waConnected) {
    throw new Error("WhatsApp not connected");
  }
  try {
    const result = await withTimeout(
      sock.sendMessage(chatId, content),
      SEND_TIMEOUT_MS,
      "sendMessage",
    );
    lastSuccessfulSendAt = Date.now();
    lastWsActivityAt = Date.now();
    return result;
  } catch (error) {
    // Send failures usually mean the socket is half-dead — heal immediately.
    log.warn(
      { error: String(error?.message || error), chatId },
      "sendMessage failed — scheduling fast reconnect",
    );
    waConnected = false;
    scheduleReconnect("send-fail", { immediate: true });
    throw error;
  }
}

async function sendToGroup(text) {
  if (!sock || !groupJid || !waConnected) return false;
  await safeSendMessage(groupJid, { text });
  return true;
}

async function ensureOutboxDirs() {
  await mkdir(OUTBOX_DIR, { recursive: true });
  await mkdir(OUTBOX_DONE_DIR, { recursive: true });
  await mkdir(OUTBOX_FAILED_DIR, { recursive: true });
}

/**
 * Process one outbox job without opening a second Baileys session.
 * Job JSON: { text?, caption?, imageBase64?, imagePath?, mime? }
 */
async function processOutboxJob(filePath) {
  const raw = await readFile(filePath, "utf8");
  const job = JSON.parse(raw);
  const base = path.basename(filePath);

  if (!sock || !groupJid || !waConnected) {
    throw new Error("WhatsApp not ready for outbox");
  }

  if (job.imageBase64 || job.imagePath) {
    const image = job.imageBase64
      ? Buffer.from(job.imageBase64, "base64")
      : await readFile(job.imagePath);
    await safeSendMessage(groupJid, {
      image,
      caption: String(job.caption || job.text || "").slice(0, 900),
      mimetype: job.mime || "image/png",
    });
  } else if (job.text) {
    await safeSendMessage(groupJid, { text: String(job.text) });
  } else {
    throw new Error("outbox job has no text/image");
  }

  const dest = path.join(OUTBOX_DONE_DIR, `${Date.now()}-${base}`);
  await rename(filePath, dest);
  log.info({ file: base }, "Outbox job sent");
}

async function drainOutbox() {
  if (!sock || !groupJid || !waConnected) return;
  try {
    await ensureOutboxDirs();
    const names = (await readdir(OUTBOX_DIR))
      .filter((name) => name.endsWith(".json"))
      .sort();
    for (const name of names) {
      const filePath = path.join(OUTBOX_DIR, name);
      try {
        await processOutboxJob(filePath);
      } catch (error) {
        log.warn(
          { file: name, error: String(error?.message || error) },
          "Outbox job failed",
        );
        try {
          const dest = path.join(
            OUTBOX_FAILED_DIR,
            `${Date.now()}-${name}`,
          );
          await rename(filePath, dest);
        } catch {
          /* ignore */
        }
      }
    }
  } catch (error) {
    log.warn(
      { error: String(error?.message || error) },
      "Outbox drain failed",
    );
  }
}

function startOutboxWatcher() {
  if (outboxTimer) return;
  outboxTimer = setInterval(() => {
    drainOutbox().catch(() => {});
  }, 3_000);
  if (typeof outboxTimer.unref === "function") outboxTimer.unref();
  drainOutbox().catch(() => {});
}

/**
 * Send WhatsApp native-flow single-select (league buttons).
 * Best-effort only — caller should already send the text menu.
 */
async function sendLeagueInteractive(chatId, interactive) {
  if (!sock || !interactive || !cfg.buttonsEnabled || !waConnected) {
    return false;
  }

  try {
    const rows = (interactive.options || []).map((option) => ({
      header: option.header || "",
      title: String(option.title || "").slice(0, 24),
      description: String(option.description || "").slice(0, 72),
      id: String(option.id || ""),
    }));

    if (!rows.length) return false;

    const nativeFlowMessage =
      proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: [
          {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: interactive.buttonText || "בחרו ליגה",
              sections: [
                {
                  title: interactive.sectionTitle || "ליגות",
                  rows,
                },
              ],
            }),
          },
        ],
      });

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      body: proto.Message.InteractiveMessage.Body.create({
        text: interactive.body || "בחרו ליגה 👇",
      }),
      footer: proto.Message.InteractiveMessage.Footer.create({
        text: interactive.footer || "דוד – עדכוני כדורגל ⚽",
      }),
      header: proto.Message.InteractiveMessage.Header.create({
        title: interactive.title || "ליגות",
        subtitle: "",
        hasMediaAttachment: false,
      }),
      nativeFlowMessage,
    });

    const content = {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
      },
      interactiveMessage,
    };

    const generated = generateWAMessageFromContent(chatId, content, {});
    await withTimeout(
      sock.relayMessage(chatId, generated.message, {
        messageId: generated.key.id,
        additionalNodes: [
          {
            tag: "biz",
            attrs: {},
            content: [
              {
                tag: "interactive",
                attrs: { type: "native_flow", v: "1" },
                content: [
                  {
                    tag: "native_flow",
                    attrs: { name: "mixed", v: "9" },
                  },
                ],
              },
            ],
          },
        ],
      }),
      8_000,
      "interactive relay",
    );

    log.info({ chatId, options: rows.length }, "Sent interactive league menu");
    return true;
  } catch (error) {
    log.warn(
      { error: String(error?.message || error) },
      "Interactive league menu skipped",
    );
    return false;
  }
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
  const chatId = msg.key?.remoteJid || "";
  const lockKey = `${chatId}:${msg.key?.id || Date.now()}`;
  try {
    if (!chatId || !chatId.endsWith("@g.us")) return;
    if (!waConnected || !sock) return;

    const interactiveId = extractInteractiveId(msg);
    const fromButton = commandFromInteractiveId(interactiveId);
    const body = (fromButton || extractText(msg)).trim();
    if (!body) return;

    const fromMe = Boolean(msg.key.fromMe);
    if (fromMe) {
      // Linked phone messages arrive as fromMe — allow short commands only.
      if (!cfg.allowFromMeCommands) return;
      if (!fromButton && !looksLikeOperatorCommand(body)) return;
      // Only enforce operator allowlist when operatorsOnly=true.
      if (cfg.operatorsOnly && cfg.operators?.length) {
        const linked = linkedAccountDigits();
        if (linked && !isOperatorNumber(linked)) return;
      }
    } else if (cfg.operatorsOnly && cfg.operators?.length) {
      const sender = senderDigitsFromMessage(msg);
      if (!isOperatorNumber(sender)) {
        log.info({ sender }, "Ignored command from non-operator");
        return;
      }
    }

    const pending = getPending(chatId);
    const treatAsCommand =
      Boolean(fromButton) ||
      looksLikeRemoteCommand(body) ||
      Boolean(pending);
    if (!treatAsCommand) return;

    if (groupJid && !sameChatId(chatId, groupJid)) return;

    if (!groupJid) {
      groupJid = chatId;
      await saveState();
    }

    // One command at a time per chat — but never block סטטוס/עזרה/בוט.
    const chatLock = `chat:${chatId}`;
    expireStaleCommandLocks();
    const isLightCommand =
      /^(סטטוס|בוט|status|עזרה|help|פקודות)$/i.test(body.trim());
    if (commandInFlight.has(chatLock) && !isLightCommand) {
      const started = commandLockStartedAt.get(chatLock) || 0;
      const heldFor = Date.now() - started;
      log.warn(
        { chatId, body, heldFor },
        "Skipping command — previous still in flight",
      );
      // If the previous command is already old, free the lock and continue.
      if (heldFor > 8_000) {
        commandInFlight.delete(chatLock);
        commandLockStartedAt.delete(chatLock);
      } else {
        try {
          await safeSendMessage(chatId, {
            text: "⏳ עוד רגע — מסיים את הבקשה הקודמת…",
          });
        } catch {
          /* ignore */
        }
        return;
      }
    }
    if (isLightCommand) {
      // Don't let a hung heavy command block health checks.
      commandInFlight.delete(chatLock);
      commandLockStartedAt.delete(chatLock);
    }
    commandInFlight.add(chatLock);
    commandInFlight.add(lockKey);
    commandLockStartedAt.set(chatLock, Date.now());
    commandLockStartedAt.set(lockKey, Date.now());

    let commandText = body;
    // If the user sends a full new command, don't wrap it with pending intent.
    const isFullScheduleCmd = /^(לוח|לוז|לו״ז|schedule)(?:\s|$)/i.test(body);
    const isFullLineupCmd = /^(הרכב|הרכבים|lineup|lineups)(?:\s|$)/i.test(body);
    const isFullStandingsCmd =
      /^(טבלה|טבלת|דירוג|standings|table)(?:\s|$)/i.test(body);
    const isOtherTopLevelCmd =
      /^(עזרה|help|בוט|סטטוס|תוצאה|תוצאות|מחר|ליגות|מעקב|עקוב|הסר|בוקר|morning|סגל|שחקנים|roster|squad)(?:\s|$)/i.test(
        body,
      );

    if (
      !fromButton &&
      pending?.intent === "schedule" &&
      !isFullScheduleCmd &&
      !isFullLineupCmd &&
      !isFullStandingsCmd &&
      !isOtherTopLevelCmd
    ) {
      commandText = `לוח ${body}`;
    } else if (
      !fromButton &&
      pending?.intent === "lineup" &&
      !isFullLineupCmd &&
      !isFullScheduleCmd &&
      !isFullStandingsCmd &&
      !isOtherTopLevelCmd
    ) {
      commandText = `הרכב ${body}`;
    } else if (
      !fromButton &&
      pending?.intent === "standings" &&
      !isFullStandingsCmd &&
      !isFullScheduleCmd &&
      !isFullLineupCmd &&
      !isOtherTopLevelCmd
    ) {
      commandText = `טבלה ${body}`;
    }

    log.info(
      {
        from: chatId,
        body,
        commandText,
        fromMe,
        interactiveId: interactiveId || null,
      },
      "Remote command received",
    );

    // Ack only for slower commands — menus answer instantly with text.
    const isLikelyMenu =
      /^(לוח|לוז|לו״ז|schedule|הרכב|הרכבים|lineup|lineups|טבלה|טבלת|דירוג|standings|table|סגל|שחקנים|roster|squad)$/i.test(
        commandText.trim(),
      );
    if (!isLikelyMenu) {
      try {
        await safeSendMessage(chatId, { text: "⏳ רגע, בודק…" });
      } catch (error) {
        log.warn(
          { error: String(error?.message || error) },
          "Ack send failed",
        );
      }
    }

    try {
      const { reply, command, interactive, media } = await withTimeout(
        runRemoteCommand(commandText),
        API_TIMEOUT_MS,
        "runRemoteCommand",
      );
      if (command === "schedule_menu") {
        setPending(chatId, "schedule");
      } else if (command === "lineup_menu") {
        setPending(chatId, "lineup");
      } else if (command === "standings_menu") {
        setPending(chatId, "standings");
      } else if (
        command === "schedule" ||
        command === "lineup" ||
        command === "standings"
      ) {
        clearPending(chatId);
      } else if (command && command !== "unknown") {
        clearPending(chatId);
      }

      let imageSent = false;
      if (media?.kind === "image" && media.base64) {
        try {
          const image = Buffer.from(media.base64, "base64");
          await safeSendMessage(chatId, {
            image,
            caption: media.caption || reply.slice(0, 900),
            mimetype: media.mime || "image/png",
          });
          imageSent = true;
          log.info({ command, chatId, bytes: image.length }, "Image reply sent");
        } catch (imageError) {
          log.warn(
            { error: String(imageError?.message || imageError) },
            "Image send failed — falling back to text",
          );
        }
      }

      if (!imageSent) {
        await safeSendMessage(chatId, { text: reply });
        log.info({ command, chatId }, "Command reply sent");
      }

      if (
        interactive?.kind === "league_select" &&
        (command === "schedule_menu" ||
          command === "lineup_menu" ||
          command === "standings_menu")
      ) {
        // Optional buttons — never block on them.
        sendLeagueInteractive(chatId, interactive).catch(() => {});
      }
    } catch (error) {
      log.warn(
        { error: String(error?.message || error) },
        "Command API/send failed",
      );
      try {
        await safeSendMessage(chatId, {
          text: "⚠️ משהו נתקע רגע — נסו שוב: *לוח* · *עזרה*",
        });
      } catch {
        /* connection may be dead; reconnect will recover */
      }
    } finally {
      commandInFlight.delete(chatLock);
      commandInFlight.delete(lockKey);
      commandLockStartedAt.delete(chatLock);
      commandLockStartedAt.delete(lockKey);
    }
  } catch (error) {
    commandInFlight.delete(lockKey);
    commandInFlight.delete(`chat:${chatId}`);
    commandLockStartedAt.delete(lockKey);
    commandLockStartedAt.delete(`chat:${chatId}`);
    log.warn(
      { error: String(error?.message || error) },
      "Failed to handle incoming message",
    );
  }
}

async function pollAlerts() {
  if (!cfg.alertsEnabled) return;
  if (!sock || !groupJid || !waConnected || pollRunning) return;
  pollRunning = true;
  try {
    const summary = await apiFetch("/api/cron/football-bot?dry=1", {
      method: "GET",
    });
    const alerts = Array.isArray(summary.alerts) ? summary.alerts : [];
    let posted = 0;
    for (const alert of alerts) {
      if (!alert?.text) continue;
      if (!waConnected) break;
      try {
        if (await sendToGroup(alert.text)) posted += 1;
      } catch (error) {
        log.warn(
          { error: String(error?.message || error) },
          "Alert send failed — continuing",
        );
      }
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
  if (!sock || !groupJid || !waConnected) return;
  try {
    const { reply } = await runRemoteCommand("בוקר");
    if (reply) {
      await sendToGroup(reply);
      log.info("Sent morning football status to WhatsApp group");
    }
  } catch (error) {
    log.warn({ error: String(error.message || error) }, "Morning status failed");
    markHealthFailure("morning-failed");
    scheduleReconnect("morning-failed", { immediate: true });
  }
}

/**
 * Deep hourly check: WhatsApp socket + group probe + site API.
 * On any failure → immediate reconnect (and later notify the group).
 */
async function runHourlyHealthCheck(opts = {}) {
  if (healthCheckRunning) return { ok: false, reason: "busy" };
  healthCheckRunning = true;
  const silent = Boolean(opts.silent);
  const label = new Date().toLocaleString("he-IL", {
    timeZone: cfg.morningTimezone || "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

  try {
    const checks = {
      waConnected: Boolean(waConnected && sock),
      groupOk: false,
      siteOk: false,
    };

    if (!checks.waConnected) {
      markHealthFailure("hourly-wa-offline");
      console.warn(`🩺 בדיקה שעתית ${label}: וואטסאפ לא מחובר — reconnect מיידי`);
      scheduleReconnect("hourly-wa-offline", { immediate: true });
      await writeHeartbeat({ hourly: "fail", reason: "wa-offline" });
      return { ok: false, reason: "wa-offline", checks };
    }

    if (!groupJid) {
      try {
        await resolveGroupByName();
      } catch {
        /* ignore */
      }
    }

    if (groupJid && sock) {
      try {
        await withTimeout(
          sock.groupMetadata(groupJid),
          10_000,
          "hourly.groupMetadata",
        );
        checks.groupOk = true;
        lastWsActivityAt = Date.now();
      } catch (error) {
        markHealthFailure(`hourly-group:${error?.message || error}`);
        console.warn(
          `🩺 בדיקה שעתית ${label}: בדיקת קבוצה נכשלה — reconnect מיידי`,
        );
        waConnected = false;
        scheduleReconnect("hourly-group-fail", { immediate: true });
        await writeHeartbeat({ hourly: "fail", reason: "group" });
        return { ok: false, reason: "group", checks };
      }
    } else {
      markHealthFailure("hourly-no-group");
      scheduleReconnect("hourly-no-group", { immediate: true });
      return { ok: false, reason: "no-group", checks };
    }

    try {
      const result = await withTimeout(
        apiFetch("/api/football-bot/command", {
          method: "POST",
          body: JSON.stringify({ text: "סטטוס" }),
        }),
        API_TIMEOUT_MS,
        "hourly.site",
      );
      checks.siteOk = Boolean(result?.reply || result?.command === "status");
      if (!checks.siteOk) throw new Error("empty status reply");
    } catch (error) {
      markHealthFailure(`hourly-site:${error?.message || error}`);
      console.warn(
        `🩺 בדיקה שעתית ${label}: API נכשל — ${String(error?.message || error)}`,
      );
      // Site down: keep WA up, but record failure; retry site on next tick.
      await writeHeartbeat({ hourly: "fail", reason: "site" });
      if (!silent) {
        try {
          await sendToGroup(
            [
              "⚠️ *בדיקה שעתית*",
              "",
              "וואטסאפ מחובר, אבל מקור הנתונים לא ענה.",
              "ממשיך לנסות אוטומטית…",
              "",
              "אפשר עדיין לכתוב פקודות משני המספרים בקבוצה.",
            ].join("\n"),
          );
        } catch {
          /* ignore */
        }
      }
      return { ok: false, reason: "site", checks };
    }

    lastHourlyCheckAt = Date.now();
    await writeHeartbeat({
      hourly: "ok",
      lastHourlyCheckAt,
      checks,
    });
    log.info({ label, checks }, "Hourly health check OK");
    console.log(`🩺 בדיקה שעתית ${label}: ✅ תקין (WA + קבוצה + API)`);
    return { ok: true, checks };
  } finally {
    healthCheckRunning = false;
  }
}

function markHealthFailure(reason) {
  lastHealthFailureAt = Date.now();
  lastHealthFailureReason = String(reason || "unknown");
  pendingRecoverNotify = Boolean(cfg.notifyOnRecover);
  writeHeartbeat({
    fail: true,
    reason: lastHealthFailureReason,
    at: lastHealthFailureAt,
  }).catch(() => {});
}

async function notifyRecoveredIfNeeded() {
  if (!pendingRecoverNotify || !cfg.notifyOnRecover) return;
  if (!sock || !groupJid || !waConnected) return;
  pendingRecoverNotify = false;
  const reason = lastHealthFailureReason || "disconnect";
  try {
    await sendToGroup(
      [
        "✅ *הבוט חזר לפעילות*",
        "",
        `תוקן אוטומטית אחרי: \`${reason}\``,
        "אפשר לכתוב בקבוצה משני המספרים ✓",
        "",
        "פקודות: *סטטוס* · *סגל* · *בוקר* · *עזרה*",
      ].join("\n"),
    );
    log.info({ reason }, "Sent recovery notice to group");
  } catch (error) {
    // If notify fails, try again on next successful connect.
    pendingRecoverNotify = true;
    log.warn(
      { error: String(error?.message || error) },
      "Recovery notice failed",
    );
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
      "כל יום ב־08:00 — *בדיקת תקינות* לליגות (לוודא שהבוט עובד) ⚽️🔥",
      "כל שעה — בדיקת חיבור שקטה; אם נפל חוזר מיד ומעדכן בקבוצה.",
      "",
      "שלט רחוק: *לוח* · *טבלה* · *סגל* · *הרכב* · *מעקב* · *בוקר* · *עזרה*",
      "ב־*לוח* / *טבלה* / *הרכב* נפתחת רשימת בחירת ליגה.",
      "*סגל* — רשימת שחקני ברצלונה עדכנית (במעקב).",
      "*בוקר* — בדיקת תקינות ידנית (כמו ב־08:00).",
      "",
      "שני המספרים בקבוצה יכולים לכתוב פקודות ✓",
      "כולל המספר המקושר *0523123944*",
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

  const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qr)}`;
  try {
    const artifacts = "/opt/cursor/artifacts";
    await mkdir(artifacts, { recursive: true });
    await writeFile(path.join(artifacts, "football-bot-qr-url.txt"), `${qrLink}\n`, "utf8");
    try {
      const png = await readFile(QR_FILE);
      await writeFile(path.join(artifacts, "football-bot-qr.png"), png);
    } catch {
      /* optional */
    }
  } catch (error) {
    log.warn({ error: String(error?.message || error) }, "Failed to write QR artifacts");
  }
  return qrLink;
}

async function onConnected() {
  waConnected = true;
  reconnectAttempts = 0;
  lastConnectionOpenAt = Date.now();
  lastWsActivityAt = Date.now();
  lastSuccessfulSendAt = Date.now();
  clearCommandLocks();
  console.log("\n✅ מחובר לוואטסאפ.");
  console.log(`   קבוצה: "${cfg.groupName}"`);
  console.log(
    `   בוקר 08:00 (${cfg.morningTimezone}): ${cfg.morningEnabled ? "on" : "off"}`,
  );
  console.log(
    `   בדיקה שעתית (${cfg.hourlyCron}): ${cfg.hourlyEnabled ? "on" : "off"}`,
  );
  console.log(`   כפתורי ליגה: ${cfg.buttonsEnabled ? "on" : "off"}`);
  console.log(
    `   פקודות fromMe (מקושר): ${cfg.allowFromMeCommands ? "on" : "off"}`,
  );
  if (cfg.operatorsOnly && cfg.operators?.length) {
    console.log(`   מפעילים (חסום לאחרים): ${cfg.operators.join(", ")}`);
  } else {
    console.log("   שני המספרים בקבוצה יכולים לכתוב פקודות ✓");
  }
  console.log("   חיבור יציב + reconnect מיידי + watchdog + בדיקה שעתית + supervisor.\n");

  // If we recovered from a drop — tell the group right away.
  notifyRecoveredIfNeeded().catch(() => {});

  if (groupPollTimer) {
    clearInterval(groupPollTimer);
    groupPollTimer = null;
  }

  groupPollTimer = setInterval(async () => {
    try {
      await resolveGroupByName();
      if (groupJid) {
        await welcomeGroup();
        clearInterval(groupPollTimer);
        groupPollTimer = null;
        pollAlerts().catch(() => {});
      }
    } catch (error) {
      log.warn(
        { error: String(error?.message || error) },
        "Group resolve tick failed",
      );
    }
  }, 8_000);

  // Schedule crons only once across reconnects.
  if (!cronsStarted) {
    cronsStarted = true;
    pollTask = cron.schedule(cfg.pollCron, () => {
      pollAlerts().catch((error) => {
        log.warn(
          { error: String(error?.message || error) },
          "Alert poll cron error",
        );
      });
    });

    if (cfg.morningEnabled) {
      morningTask = cron.schedule(
        cfg.morningCron,
        () => {
          sendMorningStatus().catch((error) => {
            log.warn(
              { error: String(error?.message || error) },
              "Morning cron error",
            );
          });
        },
        { timezone: cfg.morningTimezone },
      );
    }

    // Keep Next API warm + log site reachability every 5 minutes.
    cron.schedule("*/5 * * * *", () => {
      healthPingSite().catch(() => {});
    });

    if (cfg.hourlyEnabled) {
      hourlyTask = cron.schedule(
        cfg.hourlyCron,
        () => {
          runHourlyHealthCheck({ silent: true }).catch((error) => {
            log.warn(
              { error: String(error?.message || error) },
              "Hourly health cron error",
            );
          });
        },
        { timezone: cfg.morningTimezone },
      );
      // First check ~30s after boot (don't wait for top of hour).
      setTimeout(() => {
        runHourlyHealthCheck({ silent: true }).catch(() => {});
      }, 30_000);
    }
  }

  startWatchdog();
  startOutboxWatcher();
  startHeartbeat();
  startSelfHeal();
  await writeHeartbeat({ connected: true });
}

function disconnectStatusCode(lastDisconnect) {
  const err = lastDisconnect?.error;
  return (
    err?.output?.statusCode ??
    err?.statusCode ??
    err?.data ??
    undefined
  );
}

function clearCommandLocks() {
  commandInFlight.clear();
  commandLockStartedAt.clear();
}

function expireStaleCommandLocks() {
  const now = Date.now();
  for (const [key, started] of commandLockStartedAt.entries()) {
    if (now - started > COMMAND_LOCK_TTL_MS) {
      commandInFlight.delete(key);
      commandLockStartedAt.delete(key);
      log.warn({ key }, "Cleared stale command lock");
    }
  }
}

/**
 * Fast auto-reconnect. Never waits "a whole day" — caps at a few seconds.
 * @param {unknown} code
 * @param {{ immediate?: boolean }} [opts]
 */
function scheduleReconnect(code, opts = {}) {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(
      `❌ יותר מדי ניסיונות reconnect (${MAX_RECONNECT_ATTEMPTS}). supervisor will restart the process.`,
    );
    // Exit so supervise.mjs brings us back cleanly.
    process.exit(42);
    return;
  }

  // Any reconnect due to failure should notify once we're back.
  if (code !== "boot" && cfg.notifyOnRecover) {
    pendingRecoverNotify = true;
    lastHealthFailureReason = String(code ?? "disconnect");
    lastHealthFailureAt = Date.now();
  }

  // Coalesce bursts: if a timer is already pending, keep the sooner one.
  if (reconnectTimer && !opts.immediate) return;
  if (reconnectTimer && opts.immediate) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  reconnectAttempts += 1;
  // 0.4s → ~0.8 → 1.6 → 3.2 → max 6s (never multi-minute / day waits)
  const delay = opts.immediate
    ? 400
    : Math.min(6_000, 400 * 2 ** Math.min(reconnectAttempts - 1, 4));
  console.log(
    `🔄 מתחבר מחדש בעוד ${Math.round(delay / 1000)}ש (ניסיון ${reconnectAttempts}, code=${code})…`,
  );
  lastReconnectAt = Date.now();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startSocket().catch((error) => {
      console.error("reconnect failed", error);
      scheduleReconnect(code, { immediate: true });
    });
  }, delay);
}

async function writeHeartbeat(extra = {}) {
  try {
    await writeFile(
      HEARTBEAT_FILE,
      JSON.stringify({
        at: new Date().toISOString(),
        ts: Date.now(),
        pid: process.pid,
        waConnected,
        groupJid: groupJid || null,
        reconnectAttempts,
        lastWsActivityAt,
        lastSuccessfulSendAt,
        ...extra,
      }),
      "utf8",
    );
  } catch {
    /* ignore */
  }
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  writeHeartbeat({ boot: true }).catch(() => {});
  heartbeatTimer = setInterval(() => {
    expireStaleCommandLocks();
    writeHeartbeat().catch(() => {});
  }, HEARTBEAT_EVERY_MS);
  if (typeof heartbeatTimer.unref === "function") heartbeatTimer.unref();
}

function startSelfHeal() {
  if (selfHealTimer) return;
  selfHealTimer = setInterval(async () => {
    try {
      expireStaleCommandLocks();
      // If we think we're offline and nothing is reconnecting — kick it.
      if (!waConnected && !startingSocket && !reconnectTimer) {
        console.warn("🩺 self-heal: offline without pending reconnect — forcing");
        scheduleReconnect("self-heal-offline", { immediate: true });
        return;
      }
      if (!waConnected || !sock || !groupJid) return;
      const lastBeat = Math.max(
        lastSuccessfulSendAt,
        lastWsActivityAt,
        lastConnectionOpenAt,
      );
      if (!lastBeat || Date.now() - lastBeat <= STALE_CONNECTION_MS) return;

      // Soft probe first — idle nights must NOT force reconnect every few minutes.
      try {
        await withTimeout(
          sock.groupMetadata(groupJid),
          8_000,
          "self-heal.groupMetadata",
        );
        lastWsActivityAt = Date.now();
        await writeHeartbeat({ probe: "self-heal-ok" });
        return;
      } catch (error) {
        console.warn(
          `🩺 self-heal: probe failed (${String(error?.message || error)}) — reconnect`,
        );
        waConnected = false;
        scheduleReconnect("self-heal-probe-fail", { immediate: true });
      }
    } catch (error) {
      log.warn(
        { error: String(error?.message || error) },
        "self-heal tick failed",
      );
    }
  }, 30_000);
  if (typeof selfHealTimer.unref === "function") selfHealTimer.unref();
}

async function endSocketQuietly() {
  const current = sock;
  sock = null;
  waConnected = false;
  clearCommandLocks();
  if (!current) return;
  try {
    current.ev.removeAllListeners();
  } catch {
    /* ignore */
  }
  try {
    await withTimeout(current.end(undefined), 5_000, "socket.end");
  } catch {
    try {
      current.ws?.close?.();
    } catch {
      /* ignore */
    }
  }
}

function startWatchdog() {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(async () => {
    try {
      const now = Date.now();
      if (!waConnected || !sock) return;
      const lastBeat = Math.max(
        lastSuccessfulSendAt,
        lastWsActivityAt,
        lastConnectionOpenAt,
      );
      if (!lastBeat) return;
      const staleFor = now - lastBeat;

      // Soft probe before declaring the socket dead (~half of stale window).
      if (staleFor > STALE_CONNECTION_MS / 2 && groupJid) {
        try {
          await withTimeout(
            sock.groupMetadata(groupJid),
            8_000,
            "watchdog.groupMetadata",
          );
          lastWsActivityAt = Date.now();
          await writeHeartbeat({ probe: "ok" });
          return;
        } catch (error) {
          log.warn(
            { error: String(error?.message || error) },
            "watchdog probe failed — reconnecting now",
          );
          waConnected = false;
          scheduleReconnect("watchdog-probe-fail", { immediate: true });
          return;
        }
      }

      if (staleFor < STALE_CONNECTION_MS) return;

      console.warn(
        `🩺 watchdog: חיבור נראה תקוע (${Math.round(staleFor / 1000)}ש בלי פעילות) — reconnect מיידי`,
      );
      waConnected = false;
      scheduleReconnect("watchdog-stale", { immediate: true });
    } catch (error) {
      log.warn(
        { error: String(error?.message || error) },
        "watchdog tick failed",
      );
    }
  }, WATCHDOG_MS);
  if (typeof watchdogTimer.unref === "function") watchdogTimer.unref();
}

async function healthPingSite() {
  try {
    await apiFetch("/api/football-bot/command", {
      method: "POST",
      body: JSON.stringify({ text: "עזרה" }),
    });
  } catch (error) {
    log.warn(
      { error: String(error?.message || error) },
      "Site health ping failed",
    );
  }
}

async function startSocket() {
  if (startingSocket) return;
  startingSocket = true;
  try {
    await endSocketQuietly();
    await mkdir(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      emitOwnEvents: true,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 15_000,
      retryRequestDelayMs: 500,
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messages.upsert", ({ messages, type }) => {
      lastWsActivityAt = Date.now();
      if (type !== "notify" && type !== "append") return;
      for (const msg of messages) {
        // Never await here — a hung send must not freeze the whole bot.
        handleIncomingMessage(msg).catch((error) => {
          log.warn(
            { error: String(error?.message || error) },
            "Unhandled command error",
          );
        });
      }
    });

    // Any WA traffic counts as liveness for the watchdog.
    sock.ev.on("messaging-history.set", () => {
      lastWsActivityAt = Date.now();
    });
    sock.ev.on("presence.update", () => {
      lastWsActivityAt = Date.now();
    });
    sock.ev.on("chats.update", () => {
      lastWsActivityAt = Date.now();
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("\n📷 סרקו את הברקוד עם WhatsApp → מכשירים מקושרים:\n");
        qrcodeTerminal.generate(qr, { small: true });
        const qrLink = await saveQrPng(qr);
        console.log(`\nאו פתחו במובייל: ${qrLink}\n`);
      }

      if (connection === "open") {
        await onConnected();
      }

      if (connection === "close") {
        waConnected = false;
        clearCommandLocks();
        const code = disconnectStatusCode(lastDisconnect);
        const loggedOut = code === DisconnectReason.loggedOut;
        log.warn({ code }, "WhatsApp connection closed");
        console.log(`⚠️ חיבור וואטסאפ נסגר (code=${code}).`);
        markHealthFailure(`close:${code}`);

        if (loggedOut) {
          console.log(
            "התנתקתם מהמכשיר המקושר. מחקו את תיקיית auth וסרקו ברקוד מחדש.",
          );
          await writeHeartbeat({ loggedOut: true });
          return;
        }

        // 408/428/440/500/515/connectionReplaced — always try to come back fast.
        const immediate =
          code === 515 ||
          code === 408 ||
          code === 428 ||
          code === 503 ||
          code === DisconnectReason.connectionReplaced ||
          code === DisconnectReason.restartRequired ||
          code === DisconnectReason.timedOut;
        if (code === DisconnectReason.connectionReplaced || code === 440) {
          console.log(
            "החיבור הוחלף/נפל — מתחברים מחדש אוטומטית תוך שנייה…",
          );
        }
        scheduleReconnect(code, { immediate });
      }
    });
  } finally {
    startingSocket = false;
  }
}

async function main() {
  await loadEnvFile();
  cfg = envConfig();
  await loadState();
  if (cfg.groupJidEnv) groupJid = cfg.groupJidEnv;

  // libsignal prints noisy decrypt mismatches after reconnect churn — don't drown logs.
  const originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    const text = args.map((a) => String(a)).join(" ");
    if (
      text.includes("Session error") ||
      text.includes("Failed to decrypt") ||
      text.includes("Closing session") ||
      text.includes("Closing open session") ||
      text.includes("Bad MAC") ||
      text.includes("MessageCounterError")
    ) {
      return;
    }
    originalConsoleError(...args);
  };

  console.log("⚽ בוט כדורגל — כל הליגות (FIFA)");
  console.log(`   Site API: ${cfg.siteUrl}`);
  console.log(`   Group: ${cfg.groupName}`);
  console.log(`   Alerts: ${cfg.alertsEnabled ? "on" : "off"}`);
  console.log("");

  process.on("unhandledRejection", (reason) => {
    log.warn({ reason: String(reason) }, "unhandledRejection");
  });
  process.on("uncaughtException", (error) => {
    const msg = String(error?.message || error);
    log.error({ error: msg }, "uncaughtException");
    // Fatal / socket-corrupt errors → exit so supervisor restarts in seconds.
    const fatal =
      /out of memory|ENOMEM|Cannot read prop|EADDRINUSE|FATAL/i.test(msg);
    if (fatal) {
      console.error("💥 fatal uncaughtException — exiting for supervisor restart");
      process.exit(1);
    }
  });

  startHeartbeat();
  startSelfHeal();
  startWatchdog();
  await startSocket();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
