#!/usr/bin/env node
/**
 * Cloud poller: poll local/site FIFA bot dry API and fan-out via Green API.
 * MAIN = all except corners; VIP = all except open-play goals.
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
    intervalMs: Number(process.env.FIFA_BOT_POLL_MS || "45000"),
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
  const res = await fetch(`${c.site}/api/cron/fifa-bot?dry=1`, {
    headers: { Authorization: `Bearer ${c.secret}` },
  });
  const summary = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(summary));
  const alerts = Array.isArray(summary.alerts) ? summary.alerts : [];
  let sent = 0;
  for (const alert of alerts) {
    if (!alert?.text) continue;
    for (const channel of channelsForAlert(alert.kind)) {
      const chatId = channel === "main" ? c.mainChat : c.vipChat;
      await sendGreen(c, chatId, alert.text);
      sent += 1;
      console.log(new Date().toISOString(), "sent", channel, alert.kind);
    }
  }
  if (!alerts.length) {
    console.log(
      new Date().toISOString(),
      "ok live=",
      summary.liveMatches,
      "upcoming=",
      summary.upcomingMatches,
    );
  }
  return sent;
}

async function main() {
  await loadEnv();
  const c = cfg();
  if (!c.instance || !c.token) {
    console.error("Missing GREEN_API_INSTANCE / GREEN_API_TOKEN in .env.local");
    process.exit(1);
  }
  console.log("FIFA cloud poller starting");
  console.log(" site=", c.site);
  console.log(" intervalMs=", c.intervalMs);
  console.log(" main=", c.mainChat);
  console.log(" vip=", c.vipChat);

  for (;;) {
    try {
      await pollOnce(c);
    } catch (error) {
      console.error(new Date().toISOString(), "poll error", String(error));
    }
    await new Promise((r) => setTimeout(r, c.intervalMs));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
