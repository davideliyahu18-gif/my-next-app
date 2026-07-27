import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, "auth");
const STATE_FILE = path.join(__dirname, "bot-state.json");
const require = createRequire(import.meta.url);
const baileys = require("@whiskeysockets/baileys");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = baileys;

const state = existsSync(STATE_FILE)
  ? JSON.parse(await readFile(STATE_FILE, "utf8"))
  : {};
const groupJid =
  process.env.FOOTBALL_WHATSAPP_CHAT_ID ||
  state.groupJid ||
  "120363411314074126@g.us";

const site =
  process.env.FOOTBALL_BOT_SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://127.0.0.1:3000";
const secret =
  process.env.FOOTBALL_BOT_SECRET ||
  process.env.CRON_SECRET ||
  "dev-football-secret";

const api = await fetch(`${site.replace(/\/$/, "")}/api/football-bot/command`, {
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
  throw new Error(`no media from roster command: ${JSON.stringify(result).slice(0, 300)}`);
}

const intro = [
  "✅ *פקודה חדשה: סגל*",
  "",
  "כתבו בקבוצה:",
  "• *סגל*",
  "• *סגל ברצלונה*",
  "• *רשימת שחקני ברצלונה*",
  "",
  "מקבלים סגל עדכני של ברצלונה (במעקב) כתמונה 👇",
].join("\n");

const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
const { version } = await fetchLatestBaileysVersion();
const sock = makeWASocket({
  version,
  auth,
  printQRInTerminal: false,
  logger: pino({ level: "silent" }),
});
sock.ev.on("creds.update", saveCreds);

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timeout")), 45000);
  sock.ev.on("connection.update", async (update) => {
    if (update.qr) {
      clearTimeout(timer);
      reject(new Error("needs QR"));
      return;
    }
    if (update.connection === "open") {
      try {
        await sock.sendMessage(groupJid, { text: intro });
        await sock.sendMessage(groupJid, {
          image: Buffer.from(media.base64, "base64"),
          caption: media.caption || String(result.reply || "").slice(0, 900),
          mimetype: media.mime || "image/png",
        });
        console.log("SENT_OK");
        clearTimeout(timer);
        resolve();
      } catch (e) {
        clearTimeout(timer);
        reject(e);
      }
    }
    if (update.connection === "close") {
      clearTimeout(timer);
      reject(new Error("closed"));
    }
  });
});
setTimeout(() => process.exit(0), 2000);
