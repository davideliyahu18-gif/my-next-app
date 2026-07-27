#!/usr/bin/env node
/**
 * One-shot: resolve "בוט ליגות" WhatsApp group and send a message.
 */
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, "auth");
const STATE_FILE = path.join(__dirname, "bot-state.json");
const TARGET = process.env.FOOTBALL_WHATSAPP_GROUP_NAME || "בוט ליגות";

const require = createRequire(import.meta.url);
const baileys = require("@whiskeysockets/baileys");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = baileys;

function scoreSubject(subject, wanted) {
  const s = subject.toLowerCase();
  const w = wanted.toLowerCase().trim();
  if (!w) return 0;
  if (s === w) return 100;
  if (s.includes(w)) return 80;
  if (w.includes(s) && s.length >= 4) return 60;
  if (s.includes("בוט") && s.includes("ליגות") && w.includes("ליגות")) return 90;
  if (s.includes("ליגות") && w.includes("ליגות")) return 50;
  return 0;
}

const message = [
  "✅ *בוט ליגות מחובר!*",
  "",
  "הקבוצה הזו מקבלת עכשיו עדכוני כדורגל מ־FIFA.",
  "",
  "כתבו בקבוצה:",
  "• *תוצאה* — משחקים חיים / קרובים",
  "• *מחר* — משחקי מחר",
  "• *לוח* — המשחקים הבאים",
  "• *ליגות* — מה במעקב",
  "• *עזרה* — כל הפקודות",
  "",
  "שני המספרים בקבוצה ✓ — הבוט פעיל ⚽",
].join("\n");

const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
const { version } = await fetchLatestBaileysVersion();

const sock = makeWASocket({
  version,
  auth: state,
  printQRInTerminal: false,
  logger: pino({ level: "silent" }),
});

sock.ev.on("creds.update", saveCreds);

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timeout connecting")), 45000);

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      clearTimeout(timer);
      reject(new Error("needs QR again — session not linked"));
      return;
    }

    if (connection === "open") {
      try {
        const all = await sock.groupFetchAllParticipating();
        let best = { jid: "", score: 0, subject: "" };

        console.log("groups:");
        for (const [id, meta] of Object.entries(all)) {
          const subject = String(meta.subject || "");
          const score = scoreSubject(subject, TARGET);
          console.log(` - [${score}] ${subject} | ${id}`);
          if (score > best.score) {
            best = { jid: id, score, subject };
          }
        }

        if (!best.jid || best.score < 50) {
          throw new Error(`group not found for "${TARGET}"`);
        }

        console.log("sending to", best.subject, best.jid);
        await sock.sendMessage(best.jid, { text: message });
        await writeFile(
          STATE_FILE,
          JSON.stringify(
            { groupJid: best.jid, welcomeSent: true, groupSubject: best.subject },
            null,
            2,
          ),
          "utf8",
        );
        console.log("SENT_OK");
        clearTimeout(timer);
        resolve(best);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    }

    if (connection === "close") {
      clearTimeout(timer);
      const code = lastDisconnect?.error?.output?.statusCode;
      reject(new Error(`closed:${code}`));
    }
  });
});

setTimeout(() => process.exit(0), 2000);
