/**
 * Local/cloud poller: scrape Telegram → WhatsApp via Green API.
 * Also listens for group commands via receiveNotification / lastOutgoing.
 * Run under supervise.mjs for auto-restart.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const DATA_DIR = resolve(__dirname, ".data");
const SEEN_FILE = resolve(DATA_DIR, "seen.json");
const HEARTBEAT_FILE = resolve(DATA_DIR, "heartbeat.json");
mkdirSync(DATA_DIR, { recursive: true });

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
const PRIMARY_CHAT_ID =
  process.env.TG_WA_WHATSAPP_CHAT_ID || "120363409236894886@g.us";
const HAMAL_CHAT_ID =
  process.env.TG_WA_HAMAL_CHAT_ID || "120363410746391414@g.us";
const CHAT_IDS = (
  process.env.TG_WA_WHATSAPP_CHAT_IDS ||
  `${PRIMARY_CHAT_ID},${HAMAL_CHAT_ID}`
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .filter((id, i, arr) => arr.indexOf(id) === i);
const CHAT_ID = PRIMARY_CHAT_ID;
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
    "קבוצות: דיווחים מבצעי איראן + חמ״ל התרעות",
    `יעדים: ${CHAT_IDS.length}`,
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
let tickInFlight = false;
let commandInFlight = false;
let consecutiveTickFailures = 0;

function loadState() {
  try {
    if (!existsSync(SEEN_FILE)) return;
    const raw = JSON.parse(readFileSync(SEEN_FILE, "utf8"));
    const ids = Array.isArray(raw?.ids) ? raw.ids : [];
    for (const id of ids.slice(-2000)) seen.add(String(id));
    bootstrapped = Boolean(raw?.bootstrapped) || seen.size > 0;
    lastSentAt = raw?.lastSentAt || null;
    console.log(
      `[tg-wa] loaded state seen=${seen.size} bootstrapped=${bootstrapped}`,
    );
  } catch (err) {
    console.warn("[tg-wa] loadState failed", err);
  }
}

function saveState() {
  try {
    const ids = [...seen].slice(-2000);
    writeFileSync(
      SEEN_FILE,
      JSON.stringify(
        {
          bootstrapped,
          lastSentAt,
          updatedAt: new Date().toISOString(),
          ids,
        },
        null,
        0,
      ),
    );
  } catch (err) {
    console.warn("[tg-wa] saveState failed", err);
  }
}

function writeHeartbeat(extra = {}) {
  try {
    writeFileSync(
      HEARTBEAT_FILE,
      JSON.stringify(
        {
          ok: consecutiveTickFailures < 5,
          pid: process.pid,
          channel: CHANNEL,
          chatId: CHAT_ID,
          telegramOk,
          lastPollAt,
          lastSentAt,
          lastError: lastError || null,
          seen: seen.size,
          uptimeSec: Math.floor((Date.now() - STARTED_AT) / 1000),
          at: new Date().toISOString(),
          ...extra,
        },
        null,
        2,
      ),
    );
  } catch {
    // ignore
  }
}

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

async function fetchWithTimeout(url, options = {}, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMessages() {
  const url = `https://t.me/s/${CHANNEL}?t=${Date.now()}`;
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    },
    20_000,
  );
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

async function sendWhatsApp(text, chatId = CHAT_ID, attempts = 3) {
  let lastError = "";
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const res = await fetchWithTimeout(
        `https://api.green-api.com/waInstance${INSTANCE}/sendMessage/${TOKEN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, message: text }),
        },
        25_000,
      );
      if (!res.ok) {
        const body = await res.text();
        lastError = `WhatsApp HTTP ${res.status}: ${body.slice(0, 200)}`;
        // Retry rate-limits / transient errors.
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, 1000 * i));
          continue;
        }
        throw new Error(lastError);
      }
      return;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 1000 * i));
        continue;
      }
      throw new Error(lastError);
    }
  }
  throw new Error(lastError || "WhatsApp send failed");
}

async function sendWhatsAppToAll(text) {
  const errors = [];
  let anyOk = false;
  for (const chatId of CHAT_IDS) {
    try {
      await sendWhatsApp(text, chatId);
      anyOk = true;
    } catch (err) {
      errors.push(
        `${chatId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (!anyOk) {
    throw new Error(errors.join(" | ") || "WhatsApp send to all failed");
  }
  if (errors.length) {
    console.warn("[tg-wa] partial send failures:", errors.join(" | "));
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

/** One reply per command — never re-answer the same סטטוס every poll (~1s). */
const COMMAND_COOLDOWN_MS = Number(process.env.TG_WA_COMMAND_COOLDOWN_MS || 120_000);
const COMMAND_MAX_AGE_SEC = 45;
const ANSWERED_FILE = resolve(DATA_DIR, "answered-commands.json");
const answeredCommands = new Set();
/** @type {Map<string, number>} key = command → last reply epoch ms */
const lastCommandReplyAt = new Map();
let lastHistoryPollAt = 0;

function loadAnswered() {
  try {
    if (!existsSync(ANSWERED_FILE)) return;
    const raw = JSON.parse(readFileSync(ANSWERED_FILE, "utf8"));
    for (const id of raw.ids || []) answeredCommands.add(id);
    for (const [cmd, at] of Object.entries(raw.cooldowns || {})) {
      lastCommandReplyAt.set(cmd, Number(at) || 0);
    }
  } catch {
    /* ignore corrupt file */
  }
}

function saveAnswered() {
  try {
    const ids = [...answeredCommands].slice(-400);
    const cooldowns = Object.fromEntries(lastCommandReplyAt.entries());
    writeFileSync(
      ANSWERED_FILE,
      JSON.stringify({ ids, cooldowns, updatedAt: new Date().toISOString() }),
    );
  } catch (err) {
    console.warn("[tg-wa] save answered failed", err);
  }
}

function rememberAnswered(id) {
  if (!id) return;
  answeredCommands.add(id);
  if (answeredCommands.size > 500) {
    const trimmed = [...answeredCommands].slice(-300);
    answeredCommands.clear();
    for (const item of trimmed) answeredCommands.add(item);
  }
}

function fingerprint(chatId, command, timestamp) {
  return `${chatId}|${command}|${Number(timestamp) || 0}`;
}

/**
 * Claim a command once. Returns false if already answered / on cooldown.
 * Cooldown is global per command (replies go to all groups).
 */
function claimCommand(command, chatId, timestamp, ...ids) {
  if (!command) return false;
  const now = Date.now();
  const last = lastCommandReplyAt.get(command) || 0;
  if (now - last < COMMAND_COOLDOWN_MS) return false;

  const fp = fingerprint(chatId, command, timestamp);
  if (answeredCommands.has(fp)) return false;
  for (const id of ids) {
    if (id && answeredCommands.has(id)) return false;
  }

  lastCommandReplyAt.set(command, now);
  rememberAnswered(fp);
  for (const id of ids) rememberAnswered(id);
  saveAnswered();
  return true;
}

async function runCommand(command, source = "webhook") {
  if (commandInFlight) {
    console.log(`[tg-wa] skip ${command} — command already in flight`);
    return;
  }
  commandInFlight = true;
  try {
    if (command === "help") {
      await sendWhatsAppToAll(formatHelpReply());
    } else if (command === "source") {
      await sendWhatsAppToAll(formatSourceReply());
    } else if (command === "test") {
      await sendWhatsAppToAll(formatTestReply());
    } else if (command === "status") {
      await sendWhatsAppToAll(
        formatStatusReply({
          telegramOk,
          lastPollAt,
          lastSentAt,
          error: lastError,
        }),
      );
    } else if (command === "last") {
      let latest = latestChannelMessage;
      if (!latest) {
        const messages = await fetchMessages();
        latest = messages[messages.length - 1] || null;
        if (latest) latestChannelMessage = latest;
      }
      if (!latest) {
        await sendWhatsAppToAll(
          boldEveryLine(`${TITLE}\n\nאין הודעה אחרונה מהערוץ`),
        );
      } else {
        await sendWhatsAppToAll(formatMessage(latest.text, latest.url));
      }
    } else {
      return;
    }
    console.log(`[tg-wa] command ${command} replied (${source})`);
    writeHeartbeat({ lastCommand: command, lastCommandAt: new Date().toISOString() });
  } finally {
    commandInFlight = false;
  }
}

async function handleNotification(body) {
  const type = body?.typeWebhook || "";
  // Messages from OTHER phones in the group:
  //   incomingMessageReceived
  // Messages typed on the LINKED phone in the group:
  //   outgoingMessageReceived
  if (
    type !== "incomingMessageReceived" &&
    type !== "outgoingMessageReceived"
  ) {
    return;
  }

  const chatId =
    body?.senderData?.chatId || body?.chatId || body?.senderData?.chat || "";
  if (!CHAT_IDS.includes(chatId)) return;

  const text = extractIncomingText(body);
  if (String(text).includes(TITLE)) return;
  const command = parseCommand(text);
  if (!command) return;

  const ts = body?.timestamp || body?.messageData?.timestamp || 0;
  const idMessage =
    body?.idMessage || `${chatId}:${text}:${ts}`;
  if (!claimCommand(command, chatId, ts, idMessage)) return;

  const who =
    body?.senderData?.senderName ||
    body?.senderData?.sender ||
    (type === "outgoingMessageReceived" ? "linked-phone" : "?");
  console.log(`[tg-wa] command ${command} (${type}) from ${who}: ${text}`);
  await runCommand(command, type);
}

/** Fallback: personal phone commands arrive as incoming to the bot number. */
async function pollIncomingCommands() {
  const res = await fetch(
    `https://api.green-api.com/waInstance${INSTANCE}/lastIncomingMessages/${TOKEN}?minutes=2`,
  );
  if (!res.ok) return;
  const data = await res.json();
  if (!Array.isArray(data)) return;

  const nowSec = Math.floor(Date.now() / 1000);
  for (const m of data) {
    if (!CHAT_IDS.includes(m.chatId)) continue;
    const text = m.textMessage || m.extendedTextMessage || "";
    if (String(text).includes(TITLE)) continue;
    const command = parseCommand(text);
    if (!command) continue;
    const ts = Number(m.timestamp || 0);
    if (ts && nowSec - ts > COMMAND_MAX_AGE_SEC) continue;
    const id = m.idMessage || `${m.chatId}:${text}:${m.timestamp}`;
    if (!claimCommand(command, m.chatId, ts, id)) continue;
    console.log(
      `[tg-wa] command ${command} via lastIncoming from ${m.senderId || "?"}: ${text}`,
    );
    await runCommand(command, "lastIncoming");
    // One command claim per history poll — avoid spam from duplicate API rows.
    break;
  }
}

/** Fallback: linked phone commands often appear only in lastOutgoingMessages. */
async function pollOutgoingCommands() {
  const res = await fetch(
    `https://api.green-api.com/waInstance${INSTANCE}/lastOutgoingMessages/${TOKEN}?minutes=2`,
  );
  if (!res.ok) return;
  const data = await res.json();
  if (!Array.isArray(data)) return;

  const nowSec = Math.floor(Date.now() / 1000);
  for (const m of data) {
    if (!CHAT_IDS.includes(m.chatId)) continue;
    const text = m.textMessage || m.extendedTextMessage || "";
    // Skip our own API replies (they contain the title header).
    if (String(text).includes(TITLE)) continue;
    const command = parseCommand(text);
    if (!command) continue;
    const ts = Number(m.timestamp || 0);
    if (ts && nowSec - ts > COMMAND_MAX_AGE_SEC) continue;
    const id = m.idMessage || `${m.chatId}:${text}:${m.timestamp}`;
    if (!claimCommand(command, m.chatId, ts, id)) continue;
    console.log(`[tg-wa] command ${command} via lastOutgoing: ${text}`);
    await runCommand(command, "lastOutgoing");
    break;
  }
}

async function drainNotifications(max = 80) {
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
      const type = data.body?.typeWebhook || "";
      // Developer-plan quota spam must be deleted quickly or it blocks commands.
      if (type === "quotaExceeded") {
        if (i === 0) {
          console.warn(
            "[tg-wa] Green API correspondents quota exceeded — free a slot or upgrade",
          );
        }
      } else {
        await handleNotification(data.body);
      }
    } catch (err) {
      console.error("[tg-wa] handle notification failed", err);
    }
    await deleteNotification(data.receiptId);
  }
}

async function tick() {
  if (tickInFlight) {
    console.log("[tg-wa] skip tick — previous still running");
    return;
  }
  tickInFlight = true;
  // Hard safety: never leave tick stuck forever if something hangs.
  const stuckTimer = setTimeout(() => {
    if (tickInFlight) {
      console.error("[tg-wa] tick watchdog — forcing unlock/exit");
      process.exit(1);
    }
  }, 90_000);
  try {
    const messages = await fetchMessages();
    telegramOk = true;
    lastPollAt = new Date().toISOString();
    lastError = "";
    consecutiveTickFailures = 0;
    if (messages.length) {
      latestChannelMessage = messages[messages.length - 1];
    }

    if (!bootstrapped) {
      for (const m of messages) seen.add(m.id);
      bootstrapped = true;
      saveState();
      console.log(
        `[tg-wa] bootstrapped ${seen.size} msgs from @${CHANNEL} → ${CHAT_IDS.join(",")}`,
      );
      writeHeartbeat();
      return;
    }
    const fresh = messages.filter((m) => !seen.has(m.id));
    for (const m of fresh) {
      await sendWhatsAppToAll(formatMessage(m.text, m.url));
      seen.add(m.id);
      lastSentAt = new Date().toISOString();
      saveState();
      console.log(`[tg-wa] sent ${m.id}`);
    }
    if (!fresh.length) {
      console.log(`[tg-wa] ok — no new posts (${new Date().toISOString()})`);
    }
    writeHeartbeat({ fresh: fresh.length });
  } catch (err) {
    telegramOk = false;
    consecutiveTickFailures += 1;
    lastError = err instanceof Error ? err.message : String(err);
    console.error("[tg-wa] tick failed", err);
    writeHeartbeat({ error: lastError });
    // Escalate only after repeated hard failures so supervisor can restart.
    if (consecutiveTickFailures >= 8) {
      console.error("[tg-wa] too many tick failures — exiting for restart");
      process.exit(1);
    }
  } finally {
    clearTimeout(stuckTimer);
    tickInFlight = false;
  }
}

async function commandLoop() {
  for (;;) {
    try {
      await drainNotifications(80);
      // History APIs only every ~8s — receiveNotification handles realtime.
      // Prevents re-scanning the same סטטוס every second.
      const now = Date.now();
      if (now - lastHistoryPollAt >= 8_000) {
        lastHistoryPollAt = now;
        await pollOutgoingCommands();
        await pollIncomingCommands();
      }
      writeHeartbeat();
    } catch (err) {
      console.error("[tg-wa] command poll failed", err);
      await new Promise((r) => setTimeout(r, 3000));
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("[tg-wa] unhandledRejection", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[tg-wa] uncaughtException", err);
  // Let supervisor restart a wedged process.
  process.exit(1);
});

loadState();
loadAnswered();
console.log(
  `[tg-wa] polling @${CHANNEL} every ${INTERVAL_MS / 1000}s → ${CHAT_IDS.join(" + ")}`,
);
console.log(
  "[tg-wa] group commands: סטטוס | עזרה | מקור | בדיקה | אחרון (once / cooldown)",
);

await ensureHttpReceiveMode();
await tick();
setInterval(() => {
  tick().catch((err) => console.error("[tg-wa] tick failed", err));
}, INTERVAL_MS);
setInterval(() => writeHeartbeat(), 30_000);
commandLoop().catch((err) => {
  console.error("[tg-wa] command loop died", err);
  process.exit(1);
});
