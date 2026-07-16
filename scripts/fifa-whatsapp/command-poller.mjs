#!/usr/bin/env node
/**
 * Green API command listener for LIVE + VIP groups.
 * Polls receiveNotification, runs /api/fifa-bot/command, replies in-chat.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

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
    receiveTimeout: Number(process.env.FIFA_BOT_RECEIVE_TIMEOUT || "15"),
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
  return keys.some((k) => t === k || t.startsWith(`${k} `) || t.includes(k));
}

function extractText(body) {
  if (!body || typeof body !== "object") return "";
  if (typeof body.textMessage === "string") return body.textMessage;
  if (typeof body.extendedTextMessage?.text === "string") {
    return body.extendedTextMessage.text;
  }
  if (typeof body.caption === "string") return body.caption;
  if (body.messageData?.textMessageData?.textMessage) {
    return body.messageData.textMessageData.textMessage;
  }
  if (body.messageData?.extendedTextMessageData?.text) {
    return body.messageData.extendedTextMessageData.text;
  }
  return "";
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

async function receiveOne(c) {
  const url = `${c.apiHost}/waInstance${c.instance}/receiveNotification/${c.token}?receiveTimeout=${c.receiveTimeout}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`receive ${res.status}: ${t.slice(0, 160)}`);
  }
  const text = await res.text();
  if (!text || text === "null") return null;
  return JSON.parse(text);
}

async function handleNotification(c, note) {
  const receiptId = note?.receiptId;
  const body = note?.body || note;
  try {
    const typeWebhook = body?.typeWebhook || "";
    if (
      typeWebhook &&
      typeWebhook !== "incomingMessageReceived" &&
      typeWebhook !== "incomingMessage"
    ) {
      return;
    }

    const senderData = body?.senderData || {};
    const chatId =
      senderData.chatId ||
      body?.chatId ||
      body?.messageData?.chatId ||
      "";
    if (!isOurGroup(c, chatId)) return;

    // Ignore our own API sends
    if (body?.messageData?.typeMessage === "reactionMessage") return;
    const fromApi = body?.messageData?.statusMessage != null && body?.instanceData;
    void fromApi;

    const text = extractText(body?.messageData || body);
    if (!text || !looksLikeCommand(text)) return;

    console.log(
      new Date().toISOString(),
      "CMD",
      chatId.slice(-14),
      text.slice(0, 40),
    );
    await sendGreen(c, chatId, "⏳ רגע, בודק…");
    try {
      const reply = await runCommand(c, text);
      await sendGreen(c, chatId, reply);
    } catch (error) {
      console.error(new Date().toISOString(), "command fail", String(error));
      await sendGreen(
        c,
        chatId,
        "⚠️ לא הצלחתי לענות עכשיו. נסו שוב בעוד רגע.",
      );
    }
  } finally {
    await deleteNotification(c, receiptId);
  }
}

async function main() {
  await loadEnv();
  const c = cfg();
  if (!c.instance || !c.token) {
    console.error("Missing GREEN_API_INSTANCE / GREEN_API_TOKEN");
    process.exit(1);
  }
  console.log("FIFA command listener starting");
  console.log(" site=", c.site);
  console.log(" main=", c.mainChat);
  console.log(" vip=", c.vipChat);

  for (;;) {
    try {
      const note = await receiveOne(c);
      if (note) await handleNotification(c, note);
    } catch (error) {
      console.error(new Date().toISOString(), "listener error", String(error));
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
