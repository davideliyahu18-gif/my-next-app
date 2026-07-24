#!/usr/bin/env node
/**
 * Iran → Kuwait missile alert WhatsApp bot (Baileys).
 *
 * Sends text + native WhatsApp location pin(s) to a group.
 * Polls the Next.js cron endpoint every minute (or local schedule).
 *
 * Setup:
 *   1. cd scripts/missile-whatsapp && npm install
 *   2. Set MISSILE_WHATSAPP_GROUP_NAME or MISSILE_WHATSAPP_CHAT_ID in .env.local
 *   3. npm start  → scan QR once
 *   4. Optional: MISSILE_ALERT_SITE_URL=http://127.0.0.1:3000
 */

import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
let cfg = null;

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
      process.env.MISSILE_WHATSAPP_GROUP_NAME || "התראות שיגורים כווית",
    pollCron: process.env.MISSILE_ALERT_POLL_CRON ?? "*/1 * * * *",
    sendLaunchPin: process.env.MISSILE_ALERT_SEND_LAUNCH_PIN !== "false",
  };
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
}

async function saveState() {
  await writeFile(
    STATE_FILE,
    JSON.stringify({ groupJid }, null, 2),
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
    for (const [jid, meta] of Object.entries(all)) {
      const subject = String(meta.subject || "").toLowerCase();
      const wanted = cfg.groupName.toLowerCase();
      if (subject.includes(wanted) || wanted.includes(subject)) {
        groupJid = jid;
        log.info({ jid, subject: meta.subject }, "Resolved WhatsApp group");
        await saveState();
        return true;
      }
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

async function sendAlert(alert) {
  if (!sock || !groupJid) return false;
  await sock.sendMessage(groupJid, { text: alert.text });
  await sendLocation(alert.location);
  if (cfg.sendLaunchPin && alert.launchLocation) {
    await sendLocation(alert.launchLocation);
  }
  return true;
}

async function pollOnce() {
  if (pollRunning) return;
  pollRunning = true;
  try {
    if (!(await resolveGroup())) {
      log.warn("WhatsApp group not resolved yet");
      return;
    }

    // Dry poll on server to discover candidates without Green API send.
    const summary = await apiFetch("/api/cron/missile-alerts?dry=1");
    const alertIds = Array.isArray(summary.alertIds) ? summary.alertIds : [];
    if (!alertIds.length) {
      log.debug({ summary }, "No fresh missile alerts");
      return;
    }

    const seen = await loadSeen();
    const freshIds = alertIds.filter((id) => !seen.has(id));
    if (!freshIds.length) return;

    // Ask server for a demo payload only when testing; for live IDs rebuild via test endpoint shape.
    // Prefer re-fetching dry summary with demo if only demo ids — otherwise send reconstructed text from cron preview.
    // Server dry mode does not return full alert bodies; use test endpoint for demo, else re-run with Baileys-only notify.
    // Workaround: call dedicated endpoint that returns pending alert bodies.
    const pending = await apiFetch("/api/missile-alerts/pending");
    const alerts = Array.isArray(pending.alerts) ? pending.alerts : [];
    const toSend = alerts.filter((a) => freshIds.includes(a.id));

    const sentIds = [];
    for (const alert of toSend) {
      await sendAlert(alert);
      sentIds.push(alert.id);
      log.info({ id: alert.id }, "Sent missile alert with location");
    }
    if (sentIds.length) {
      await markSeen(sentIds);
      try {
        await apiFetch("/api/missile-alerts/ack", {
          method: "POST",
          body: JSON.stringify({ ids: sentIds }),
        });
      } catch (error) {
        log.warn({ err: error }, "Server ack failed (local seen still saved)");
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
    const payload = JSON.parse(await readFile(TEST_TRIGGER, "utf8"));
    await writeFile(TEST_TRIGGER + ".done", JSON.stringify(payload), "utf8");
    // Remove trigger so it only fires once
    await writeFile(TEST_TRIGGER, "", "utf8");

    if (!(await resolveGroup())) {
      log.warn("Cannot send test — group not resolved");
      return;
    }

    const result = await apiFetch("/api/missile-alerts/preview-demo");
    if (result?.alert) {
      await sendAlert(result.alert);
      log.info("Sent demo missile alert with location");
    }
  } catch (error) {
    log.error({ err: error }, "Test trigger failed");
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
      console.log("\nScan this QR with WhatsApp → Linked Devices:\n");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      log.info("WhatsApp connected");
      await resolveGroup();
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      log.warn({ code, shouldReconnect }, "WhatsApp disconnected");
      if (shouldReconnect) {
        setTimeout(() => {
          void startSock();
        }, 2500);
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
  }, 4000);

  console.log(
    [
      "Missile WhatsApp bot running.",
      `Site: ${cfg.siteUrl}`,
      `Group name hint: ${cfg.groupName}`,
      `Cron: ${cfg.pollCron}`,
      "Queue a demo with: npm run test-send",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
