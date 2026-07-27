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
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;

const message = [
  "⭐ *מעקב קבוצה פעיל*",
  "",
  "✅ נוספה: *ברצלונה* (Barcelona)",
  "",
  "מעכשיו תזכורות · הרכבים · שערים · סיום — בעיקר לברצלונה.",
  "",
  "פקודות:",
  "• *מעקב* — רשימה",
  "• *עקוב ארסנל* — הוספה",
  "• *הסר ברצלונה* — הסרה",
].join("\n");

const state = existsSync(STATE_FILE) ? JSON.parse(await readFile(STATE_FILE, "utf8")) : {};
const groupJid = process.env.FOOTBALL_WHATSAPP_CHAT_ID || state.groupJid;
if (!groupJid) throw new Error("no group");

const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
const { version } = await fetchLatestBaileysVersion();
const sock = makeWASocket({ version, auth, printQRInTerminal: false, logger: pino({ level: "silent" }) });
sock.ev.on("creds.update", saveCreds);

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timeout")), 45000);
  sock.ev.on("connection.update", async (update) => {
    if (update.qr) { clearTimeout(timer); reject(new Error("needs QR")); return; }
    if (update.connection === "open") {
      try {
        await sock.sendMessage(groupJid, { text: message });
        console.log("SENT_OK");
        clearTimeout(timer);
        resolve();
      } catch (e) { clearTimeout(timer); reject(e); }
    }
    if (update.connection === "close") { clearTimeout(timer); reject(new Error("closed")); }
  });
});
setTimeout(() => process.exit(0), 1500);
