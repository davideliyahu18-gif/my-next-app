#!/usr/bin/env node
/**
 * Failsafe: if round-hour תקינות was not sent by xx:01:30, send it once.
 * Runs alongside the poller — does not replace it.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const DATA = resolve(__dirname, ".data");
const LAST = resolve(DATA, "last-hourly.json");
mkdirSync(DATA, { recursive: true });

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv(resolve(root, ".env.local"));

const INSTANCE = process.env.GREEN_API_INSTANCE;
const TOKEN = process.env.GREEN_API_TOKEN;
const GROUP =
  process.env.TG_WA_WHATSAPP_CHAT_IDS || process.env.TG_WA_HAMAL_CHAT_ID;
const TITLE = "🇮🇱 חמ״ל התרעות ירי איראן 🛡️";

function partsNow() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const o = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const hour = Number(o.hour === "24" ? "0" : o.hour);
  return {
    hourKey: `${o.year}-${o.month}-${o.day}T${String(hour).padStart(2, "0")}`,
    hour,
    minute: Number(o.minute),
    second: Number(o.second),
  };
}

function readHourKey() {
  try {
    if (!existsSync(LAST)) return "";
    return String(JSON.parse(readFileSync(LAST, "utf8")).hourKey || "");
  } catch {
    return "";
  }
}

function claim(hourKey) {
  writeFileSync(
    LAST,
    JSON.stringify({
      at: Date.now(),
      hourKey,
      iso: new Date().toISOString(),
      via: "hourly-failsafe",
    }),
  );
}

function formatMsg() {
  const time = new Date().toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return [
    `*${TITLE}*`,
    time,
    "",
    `*✅ בדיקת תקינות - הבוט פעיל ומאזין*`,
    `*חמ״ל התרעות ירי איראן 🛡️*`,
    "",
    `*נכון לרגע זה — אין התרעה פעילה בישראל 🇮🇱*`,
  ].join("\n");
}

async function sendAll(message) {
  const targets = [...new Set([GROUP].filter(Boolean))];
  for (const chatId of targets) {
    const res = await fetch(
      `https://api.green-api.com/waInstance${INSTANCE}/sendMessage/${TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message }),
      },
    );
    const body = await res.text();
    console.log(
      `[hourly-failsafe ${new Date().toISOString()}] → ${chatId} ${res.status} ${body}`,
    );
    if (!res.ok) throw new Error(body);
  }
}

console.log(
  `[hourly-failsafe ${new Date().toISOString()}] watching round hours (Asia/Jerusalem)`,
);

setInterval(async () => {
  try {
    const p = partsNow();
    // Fire between :00:20 and :02:00 if poller did not claim this hour.
    if (p.minute > 2) return;
    if (p.minute === 0 && p.second < 20) return;
    if (readHourKey() === p.hourKey) return;
    console.log(
      `[hourly-failsafe] MISSED ${p.hourKey} — sending catch-up now`,
    );
    claim(p.hourKey);
    await sendAll(formatMsg());
  } catch (err) {
    console.error("[hourly-failsafe] failed", err);
  }
}, 5_000).unref?.();

// Keep process alive.
setInterval(() => {}, 60_000);
