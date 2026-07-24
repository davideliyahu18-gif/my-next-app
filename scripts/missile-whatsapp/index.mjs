#!/usr/bin/env node
/**
 * בוט WhatsApp מקומי — איראן → כווית (טקסט + סיכת מיקום)
 *
 * בלי Green API. רק:
 *   cd scripts/missile-whatsapp
 *   npm install
 *   npm start
 *   → סרקו QR בוואטסאפ (מכשירים מקושרים)
 *   → הבוט מוצא את הקבוצה «🛡️ מרכז התרעות אזורי» ושולח בדיקה
 */

import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cron from "node-cron";
import pino from "pino";
import qrcode from "qrcode-terminal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const AUTH_DIR = path.join(__dirname, "auth");
const STATE_FILE = path.join(__dirname, "bot-state.json");
const SEEN_FILE = path.join(__dirname, "seen-alerts.json");
const TEST_TRIGGER = path.join(__dirname, "test-trigger.json");
const SEND_NOW_FILE = path.join(__dirname, "send-now.json");
const LATEST_SENT_FILE = path.join(__dirname, "latest-sent.json");

const require = createRequire(import.meta.url);
const baileys = require("@whiskeysockets/baileys");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = baileys;

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

let sock = null;
let groupJid = "";
let pollRunning = false;
let welcomeSent = false;
let cfg = null;

function demoAlert() {
  const now = new Date();
  const clock = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Kuwait",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    hour12: false,
  }).format(now);

  return {
    id: `demo-kuwait-${now.getTime()}`,
    text: [
      "🚨 *התראת שיגור · איראן → כווית*",
      "",
      "📍 משגר (משוער): אזור כרמאנשאה",
      "🎯 יעד (משוער): כווית סיטי",
      "🧭 סוג: בליסטי",
      `🕐 שיגור: ${clock} (שעון כווית)`,
      "⏱ צפי הגעה: 3:30",
      "",
      "🗺 מפה: https://maps.google.com/?q=29.37590,47.97740",
      "מקור: הדגמה מקומית",
      "",
      "⚠️ מיקום מקורב לפי דיווח פומבי/OSINT — לא קואורדינטה צבאית מדויקת.",
    ].join("\n"),
    location: {
      latitude: 29.3759,
      longitude: 47.9774,
      name: "כווית סיטי",
      address: "אזור יעד משוער · כווית סיטי",
    },
    launchLocation: {
      latitude: 34.31,
      longitude: 47.07,
      name: "אזור כרמאנשאה",
      address: "אזור שיגור משוער · אזור כרמאנשאה",
    },
  };
}

async function loadEnvFile() {
  for (const name of [".env.local", ".env"]) {
    const envPath = path.join(ROOT, name);
    if (!existsSync(envPath)) continue;
    const text = await readFile(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx);
      const value = trimmed.slice(idx + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function envConfig() {
  const site =
    process.env.MISSILE_ALERT_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://127.0.0.1:3000";
  const base = site.startsWith("http") ? site : `https://${site}`;
  const sendDemoOnConnect = process.env.MISSILE_SEND_DEMO_ON_CONNECT !== "false";

  return {
    siteUrl: base.replace(/\/$/, ""),
    secret:
      process.env.MISSILE_ALERT_SECRET ||
      process.env.CRON_SECRET ||
      process.env.FEED_API_SECRET ||
      "",
    groupJidEnv:
      process.env.MISSILE_WHATSAPP_CHAT_ID ||
      process.env.WHATSAPP_GROUP_CHAT_ID ||
      "",
    groupName:
      process.env.MISSILE_WHATSAPP_GROUP_NAME || "🛡️ מרכז התרעות אזורי",
    pollCron: process.env.MISSILE_ALERT_POLL_CRON ?? "*/1 * * * *",
    sendLaunchPin: process.env.MISSILE_ALERT_SEND_LAUNCH_PIN !== "false",
    sendDemoOnConnect,
    livePoll: process.env.MISSILE_LIVE_POLL !== "false",
  };
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(subject, wanted) {
  const s = normalizeName(subject);
  const w = normalizeName(wanted);
  if (!s || !w) return false;
  if (s.includes(w) || w.includes(s)) return true;
  // Loose match on core words
  return s.includes("מרכז התרעות") && w.includes("מרכז התרעות");
}

async function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function loadState() {
  const state = await loadJson(STATE_FILE, {});
  if (state.groupJid) groupJid = state.groupJid;
  welcomeSent = Boolean(state.welcomeSent);
}

async function saveState() {
  await writeFile(
    STATE_FILE,
    JSON.stringify({ groupJid, welcomeSent }, null, 2),
    "utf8",
  );
}

async function loadSeen() {
  const data = await loadJson(SEEN_FILE, { ids: [] });
  return new Set(Array.isArray(data.ids) ? data.ids : []);
}

async function markSeen(ids) {
  const seen = await loadSeen();
  for (const id of ids) seen.add(id);
  const trimmed = [...seen].slice(-500);
  await writeFile(SEEN_FILE, JSON.stringify({ ids: trimmed }, null, 2), "utf8");
}

async function apiFetch(pathname, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (cfg.secret) headers.Authorization = `Bearer ${cfg.secret}`;

  const response = await fetch(`${cfg.siteUrl}${pathname}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    throw new Error(
      `API ${pathname} failed: ${response.status} ${text.slice(0, 200)}`,
    );
  }
  return json;
}

async function resolveGroup() {
  if (!sock) return false;
  if (cfg.groupJidEnv) {
    groupJid = cfg.groupJidEnv;
    await saveState();
    return true;
  }
  if (groupJid) return true;

  try {
    const all = await sock.groupFetchAllParticipating();
    const entries = Object.entries(all);
    for (const [jid, meta] of entries) {
      const subject = String(meta.subject || "");
      if (namesMatch(subject, cfg.groupName)) {
        groupJid = jid;
        console.log(`✅ נמצאה הקבוצה: ${subject}`);
        console.log(`   id: ${jid}`);
        await saveState();
        return true;
      }
    }
    console.log("⚠️ לא נמצאה הקבוצה. קבוצות זמינות:");
    for (const [, meta] of entries.slice(0, 30)) {
      console.log(`   - ${meta.subject || "(ללא שם)"}`);
    }
  } catch (error) {
    log.warn({ err: error }, "groupFetchAllParticipating failed");
  }
  return Boolean(groupJid);
}

async function sendLocation(location) {
  if (!sock || !groupJid || !location) return false;
  await sock.sendMessage(groupJid, {
    location: {
      degreesLatitude: location.latitude,
      degreesLongitude: location.longitude,
      name: location.name,
      address: location.address,
    },
  });
  return true;
}

async function sendAlert(alert, options = {}) {
  if (!sock || !groupJid) return false;
  await sock.sendMessage(groupJid, { text: alert.text });
  if (options.textOnly) return true;
  if (alert.location) {
    await sendLocation(alert.location);
  }
  if (cfg.sendLaunchPin && alert.launchLocation) {
    await sendLocation(alert.launchLocation);
  }
  return true;
}

async function sendDemoIfNeeded() {
  if (!cfg.sendDemoOnConnect || welcomeSent) return;
  if (!(await resolveGroup())) return;
  await sendAlert(demoAlert());
  welcomeSent = true;
  await saveState();
  console.log("✅ נשלחה הודעת בדיקה + מיקום לקבוצה");
}

async function pollOnce() {
  if (!cfg.livePoll || pollRunning) return;
  pollRunning = true;
  try {
    if (!(await resolveGroup())) return;

    let alerts = [];
    try {
      const pending = await apiFetch("/api/missile-alerts/pending");
      alerts = Array.isArray(pending.alerts) ? pending.alerts : [];
    } catch (error) {
      log.debug({ err: error }, "Live site poll unavailable (demo-only mode ok)");
      return;
    }

    const seen = await loadSeen();
    const toSend = alerts.filter((a) => a?.id && !seen.has(a.id));
    const sentIds = [];
    for (const alert of toSend) {
      await sendAlert(alert);
      sentIds.push(alert.id);
      log.info({ id: alert.id }, "Sent live missile alert with location");
    }
    if (sentIds.length) {
      await markSeen(sentIds);
      try {
        await apiFetch("/api/missile-alerts/ack", {
          method: "POST",
          body: JSON.stringify({ ids: sentIds }),
        });
      } catch {
        // local seen is enough
      }
    }
  } catch (error) {
    log.error({ err: error }, "Poll failed");
  } finally {
    pollRunning = false;
  }
}

async function handleTestTrigger() {
  if (!existsSync(TEST_TRIGGER)) return;
  try {
    const raw = await readFile(TEST_TRIGGER, "utf8");
    if (!raw.trim()) return;
    JSON.parse(raw);
    await unlink(TEST_TRIGGER).catch(() => {});

    if (!(await resolveGroup())) {
      console.log("⚠️ לא ניתן לשלוח בדיקה — הקבוצה לא נמצאה");
      return;
    }

    await sendAlert(demoAlert());
    console.log("✅ נשלחה הודעת בדיקה + מיקום");
  } catch (error) {
    log.error({ err: error }, "Test trigger failed");
  }
}

async function handleSendNow() {
  if (!existsSync(SEND_NOW_FILE)) return;
  try {
    const raw = await readFile(SEND_NOW_FILE, "utf8");
    if (!raw.trim()) return;
    const payload = JSON.parse(raw);
    await unlink(SEND_NOW_FILE).catch(() => {});

    if (!(await resolveGroup())) {
      console.log("⚠️ לא ניתן לשלוח — הקבוצה לא נמצאה");
      return;
    }

    const alert = payload.alert;
    if (!alert?.text) {
      console.log("⚠️ send-now.json חסר alert.text");
      return;
    }
    if (!payload.textOnly && !alert.location) {
      console.log("⚠️ send-now.json חסר alert.location");
      return;
    }

    await sendAlert(alert, { textOnly: Boolean(payload.textOnly) });
    if (alert.id) await markSeen([alert.id]);
    await writeFile(
      LATEST_SENT_FILE,
      JSON.stringify({ id: alert.id, at: new Date().toISOString() }, null, 2),
      "utf8",
    );
    console.log(`✅ נשלחה התראה חיה: ${alert.id || "unknown"}`);
  } catch (error) {
    log.error({ err: error }, "Send-now failed");
  }
}

async function startSock() {
  await mkdir(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log("\n📱 סרקו את ה-QR בוואטסאפ → מכשירים מקושרים:\n");
      qrcode.generate(qr, { small: true });

      // Also write a scannable PNG for cloud / chat display.
      try {
        const QRCode = require("qrcode");
        const outDirs = [
          path.join(__dirname, "qr.png"),
          "/opt/cursor/artifacts/whatsapp-qr/scan-me.png",
        ];
        for (const out of outDirs) {
          await mkdir(path.dirname(out), { recursive: true }).catch(() => {});
          await QRCode.toFile(out, qr, {
            type: "png",
            width: 512,
            margin: 2,
            errorCorrectionLevel: "M",
          });
          console.log(`QR image saved: ${out}`);
        }
        await writeFile(
          path.join(__dirname, "qr-ready.txt"),
          new Date().toISOString(),
          "utf8",
        );
      } catch (error) {
        console.error("Failed to write QR PNG:", error);
      }
    }
    if (connection === "open") {
      console.log("✅ WhatsApp מחובר");
      await writeFile(
        path.join(__dirname, "connected.txt"),
        new Date().toISOString(),
        "utf8",
      );
      await resolveGroup();
      await sendDemoIfNeeded();
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      log.warn({ code, shouldReconnect }, "WhatsApp disconnected");
      if (shouldReconnect) {
        setTimeout(() => {
          void startSock();
        }, 2500);
      } else {
        console.log("התנתקתם. הריצו שוב npm start וסרקו QR.");
      }
    }
  });
}

async function main() {
  await loadEnvFile();
  cfg = envConfig();
  await loadState();
  await startSock();

  cron.schedule(cfg.pollCron, () => {
    void pollOnce();
  });

  setInterval(() => {
    void handleTestTrigger();
    void handleSendNow();
  }, 2000);

  console.log(
    [
      "",
      "🚀 בוט שיגורים מקומי רץ",
      `קבוצה: ${cfg.groupName}`,
      "אין צורך ב-Green API",
      "אחרי סריקת QR תישלח בדיקה אוטומטית עם מיקום",
      "בדיקה נוספת: npm run test-send",
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
