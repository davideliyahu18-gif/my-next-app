#!/usr/bin/env node
/**
 * Queue Barcelona roster announce through the RUNNING bot outbox.
 * Does NOT open a second WhatsApp session.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const OUTBOX_DIR = path.join(__dirname, "outbox");

async function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    try {
      const text = await import("node:fs/promises").then((fs) =>
        fs.readFile(path.join(ROOT, name), "utf8"),
      );
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] == null) process.env[key] = value;
      }
    } catch {
      /* missing */
    }
  }
}

await loadEnv();

const site = (
  process.env.FOOTBALL_BOT_SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://127.0.0.1:3000"
).replace(/\/$/, "");
const secret =
  process.env.FOOTBALL_BOT_SECRET ||
  process.env.CRON_SECRET ||
  "dev-football-secret";

const api = await fetch(`${site}/api/football-bot/command`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text: "סגל ברצלונה" }),
});
const result = await api.json();
const media = result.media;
if (!media?.base64) {
  throw new Error(
    `no media from roster command: ${JSON.stringify(result).slice(0, 300)}`,
  );
}

const intro = [
  "✅ *עדכון סגל ברצלונה*",
  "",
  "🆕 רכש חדש במעקב:",
  "• *אדיימי* (Karim Adeyemi)",
  "• *גורדון* (Anthony Gordon)",
  "",
  "כתבו *סגל* / *סגל ברצלונה* לרשימה המלאה 👇",
].join("\n");

await mkdir(OUTBOX_DIR, { recursive: true });
const stamp = Date.now();

await writeFile(
  path.join(OUTBOX_DIR, `${stamp}-roster-intro.json`),
  JSON.stringify({ text: intro, queuedAt: new Date().toISOString() }),
  "utf8",
);
await writeFile(
  path.join(OUTBOX_DIR, `${stamp + 1}-roster-image.json`),
  JSON.stringify({
    queuedAt: new Date().toISOString(),
    imageBase64: media.base64,
    mime: media.mime || "image/png",
    caption: media.caption || String(result.reply || "").slice(0, 900),
  }),
  "utf8",
);

console.log("QUEUED_OK roster intro + image (bot outbox)");
