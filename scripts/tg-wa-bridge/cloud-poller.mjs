/**
 * Local/cloud poller: scrape Telegram → WhatsApp via Green API.
 * Loads credentials from env or sibling ../../.env.local
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

if (!TOKEN) {
  console.error("Missing GREEN_API_TOKEN");
  process.exit(1);
}

const seen = new Set();
let bootstrapped = false;

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

async function sendWhatsApp(text) {
  const res = await fetch(
    `https://api.green-api.com/waInstance${INSTANCE}/sendMessage/${TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: CHAT_ID, message: text }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function tick() {
  const messages = await fetchMessages();
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
    console.log(`[tg-wa] sent ${m.id}`);
  }
  if (!fresh.length) {
    console.log(`[tg-wa] ok — no new posts (${new Date().toISOString()})`);
  }
}

console.log(
  `[tg-wa] polling @${CHANNEL} every ${INTERVAL_MS / 1000}s → ${CHAT_ID}`,
);
await tick();
setInterval(() => {
  tick().catch((err) => console.error("[tg-wa] tick failed", err));
}, INTERVAL_MS);
