#!/usr/bin/env node
/**
 * Cloud poller: poll local/site FIFA bot dry API and fan-out via Green API.
 * MAIN = all except corners; VIP = all except open-play goals.
 *
 * Adaptive interval: ~5s while live / near kickoff, slower when idle.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

async function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(ROOT, name);
    if (!existsSync(p)) continue;
    const text = await readFile(p, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i);
      const v = t.slice(i + 1);
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

function channelsForAlert(kind) {
  const channels = [];
  if (kind !== "corner") channels.push("main");
  if (kind !== "goal" && kind !== "goal_scorer") channels.push("vip");
  return channels;
}

function cfg() {
  const site = (
    process.env.FIFA_BOT_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://127.0.0.1:3010"
  ).replace(/\/$/, "");
  const liveMs = Number(process.env.FIFA_BOT_POLL_MS || "3000");
  const idleMs = Number(process.env.FIFA_BOT_IDLE_POLL_MS || "15000");
  return {
    site,
    secret:
      process.env.FIFA_BOT_SECRET ||
      process.env.CRON_SECRET ||
      process.env.FEED_API_SECRET ||
      "test",
    instance: process.env.GREEN_API_INSTANCE || "",
    token: process.env.GREEN_API_TOKEN || "",
    apiHost: process.env.GREEN_API_HOST || "https://7107.api.green-api.com",
    mainChat:
      process.env.FIFA_WHATSAPP_MAIN_CHAT_ID || "120363410010039894@g.us",
    vipChat:
      process.env.FIFA_WHATSAPP_VIP_CHAT_ID || "120363427162994986@g.us",
    liveMs: Number.isFinite(liveMs) && liveMs >= 2000 ? liveMs : 3000,
    idleMs: Number.isFinite(idleMs) && idleMs >= 5000 ? idleMs : 15000,
  };
}

async function sendGreen(c, chatId, message) {
  const url = `${c.apiHost}/waInstance${c.instance}/sendMessage/${c.token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Green send ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

async function pollOnce(c) {
  const started = Date.now();
  // Prefer server-side Green sends (no dry) so alerts aren't lost to a concurrent dry consumer.
  const res = await fetch(`${c.site}/api/cron/fifa-bot`, {
    headers: { Authorization: `Bearer ${c.secret}` },
    cache: "no-store",
  });
  const summary = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(summary));
  const alerts = Array.isArray(summary.alerts) ? summary.alerts : [];
  const notified = Number(summary.notified || 0);
  const liveMatches = Number(summary.liveMatches || 0);
  const upcomingMatches = Number(summary.upcomingMatches || 0);

  // Fallback: if the site returned alerts but notified nothing (no Green on server),
  // fan-out from this poller.
  let sent = notified;
  if (alerts.length && notified === 0) {
    for (const alert of alerts) {
      if (!alert?.text) continue;
      const channels = channelsForAlert(alert.kind);
      await Promise.all(
        channels.map(async (channel) => {
          const chatId = channel === "main" ? c.mainChat : c.vipChat;
          await sendGreen(c, chatId, alert.text);
          sent += 1;
          console.log(new Date().toISOString(), "sent", channel, alert.kind);
        }),
      );
    }
  } else if (notified > 0) {
    for (const alert of alerts) {
      console.log(new Date().toISOString(), "notified", alert.kind);
    }
  }

  if (!alerts.length) {
    console.log(
      new Date().toISOString(),
      "ok live=",
      liveMatches,
      "upcoming=",
      upcomingMatches,
      "ms=",
      Date.now() - started,
    );
  }
  return { sent, liveMatches, upcomingMatches, alerts: alerts.length };
}

function nextIntervalMs(c, result) {
  if (!result) return c.liveMs;
  if (result.liveMatches > 0 || result.alerts > 0) return c.liveMs;
  // Keep scanning fast while there is an upcoming match on the board.
  if (result.upcomingMatches > 0) return c.liveMs;
  return c.idleMs;
}

async function main() {
  await loadEnv();
  const c = cfg();
  if (!c.instance || !c.token) {
    console.error("Missing GREEN_API_INSTANCE / GREEN_API_TOKEN in .env.local");
    process.exit(1);
  }
  console.log("FIFA cloud poller starting (fast mode)");
  console.log(" site=", c.site);
  console.log(" liveMs=", c.liveMs, "idleMs=", c.idleMs);
  console.log(" main=", c.mainChat);
  console.log(" vip=", c.vipChat);

  let last = null;
  for (;;) {
    const tickStart = Date.now();
    try {
      last = await pollOnce(c);
    } catch (error) {
      console.error(new Date().toISOString(), "poll error", String(error));
    }
    const interval = nextIntervalMs(c, last);
    const elapsed = Date.now() - tickStart;
    const wait = Math.max(250, interval - elapsed);
    await new Promise((r) => setTimeout(r, wait));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
