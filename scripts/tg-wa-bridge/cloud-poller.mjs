/**
 * Local/cloud poller: scrape Telegram → WhatsApp via Green API.
 * Also listens for group commands (סטטוס) via receiveNotification.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(root, ".env.local"));

const INSTANCE = process.env.GREEN_API_INSTANCE || "710722683401";
const TOKEN = process.env.GREEN_API_TOKEN || "";
const CHAT_ID =
  process.env.TG_WA_WHATSAPP_CHAT_ID || "120363409236894886@g.us";
const CHANNEL = (
  process.env.TG_WA_CHANNELS || "mivzakeybitachon2225:מבזקי ביטחון 24/7"
)
  .split(",")[0]
  .split(":")[0]
  .replace(/^@/, "")
  .toLowerCase();
const TITLE = "איראן בזמן אמת – חדשות, דיווחים🇮🇷";
const INTERVAL_MS = Number(process.env.TG_WA_POLL_MS || 60000);
const STARTED_AT = Date.now();

function sanitizeForBold(text) {
  return String(text || "")
    .replace(/\*/g, "")
    .trim();
}

function boldEveryLine(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => sanitizeForBold(line))
    .filter(Boolean)
    .map((line) => `*${line}*`)
    .join("\n");
}

function formatMessage(text, url) {
  const body = boldEveryLine(text || "(הודעה)");
  const link = url ? `\n\n*🔗 ${sanitizeForBold(url)}*` : "";
  return `*${TITLE}*\n\n${body}${link}`;
}

function isStatusCommand(text) {
  const normalized = String(text || "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (
    normalized === "סטטוס" ||
    normalized === "איראן סטטוס" ||
    normalized === "סטטוס איראן" ||
    normalized === "בוט" ||
    normalized === "status"
  ) {
    return true;
  }
  return /^(סטטוס|status|בוט)\b/.test(normalized);
}

function formatStatusReply({ telegramOk, lastPollAt, lastSentAt, error }) {
  const lastPoll = lastPollAt
    ? new Date(lastPollAt).toLocaleString("he-IL", {
        timeZone: "Asia/Jerusalem",
      })
    : "טרם";
  const lastSent = lastSentAt
    ? new Date(lastSentAt).toLocaleString("he-IL", {
        timeZone: "Asia/Jerusalem",
      })
    : "טרם";
  const uptimeMin = Math.floor((Date.now() - STARTED_AT) / 60000);
  const lines = [
    TITLE,
    "",
    "סטטוס בוט — תקין",
    "וואטסאפ: ✅ מחובר",
    `טלגרם: ${telegramOk === false ? "❌" : "✅"} סורק`,
    `ערוץ: @${CHANNEL}`,
    "קבוצה: דיווחים מבצעי איראן 🇮🇷",
    `סריקה אחרונה: ${lastPoll}`,
    `שליחה אחרונה: ${lastSent}`,
    `עלייה: ${uptimeMin} דק׳`,
    error ? `שגיאה: ${error}` : "הכל עובד — ממתין להודעות חדשות",
    'פקודות: סטטוס | איראן סטטוס',
  ];
  return boldEveryLine(lines.join("\n"));
}

if (!TOKEN) {
  console.error("Missing GREEN_API_TOKEN");
  process.exit(1);
}

const seen = new Set();
let bootstrapped = false;
let telegramOk = true;
let lastPollAt = null;
let lastSentAt = null;
let lastError = "";

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchMessages() {
  const url = `https://t.me/s/${CHANNEL}?t=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
  const html = await res.text();
  const blocks = html.split('class="tgme_widget_message_wrap');
  const out = [];
  for (const block of blocks.slice(1)) {
    const post = block.match(
      new RegExp(`data-post="${CHANNEL}/(\\d+)"`, "i"),
    );
    if (!post) continue;
    const id = `${CHANNEL}:${post[1]}`;
    const textMatch = block.match(
      /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/,
    );
    const text = textMatch ? stripHtml(textMatch[1]) : "(הודעה)";
    const urlMsg = `https://t.me/${CHANNEL}/${post[1]}`;
    out.push({ id, text, url: urlMsg });
  }
  return out;
}

async function sendWhatsApp(text, chatId = CHAT_ID) {
  const res = await fetch(
    `https://api.green-api.com/waInstance${INSTANCE}/sendMessage/${TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message: text }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function ensureHttpReceiveMode() {
  try {
    const settingsRes = await fetch(
      `https://api.green-api.com/waInstance${INSTANCE}/getSettings/${TOKEN}`,
    );
    const settings = await settingsRes.json();
    if (settings?.webhookUrl) {
      console.log("[tg-wa] clearing webhookUrl so receiveNotification works");
      await fetch(
        `https://api.green-api.com/waInstance${INSTANCE}/setSettings/${TOKEN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhookUrl: "",
            incomingWebhook: "yes",
            outgoingWebhook: "no",
            stateWebhook: "no",
          }),
        },
      );
    }
  } catch (err) {
    console.warn("[tg-wa] settings check failed", err);
  }
}

function extractIncomingText(body) {
  const md = body?.messageData;
  if (!md) return "";
  if (md.typeMessage === "textMessage") {
    return md.textMessageData?.textMessage || "";
  }
  if (md.typeMessage === "extendedTextMessage") {
    return md.extendedTextMessageData?.text || "";
  }
  if (md.typeMessage === "quotedMessage") {
    return md.extendedTextMessageData?.text || "";
  }
  return "";
}

async function deleteNotification(receiptId) {
  await fetch(
    `https://api.green-api.com/waInstance${INSTANCE}/deleteNotification/${TOKEN}/${receiptId}`,
    { method: "DELETE" },
  );
}

async function handleIncoming(body) {
  if (body?.typeWebhook !== "incomingMessageReceived") return;
  const chatId = body?.senderData?.chatId || "";
  if (chatId !== CHAT_ID) return;
  const text = extractIncomingText(body);
  if (!isStatusCommand(text)) return;

  console.log(`[tg-wa] status command from ${body?.senderData?.senderName || "?"}`);
  const reply = formatStatusReply({
    telegramOk,
    lastPollAt,
    lastSentAt,
    error: lastError,
  });
  await sendWhatsApp(reply, chatId);
}

async function drainNotifications(max = 30) {
  for (let i = 0; i < max; i += 1) {
    const res = await fetch(
      `https://api.green-api.com/waInstance${INSTANCE}/receiveNotification/${TOKEN}?receiveTimeout=1`,
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`receiveNotification HTTP ${res.status}: ${body.slice(0, 180)}`);
    }
    const data = await res.json();
    if (!data || data.receiptId == null) break;
    try {
      await handleIncoming(data.body);
    } catch (err) {
      console.error("[tg-wa] handle incoming failed", err);
    }
    await deleteNotification(data.receiptId);
  }
}

async function tick() {
  try {
    const messages = await fetchMessages();
    telegramOk = true;
    lastPollAt = new Date().toISOString();
    lastError = "";

    if (!bootstrapped) {
      for (const m of messages) seen.add(m.id);
      bootstrapped = true;
      console.log(
        `[tg-wa] bootstrapped ${seen.size} msgs from @${CHANNEL} → ${CHAT_ID}`,
      );
      return;
    }
    const fresh = messages.filter((m) => !seen.has(m.id));
    for (const m of fresh) {
      await sendWhatsApp(formatMessage(m.text, m.url));
      seen.add(m.id);
      lastSentAt = new Date().toISOString();
      console.log(`[tg-wa] sent ${m.id}`);
    }
    if (!fresh.length) {
      console.log(`[tg-wa] ok — no new posts (${new Date().toISOString()})`);
    }
  } catch (err) {
    telegramOk = false;
    lastError = err instanceof Error ? err.message : String(err);
    console.error("[tg-wa] tick failed", err);
  }
}

async function commandLoop() {
  for (;;) {
    try {
      await drainNotifications(20);
    } catch (err) {
      console.error("[tg-wa] command poll failed", err);
      await new Promise((r) => setTimeout(r, 3000));
    }
    await new Promise((r) => setTimeout(r, 800));
  }
}

console.log(
  `[tg-wa] polling @${CHANNEL} every ${INTERVAL_MS / 1000}s → ${CHAT_ID}`,
);
console.log("[tg-wa] group commands: סטטוס | איראן סטטוס | בוט");

await ensureHttpReceiveMode();
await tick();
setInterval(() => {
  tick().catch((err) => console.error("[tg-wa] tick failed", err));
}, INTERVAL_MS);
commandLoop().catch((err) => {
  console.error("[tg-wa] command loop died", err);
  process.exit(1);
});
