#!/usr/bin/env node
/** One-off test message to the configured WhatsApp group. */
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const AUTH_DIR = path.join(__dirname, "auth");
const STATE_FILE = path.join(__dirname, "bot-state.json");

const require = createRequire(import.meta.url);
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

async function loadEnvFile() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const text = await readFile(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    let value = trimmed.slice(idx + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function testMessage() {
  const custom = process.argv.slice(2).join(" ").trim();
  if (custom) return custom;
  return [
    "✅ *הודעת בדיקה*",
    "",
    "הבוט פעיל ומחובר.",
    "מחפש: תאילנד · אמירטס · יציאה 15:10→07:35 · חזרה בלילה · מזוודה כלולה.",
    "כתבו *בוט מחפש?* לסטטוס.",
  ].join("\n");
}

async function resolveGroupJid() {
  if (process.env.WHATSAPP_GROUP_CHAT_ID) return process.env.WHATSAPP_GROUP_CHAT_ID;
  if (existsSync(STATE_FILE)) {
    const state = JSON.parse(await readFile(STATE_FILE, "utf8"));
    if (state.groupJid) return state.groupJid;
  }
  throw new Error("No group JID — run the bot once or set WHATSAPP_GROUP_CHAT_ID");
}

async function main() {
  await loadEnvFile();
  const groupJid = await resolveGroupJid();
  const text = testMessage();

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WhatsApp connect timeout")), 30_000);
    sock.ev.on("connection.update", async ({ connection }) => {
      if (connection === "open") {
        clearTimeout(timer);
        try {
          await sock.sendMessage(groupJid, { text });
          console.log("Sent test message to", groupJid);
          setTimeout(() => {
            sock.end();
            resolve();
          }, 1500);
        } catch (error) {
          reject(error);
        }
      }
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
