#!/usr/bin/env node
/**
 * Green API command listener for LIVE + VIP groups.
 *
 * Important: when the linked WhatsApp phone types in the group, Green emits
 * `outgoingMessageReceived` (not incoming). We must handle both.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

/** @type {Set<string>} */
const answered = new Set();
const ANSWERED_MAX = 400;

async function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(ROOT, name);
    if (!existsSync(p)) continue;
    const text = await readFile(p, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i);
      const v = t.slice(i + 1);
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

function cfg() {
  const site = (
    process.env.FIFA_BOT_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://127.0.0.1:3010"
  ).replace(/\/$/, "");
  return {
    site,
    secret:
      process.env.FIFA_BOT_SECRET ||
      process.env.CRON_SECRET ||
      process.env.FEED_API_SECRET ||
      "test",
    instance: process.env.GREEN_API_INSTANCE || "",
    token: process.env.GREEN_API_TOKEN || "",
    apiHost: (
      process.env.GREEN_API_HOST || "https://7107.api.green-api.com"
    ).replace(/\/$/, ""),
    mainChat:
      process.env.FIFA_WHATSAPP_MAIN_CHAT_ID || "120363410010039894@g.us",
    vipChat:
      process.env.FIFA_WHATSAPP_VIP_CHAT_ID || "120363427162994986@g.us",
    receiveTimeout: Number(process.env.FIFA_BOT_RECEIVE_TIMEOUT || "5"),
  };
}

function sameChat(a, b) {
  if (!a || !b) return false;
  return String(a).split("@")[0] === String(b).split("@")[0];
}

function isOurGroup(c, chatId) {
  return sameChat(chatId, c.mainChat) || sameChat(chatId, c.vipChat);
}

function looksLikeCommand(raw) {
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[?!.,]/g, "")
    .replace(/\s+/g, " ");
  if (!t) return false;
  const keys = [
    "עזרה",
    "help",
    "פקודות",
    "הכל תקין",
    "הכלתקין",
    "הכל בסדר",
    "תקין",
    "בוט",
    "סטטוס",
    "status",
    "תוצאה",
    "תוצאות",
    "חי",
    "לייב",
    "live",
    "מחר",
    "לוח",
    "לוז",
    "לו״ז",
    "schedule",
    "הרכב",
    "הרכבים",
    "lineup",
    "מלך שערים",
    "כובשים",
    "scorers",
  ];
  return keys.some((k) => t === k || t.startsWith(`${k} `));
}

function extractText(body) {
  if (!body || typeof body !== "object") return "";
  const md = body.messageData || body;
  if (typeof md.textMessage === "string") return md.textMessage;
  if (typeof md.extendedTextMessage?.text === "string") {
    return md.extendedTextMessage.text;
  }
  if (typeof md.caption === "string") return md.caption;
  if (md.textMessageData?.textMessage) return md.textMessageData.textMessage;
  if (md.extendedTextMessageData?.text) return md.extendedTextMessageData.text;
  if (typeof body.textMessage === "string") return body.textMessage;
  return "";
}

function messageId(body) {
  return (
    body?.idMessage ||
    body?.messageData?.idMessage ||
    body?.senderData?.idMessage ||
    ""
  );
}

function normalizeKey(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[?!.,]/g, "")
    .replace(/\s+/g, " ");
}

function remember(id) {
  if (!id) return false;
  if (answered.has(id)) return true;
  answered.add(id);
  if (answered.size > ANSWERED_MAX) {
    const first = answered.values().next().value;
    answered.delete(first);
  }
  return false;
}

async function sendGreen(c, chatId, message) {
  const url = `${c.apiHost}/waInstance${c.instance}/sendMessage/${c.token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`send ${res.status}: ${text.slice(0, 180)}`);
  return text;
}

async function runCommand(c, text) {
  const res = await fetch(`${c.site}/api/fifa-bot/command`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${c.secret}`,
    },
    body: JSON.stringify({ text }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `command ${res.status}`);
  }
  return json.reply || "אין תשובה.";
}

async function deleteNotification(c, receiptId) {
  if (receiptId == null) return;
  const url = `${c.apiHost}/waInstance${c.instance}/deleteNotification/${c.token}/${receiptId}`;
  await fetch(url, { method: "DELETE" }).catch(() => undefined);
}

async function receiveOne(c, timeoutSec) {
  const url = `${c.apiHost}/waInstance${c.instance}/receiveNotification/${c.token}?receiveTimeout=${timeoutSec}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`receive ${res.status}: ${t.slice(0, 160)}`);
  }
  const text = await res.text();
  if (!text || text === "null") return null;
  return JSON.parse(text);
}

function isCommandWebhook(typeWebhook) {
  return (
    typeWebhook === "incomingMessageReceived" ||
    typeWebhook === "incomingMessage" ||
    // Phone-typed messages on the linked device
    typeWebhook === "outgoingMessageReceived" ||
    typeWebhook === "outgoingMessage"
  );
}

/** Skip our own API replies so we don't command-loop on bot output. */
function isFromApi(body) {
  const t = body?.typeWebhook || "";
  if (t === "outgoingAPIMessageReceived") return true;
  // Bot replies are multi-line / formatted — only exact short command keys fire.
  return false;
}

async function replyToCommand(c, chatId, text, id) {
  const key =
    id ||
    `${String(chatId).split("@")[0]}:${normalizeKey(text)}:${Math.floor(Date.now() / 90000)}`;
  if (remember(key)) return;
  console.log(
    new Date().toISOString(),
    "CMD",
    chatId.slice(-14),
    text.slice(0, 40),
  );
  const started = Date.now();
  try {
    const reply = await runCommand(c, text);
    await sendGreen(c, chatId, reply);
    console.log(
      new Date().toISOString(),
      "CMD ok",
      `${Date.now() - started}ms`,
      text.slice(0, 24),
    );
  } catch (error) {
    console.error(new Date().toISOString(), "command fail", String(error));
    await sendGreen(
      c,
      chatId,
      "⚠️ לא הצלחתי לענות עכשיו. נסו שוב בעוד רגע.",
    ).catch(() => undefined);
  }
}

async function handleNotification(c, note) {
  const receiptId = note?.receiptId;
  const body = note?.body || note;
  try {
    const typeWebhook = body?.typeWebhook || "";
    if (typeWebhook && !isCommandWebhook(typeWebhook)) return;
    if (isFromApi(body)) return;

    const senderData = body?.senderData || {};
    const chatId =
      senderData.chatId ||
      body?.chatId ||
      body?.messageData?.chatId ||
      "";
    if (!isOurGroup(c, chatId)) return;

    const typeMessage = body?.messageData?.typeMessage || body?.typeMessage;
    if (typeMessage === "reactionMessage") return;

    const text = extractText(body);
    if (!text || !looksLikeCommand(text)) return;

    // Ignore long bot-formatted messages that happen to contain a keyword.
    if (text.includes("\n") && text.length > 40) return;

    const id = messageId(body);
    // Delete first so queue stays clear, then answer.
    await deleteNotification(c, receiptId);
    await replyToCommand(c, chatId, text, id);
  } finally {
    await deleteNotification(c, receiptId);
  }
}

function messageText(m) {
  return (
    m?.textMessage ||
    m?.extendedTextMessage?.text ||
    m?.caption ||
    ""
  );
}

function isFreshCommandMessage(m) {
  const text = messageText(m);
  if (!text || !looksLikeCommand(text)) return false;
  // Skip bot-formatted replies.
  if (text.includes("\n") && text.length > 40) return false;
  const ts = Number(m.timestamp || 0);
  if (ts && Date.now() / 1000 - ts > 120) return false;
  return true;
}

/** Fallback when webhooks are delayed: scan recent phone/group messages. */
async function pollRecentMessages(c) {
  const endpoints = [
    `lastIncomingMessages/${c.token}?minutes=5`,
    `lastOutgoingMessages/${c.token}?minutes=5`,
  ];
  for (const ep of endpoints) {
    const res = await fetch(`${c.apiHost}/waInstance${c.instance}/${ep}`, {
      cache: "no-store",
    });
    if (!res.ok) continue;
    const rows = await res.json().catch(() => []);
    if (!Array.isArray(rows)) continue;
    for (const m of rows) {
      const chatId = m.chatId || m.chatId_ || "";
      if (!isOurGroup(c, chatId)) continue;
      if (!isFreshCommandMessage(m)) continue;
      await replyToCommand(c, chatId, messageText(m), m.idMessage || "");
    }
  }

  for (const chatId of [c.mainChat, c.vipChat]) {
    const url = `${c.apiHost}/waInstance${c.instance}/getChatHistory/${c.token}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, count: 6 }),
      cache: "no-store",
    });
    if (!res.ok) continue;
    const rows = await res.json().catch(() => []);
    if (!Array.isArray(rows)) continue;
    for (const m of rows.slice(0, 6)) {
      if (!isFreshCommandMessage(m)) continue;
      await replyToCommand(c, chatId, messageText(m), m.idMessage || "");
    }
  }
}

async function ensureGreenReceiveSettings(c) {
  const url = `${c.apiHost}/waInstance${c.instance}/setSettings/${c.token}`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      incomingWebhook: "yes",
      outgoingMessageWebhook: "yes",
      outgoingAPIMessageWebhook: "no",
      outgoingWebhook: "yes",
    }),
  }).catch(() => undefined);
}

async function main() {
  await loadEnv();
  const c = cfg();
  if (!c.instance || !c.token) {
    console.error("Missing GREEN_API_INSTANCE / GREEN_API_TOKEN");
    process.exit(1);
  }

  await ensureGreenReceiveSettings(c);

  console.log("FIFA command listener starting (fast + phone-outgoing)");
  console.log(" site=", c.site);
  console.log(" main=", c.mainChat);
  console.log(" vip=", c.vipChat);
  console.log(" receiveTimeout=", c.receiveTimeout);

  // Parallel safety net every 2s — catches phone-typed commands quickly.
  void (async () => {
    for (;;) {
      try {
        await pollRecentMessages(c);
      } catch (error) {
        console.error(new Date().toISOString(), "recent poll", String(error));
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  })();

  for (;;) {
    try {
      let note = await receiveOne(c, c.receiveTimeout);
      while (note) {
        await handleNotification(c, note);
        note = await receiveOne(c, 0);
      }
    } catch (error) {
      console.error(new Date().toISOString(), "listener error", String(error));
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
