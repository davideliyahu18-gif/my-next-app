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
import {
  scrapeOsintMessages,
  messagesToLocalAlerts,
} from "./local-osint.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const AUTH_DIR = path.join(__dirname, "auth");
const STATE_FILE = path.join(__dirname, "bot-state.json");
const SEEN_FILE = path.join(__dirname, "seen-alerts.json");
const OUTBOX_FILE = path.join(__dirname, "outbox.json");
const HEARTBEAT_FILE = path.join(__dirname, "heartbeat.json");
const TEST_TRIGGER = path.join(__dirname, "test-trigger.json");
const SEND_NOW_FILE = path.join(__dirname, "send-now.json");
const CATCHUP_BATCH_FILE = path.join(__dirname, "catchup-batch.json");
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
let drainRunning = false;
let welcomeSent = false;
let cfg = null;
let waOpen = false;
let lastRateLimitAt = 0;
let stats = {
  polls: 0,
  apiOk: 0,
  apiFail: 0,
  localOk: 0,
  enqueued: 0,
  sent: 0,
  sendFail: 0,
  disconnects: 0,
};

function boldEveryLine(text) {
  return String(text || "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (/^\*[^*].*\*$/.test(trimmed) && !trimmed.slice(1, -1).includes("*")) {
        return trimmed;
      }
      return `*${trimmed.replace(/\*/g, "")}*`;
    })
    .join("\n");
}

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
    text: boldEveryLine(
      [
        "🚨 התראת שיגור · איראן → כווית",
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
    ),
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
    pollSeconds: Number(process.env.MISSILE_ALERT_POLL_SECONDS || 30),
    sendLaunchPin: process.env.MISSILE_ALERT_SEND_LAUNCH_PIN !== "false",
    sendDemoOnConnect,
    livePoll: process.env.MISSILE_LIVE_POLL !== "false",
    autoMode: process.env.MISSILE_AUTO_MODE !== "false",
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

/** Same Telegram post may appear as tg- / gulf- / air- depending on parser path. */
function idVariants(id) {
  const raw = String(id || "");
  if (!raw) return [];
  const base = raw.replace(/^(gulf-|tg-|air-)/, "");
  return [...new Set([raw, base, `gulf-${base}`, `tg-${base}`, `air-${base}`])];
}

function hasSeenId(seen, id) {
  return idVariants(id).some((v) => seen.has(v));
}

async function markSeen(ids) {
  const seen = await loadSeen();
  for (const id of ids) {
    for (const v of idVariants(id)) seen.add(v);
  }
  const trimmed = [...seen].slice(-1200);
  await writeFile(SEEN_FILE, JSON.stringify({ ids: trimmed }, null, 2), "utf8");
}

async function loadOutbox() {
  const data = await loadJson(OUTBOX_FILE, { alerts: [] });
  return Array.isArray(data.alerts) ? data.alerts : [];
}

async function saveOutbox(alerts) {
  const trimmed = alerts.slice(-200);
  await writeFile(
    OUTBOX_FILE,
    JSON.stringify({ alerts: trimmed, updatedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
}

async function enqueueAlerts(alerts) {
  if (!alerts.length) return 0;
  const seen = await loadSeen();
  const outbox = await loadOutbox();
  const inOutbox = new Set();
  for (const a of outbox) {
    for (const v of idVariants(a.id)) inOutbox.add(v);
  }
  let added = 0;
  for (const alert of alerts) {
    if (!alert?.id || !alert?.text) continue;
    if (hasSeenId(seen, alert.id) || hasSeenId(inOutbox, alert.id)) continue;
    outbox.push(alert);
    for (const v of idVariants(alert.id)) inOutbox.add(v);
    added += 1;
  }
  if (added) {
    await saveOutbox(outbox);
    stats.enqueued += added;
    console.log(`📥 לתור שליחה: +${added} (סה״כ בתור ${outbox.length})`);
  }
  return added;
}

async function writeHeartbeat(extra = {}) {
  const payload = {
    at: new Date().toISOString(),
    waOpen,
    groupJid: groupJid || null,
    outbox: (await loadOutbox()).length,
    seen: (await loadSeen()).size,
    rateLimitedUntil:
      lastRateLimitAt && Date.now() - lastRateLimitAt < 60_000
        ? new Date(lastRateLimitAt + 60_000).toISOString()
        : null,
    stats,
    ...extra,
  };
  await writeFile(HEARTBEAT_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function isRateLimitError(error) {
  const msg = String(error?.message || error || "");
  return (
    /rate-overlimit|rate.?limit|429/i.test(msg) ||
    error?.data === 429 ||
    error?.output?.statusCode === 429
  );
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
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
  if (!sock || !groupJid || !waOpen) return false;
  if (lastRateLimitAt && Date.now() - lastRateLimitAt < 60_000) {
    return false;
  }
  try {
    const text = boldEveryLine(alert.text);
    await sock.sendMessage(groupJid, { text });
    if (options.textOnly) {
      await writeFile(
        LATEST_SENT_FILE,
        JSON.stringify(
          { id: alert.id || null, at: new Date().toISOString(), ok: true },
          null,
          2,
        ),
        "utf8",
      );
      return true;
    }
    if (alert.location) {
      await sendLocation(alert.location);
      await sleep(800);
    }
    if (cfg.sendLaunchPin && alert.launchLocation) {
      await sendLocation(alert.launchLocation);
    }
    await writeFile(
      LATEST_SENT_FILE,
      JSON.stringify(
        { id: alert.id || null, at: new Date().toISOString(), ok: true },
        null,
        2,
      ),
      "utf8",
    );
    return true;
  } catch (error) {
    if (isRateLimitError(error)) {
      lastRateLimitAt = Date.now();
      console.error("⏳ WhatsApp rate-limit — משהים שליחות ל־60ש׳:", alert?.id);
    } else {
      console.error("❌ שליחה נכשלה — נשאר בתור:", alert?.id, error?.message || error);
    }
    stats.sendFail += 1;
    return false;
  }
}

async function drainOutbox() {
  if (drainRunning) return;
  if (!waOpen || !sock) return;
  if (lastRateLimitAt && Date.now() - lastRateLimitAt < 60_000) return;
  drainRunning = true;
  try {
    if (!(await resolveGroup())) return;
    const outbox = await loadOutbox();
    if (!outbox.length) return;

    const sentIds = [];
    let stopAt = -1;
    for (let i = 0; i < outbox.length; i += 1) {
      if (lastRateLimitAt && Date.now() - lastRateLimitAt < 60_000) {
        stopAt = i;
        break;
      }
      const alert = outbox[i];
      const ok = await sendAlert(alert, { textOnly: !alert.location });
      if (!ok) {
        stopAt = i;
        break;
      }
      sentIds.push(alert.id);
      stats.sent += 1;
      log.info({ id: alert.id }, "Sent alert from outbox");
      await sleep(2200);
    }

    const remain =
      stopAt === -1 ? [] : outbox.slice(stopAt).filter((a) => a?.id);
    await saveOutbox(remain);

    if (sentIds.length) {
      await markSeen(sentIds);
      try {
        await apiFetch("/api/missile-alerts/ack", {
          method: "POST",
          body: JSON.stringify({ ids: sentIds }),
        });
      } catch {
        // local seen/outbox is enough
      }
    }
  } catch (error) {
    log.error({ err: error }, "drainOutbox failed");
  } finally {
    drainRunning = false;
    await writeHeartbeat({ phase: "drain" });
  }
}

async function sendDemoIfNeeded() {
  if (!cfg.sendDemoOnConnect || welcomeSent) return;
  if (!(await resolveGroup())) return;
  await sendAlert(demoAlert());
  welcomeSent = true;
  await saveState();
  console.log("✅ נשלחה הודעת בדיקה + מיקום לקבוצה");
}

async function collectPendingAlerts() {
  const byId = new Map();
  let apiAlerts = [];
  let localAlerts = [];

  try {
    const pending = await apiFetch("/api/missile-alerts/pending");
    apiAlerts = Array.isArray(pending.alerts) ? pending.alerts : [];
    stats.apiOk += 1;
    for (const alert of apiAlerts) {
      if (alert?.id) byId.set(alert.id, alert);
    }
  } catch (error) {
    stats.apiFail += 1;
    log.warn(
      { err: error?.message || error },
      "Next pending API unavailable — using local Telegram scrape",
    );
  }

  try {
    const { messages, errors } = await scrapeOsintMessages();
    localAlerts = messagesToLocalAlerts(messages);
    stats.localOk += 1;
    if (errors.length) {
      log.warn({ errors: errors.slice(0, 5) }, "Some Telegram channels failed");
    }
    for (const alert of localAlerts) {
      if (alert?.id && !byId.has(alert.id)) byId.set(alert.id, alert);
    }
  } catch (error) {
    log.error({ err: error }, "Local OSINT scrape failed");
  }

  return [...byId.values()];
}

async function pollOnce() {
  if (!cfg.livePoll || pollRunning) return;
  pollRunning = true;
  stats.polls += 1;
  try {
    const alerts = await collectPendingAlerts();
    const seen = await loadSeen();
    const fresh = alerts.filter((a) => a?.id && !hasSeenId(seen, a.id));
    await enqueueAlerts(fresh);
    // Always try to drain — even if WA was briefly down, outbox holds work.
    await drainOutbox();
    await writeHeartbeat({
      phase: "poll",
      lastFresh: fresh.length,
      lastCollected: alerts.length,
    });
  } catch (error) {
    log.error({ err: error }, "Poll failed");
    await writeHeartbeat({ phase: "poll-error", error: String(error?.message || error) });
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

async function handleCatchupBatch() {
  if (!existsSync(CATCHUP_BATCH_FILE)) return;
  try {
    const raw = await readFile(CATCHUP_BATCH_FILE, "utf8");
    if (!raw.trim()) return;
    const payload = JSON.parse(raw);
    await unlink(CATCHUP_BATCH_FILE).catch(() => {});
    if (!(await resolveGroup())) return;
    const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
    const seen = await loadSeen();
    for (const alert of alerts) {
      if (!alert?.id || !alert?.text) continue;
      if (hasSeenId(seen, alert.id)) continue;
      const ok = await sendAlert(alert, { textOnly: !alert.location });
      if (ok) {
        await markSeen([alert.id]);
        console.log(`✅ catch-up נשלח: ${alert.id}`);
        await sleep(2000);
      } else {
        console.error(`❌ catch-up נכשל — ל-outbox: ${alert.id}`);
        await enqueueAlerts([alert]);
      }
    }
  } catch (error) {
    log.error({ err: error }, "Catch-up batch failed");
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

    const ok = await sendAlert(alert, { textOnly: Boolean(payload.textOnly) });
    if (!ok) {
      console.error("❌ send-now נכשל זמנית — נכנס ל-outbox:", alert.id);
      await enqueueAlerts([alert]);
      return;
    }
    if (alert.id) await markSeen([alert.id]);
    console.log(`✅ נשלחה התראה חיה: ${alert.id || "unknown"}`);
    if (payload.thenBatch) {
      await handleCatchupBatch();
    }
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
      waOpen = true;
      console.log("✅ WhatsApp מחובר");
      await writeFile(
        path.join(__dirname, "connected.txt"),
        new Date().toISOString(),
        "utf8",
      );
      await resolveGroup();
      await sendDemoIfNeeded();
      // Flush anything queued while disconnected / rate-limited.
      setTimeout(() => {
        void drainOutbox();
      }, 2500);
      await writeHeartbeat({ phase: "connected" });
    }
    if (connection === "close") {
      waOpen = false;
      stats.disconnects += 1;
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      log.warn({ code, shouldReconnect }, "WhatsApp disconnected");
      await writeHeartbeat({ phase: "disconnected", code });
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

  // Auto mode: poll frequently and send new OSINT alerts alone.
  const seconds = Number.isFinite(cfg.pollSeconds) && cfg.pollSeconds > 5
    ? cfg.pollSeconds
    : 30;

  if (cfg.livePoll || cfg.autoMode) {
    setInterval(() => {
      void pollOnce();
    }, seconds * 1000);
    // First poll shortly after connect.
    setTimeout(() => {
      void pollOnce();
    }, 8000);
  }

  // Single cron backup (interval is primary). Avoid double-burst with long drain.
  cron.schedule(cfg.pollCron, () => {
    if (!pollRunning && !drainRunning) void pollOnce();
  });

  setInterval(() => {
    void handleTestTrigger();
    void handleSendNow();
    void handleCatchupBatch();
    // Opportunistic drain if rate-limit window ended.
    if (!pollRunning) void drainOutbox();
  }, 2000);

  setInterval(() => {
    void writeHeartbeat({ phase: "tick" });
  }, 30_000);

  console.log(
    [
      "",
      "🚀 בוט שיגורים · מצב אוטומטי + תור שליחה",
      `קבוצה: ${cfg.groupName}`,
      `סריקת OSINT כל ${seconds} שניות (Next API + סריקה מקומית)`,
      "אם WhatsApp מתנתק / rate-limit — ההתראות נשמרות ב-outbox ונשלחות בחיבור מחדש",
      "⚠️ חייב לרוץ על מכונה דולקת 24/7 (Cloud Agent שנכבה = פספוסים)",
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
