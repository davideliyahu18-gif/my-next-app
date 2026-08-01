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

function normalizeCommandText(text) {
  return String(text || "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[!?.،,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseCommand(text) {
  const n = normalizeCommandText(text);
  if (
    n === "סטטוס" ||
    n === "איראן סטטוס" ||
    n === "סטטוס איראן" ||
    n === "בוט" ||
    n === "status"
  ) {
    return "status";
  }
  if (n === "עזרה" || n === "help" || n === "פקודות") return "help";
  if (n === "מקור" || n === "source" || n === "ערוץ") return "source";
  if (n === "בדיקה" || n === "test" || n === "טסט") return "test";
  if (n === "אחרון" || n === "last" || n === "אחרונה") return "last";
  return null;
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
    "פקודות: עזרה",
  ];
  return boldEveryLine(lines.join("\n"));
}

function formatHelpReply() {
  return boldEveryLine(
    [
      TITLE,
      "",
      "פקודות בוט",
      "סטטוס — האם הבוט תקין",
      "עזרה — רשימת פקודות",
      "מקור — קישור לערוץ הטלגרם",
      "בדיקה — הודעת בדיקה לקבוצה",
      "אחרון — ההודעה האחרונה מהערוץ",
    ].join("\n"),
  );
}

function formatSourceReply() {
  return boldEveryLine(
    [
      TITLE,
      "",
      "מקור הדיווחים",
      `ערוץ: @${CHANNEL}`,
      "שם: מבזקי ביטחון 24/7",
      `קישור: https://t.me/${CHANNEL}`,
      `תצוגה: https://t.me/s/${CHANNEL}`,
      "קבוצה: דיווחים מבצעי איראן 🇮🇷",
    ].join("\n"),
  );
}

function formatTestReply() {
  const now = new Date().toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
  });
  return boldEveryLine(
    [TITLE, "", "בדיקה — תקין", "הבוט מחובר ומוכן", `שעה: ${now}`].join("\n"),
  );
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
/** @type {{id:string,text:string,url:string}|null} */
let latestChannelMessage = null;

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

const answeredCommands = new Set();

async function runCommand(command, source = "webhook") {
  if (command === "help") {
    await sendWhatsApp(formatHelpReply(), CHAT_ID);
  } else if (command === "source") {
    await sendWhatsApp(formatSourceReply(), CHAT_ID);
  } else if (command === "test") {
    await sendWhatsApp(formatTestReply(), CHAT_ID);
  } else if (command === "status") {
    await sendWhatsApp(
      formatStatusReply({
        telegramOk,
        lastPollAt,
        lastSentAt,
        error: lastError,
      }),
      CHAT_ID,
    );
  } else if (command === "last") {
    let latest = latestChannelMessage;
    if (!latest) {
      const messages = await fetchMessages();
      latest = messages[messages.length - 1] || null;
      if (latest) latestChannelMessage = latest;
    }
    if (!latest) {
      await sendWhatsApp(
        boldEveryLine(`${TITLE}\n\nאין הודעה אחרונה מהערוץ`),
        CHAT_ID,
      );
    } else {
      await sendWhatsApp(formatMessage(latest.text, latest.url), CHAT_ID);
    }
  } else {
    return;
  }
  console.log(`[tg-wa] command ${command} replied (${source})`);
}

async function handleNotification(body) {
  const type = body?.typeWebhook || "";
  // Messages from OTHER phones in the group:
  //   incomingMessageReceived
  // Messages typed on the LINKED phone (052-312-3944) in the group:
  //   outgoingMessageReceived
  if (
    type !== "incomingMessageReceived" &&
    type !== "outgoingMessageReceived"
  ) {
    return;
  }

  const chatId =
    body?.senderData?.chatId || body?.chatId || body?.senderData?.chat || "";
  if (chatId !== CHAT_ID) return;

  const text = extractIncomingText(body);
  const command = parseCommand(text);
  if (!command) return;

  const idMessage =
    body?.idMessage || `${chatId}:${text}:${body?.timestamp || ""}`;
  if (answeredCommands.has(idMessage)) return;
  answeredCommands.add(idMessage);

  const who =
    body?.senderData?.senderName ||
    body?.senderData?.sender ||
    (type === "outgoingMessageReceived" ? "linked-phone" : "?");
  console.log(`[tg-wa] command ${command} (${type}) from ${who}: ${text}`);
  await runCommand(command, type);
}

/** Fallback: linked phone commands often appear only in lastOutgoingMessages. */
async function pollOutgoingCommands() {
  const res = await fetch(
    `https://api.green-api.com/waInstance${INSTANCE}/lastOutgoingMessages/${TOKEN}?minutes=5`,
  );
  if (!res.ok) return;
  const data = await res.json();
  if (!Array.isArray(data)) return;

  const nowSec = Math.floor(Date.now() / 1000);
  for (const m of data) {
    if (m.chatId !== CHAT_ID) continue;
    const text = m.textMessage || m.extendedTextMessage || "";
    const command = parseCommand(text);
    if (!command) continue;
    // Skip our own API replies (they contain the title header).
    if (String(text).includes(TITLE)) continue;
    const ts = Number(m.timestamp || 0);
    // Only react to commands from the last ~2 minutes (linked-phone lag).
    if (ts && nowSec - ts > 120) continue;
    const id = m.idMessage || `${m.chatId}:${text}:${m.timestamp}`;
    if (answeredCommands.has(id)) continue;
    answeredCommands.add(id);
    console.log(`[tg-wa] command ${command} via lastOutgoing: ${text}`);
    await runCommand(command, "lastOutgoing");
  }
}

async function drainNotifications(max = 30) {
  for (let i = 0; i < max; i += 1) {
    const res = await fetch(
      `https://api.green-api.com/waInstance${INSTANCE}/receiveNotification/${TOKEN}?receiveTimeout=1`,
    );
    const raw = await res.text();
    // 200 null / 408 timeout / empty = no notifications waiting.
    if (res.status === 408 || !raw || raw === "null") break;
    if (!res.ok) {
      if (raw.includes("Data processing error")) {
        await new Promise((r) => setTimeout(r, 1500));
        break;
      }
      throw new Error(
        `receiveNotification HTTP ${res.status}: ${raw.slice(0, 180)}`,
      );
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      break;
    }
    if (!data || data.receiptId == null) break;
    try {
      await handleNotification(data.body);
    } catch (err) {
      console.error("[tg-wa] handle notification failed", err);
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
    if (messages.length) {
      latestChannelMessage = messages[messages.length - 1];
    }

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
      await pollOutgoingCommands();
    } catch (err) {
      console.error("[tg-wa] command poll failed", err);
      await new Promise((r) => setTimeout(r, 3000));
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
}

console.log(
  `[tg-wa] polling @${CHANNEL} every ${INTERVAL_MS / 1000}s → ${CHAT_ID}`,
);
console.log(
  "[tg-wa] group commands: סטטוס | עזרה | מקור | בדיקה | אחרון",
);

await ensureHttpReceiveMode();
await tick();
setInterval(() => {
  tick().catch((err) => console.error("[tg-wa] tick failed", err));
}, INTERVAL_MS);
commandLoop().catch((err) => {
  console.error("[tg-wa] command loop died", err);
  process.exit(1);
});
