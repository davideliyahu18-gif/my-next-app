import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const FLIGHTS_BOT_SECRET = process.env.FLIGHTS_BOT_SECRET;
const GROUP_JID = process.env.GROUP_JID || null;

if (!WEBHOOK_URL || !FLIGHTS_BOT_SECRET) {
  console.error("חסר WEBHOOK_URL או FLIGHTS_BOT_SECRET — הגדירו אותם ב-.env (ראו .env.example).");
  process.exit(1);
}

async function askBot(chatId, text) {
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-flights-bot-secret": FLIGHTS_BOT_SECRET,
    },
    body: JSON.stringify({ chatId, text }),
  });

  if (!response.ok) {
    console.error("שגיאה מהשרת:", response.status, await response.text().catch(() => ""));
    return null;
  }

  const data = await response.json();
  return data.reply ?? null;
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\nסרקו את הקוד הזה עם וואטסאפ בטלפון: הגדרות ← מכשירים מקושרים ← קישור מכשיר\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output?.statusCode
          : undefined;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(
        "החיבור נסגר.",
        shouldReconnect ? "מתחבר מחדש..." : "התנתקתם — מחקו את תיקיית auth/ וסרקו QR מחדש.",
      );
      if (shouldReconnect) start();
    } else if (connection === "open") {
      console.log("✅ מחובר לוואטסאפ!");
      console.log(
        GROUP_JID
          ? `מאזין לקבוצה: ${GROUP_JID}`
          : "לא הוגדר GROUP_JID — הבוט יגיב בכל צ׳אט. שלחו הודעה בקבוצה כדי לראות את ה-JID שלה למטה ולהגדיר אותו ב-.env.",
      );
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const chatId = msg.key.remoteJid;
      if (!chatId) continue;

      if (!GROUP_JID) {
        console.log(`[הודעה מ-${chatId}] — כדי להגביל את הבוט לקבוצה הזו: GROUP_JID=${chatId}`);
      } else if (chatId !== GROUP_JID) {
        continue;
      }

      const text =
        msg.message.conversation || msg.message.extendedTextMessage?.text || "";
      if (!text.trim()) continue;

      try {
        const reply = await askBot(chatId, text);
        if (reply) {
          await sock.sendMessage(chatId, { text: reply });
        }
      } catch (error) {
        console.error("שגיאה בטיפול בהודעה:", error);
      }
    }
  });
}

start().catch((error) => {
  console.error("כשל בהפעלת הבוט:", error);
  process.exit(1);
});
