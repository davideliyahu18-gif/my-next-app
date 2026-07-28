#!/usr/bin/env node
/**
 * Ensure the football WhatsApp bot is running.
 * - If healthy OR reconnecting → do nothing (never kill / never double-start).
 * - If supervisor already up → leave it alone.
 * - If down → start under supervisor in the background.
 *
 * Usage: node ensure-up.mjs
 */
import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HEARTBEAT_FILE = path.join(__dirname, "heartbeat.json");
const LOCK_FILE = path.join(__dirname, "bot.lock");
const SUPERVISE = path.join(__dirname, "supervise.mjs");
const FRESH_MS = 120_000;

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function pidAlive(pid) {
  if (!pid) return false;
  return existsSync(`/proc/${pid}`);
}

function processArgs() {
  try {
    return execSync("ps -eo args=", { encoding: "utf8" }).split("\n");
  } catch {
    return [];
  }
}

function indexProcessRunning() {
  return processArgs().some(
    (line) =>
      line.includes("football-whatsapp/index.mjs") &&
      !line.includes("ensure-up"),
  );
}

function supervisingRunning() {
  return processArgs().some(
    (line) =>
      line.includes("football-whatsapp/supervise.mjs") ||
      line.includes("football-bot:start"),
  );
}

function lockPidAlive() {
  if (!existsSync(LOCK_FILE)) return null;
  try {
    const lockPid = Number(
      String(readFileSync(LOCK_FILE, "utf8")).trim().split("\n")[0],
    );
    if (lockPid && pidAlive(lockPid)) return lockPid;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Healthy = live process that owns the bot, even mid-reconnect.
 * Starting a second instance during reconnect causes 428 and kills the first.
 */
function botHealthy() {
  const liveLock = lockPidAlive();
  if (liveLock) {
    return { ok: true, reason: `lock-pid=${liveLock}` };
  }

  if (indexProcessRunning()) {
    return { ok: true, reason: "index-process-alive" };
  }

  if (supervisingRunning()) {
    return { ok: true, reason: "supervisor-alive" };
  }

  const hb = readJson(HEARTBEAT_FILE);
  if (!hb?.ts) return { ok: false, reason: "no-heartbeat" };
  if (Date.now() - Number(hb.ts) > FRESH_MS) {
    return { ok: false, reason: "stale-heartbeat" };
  }
  if (hb.bootstrapping) return { ok: true, reason: "bootstrapping" };
  if (hb.waConnected && (!hb.pid || pidAlive(hb.pid))) {
    return { ok: true, reason: "heartbeat-connected" };
  }
  return { ok: false, reason: "not-connected" };
}

const health = botHealthy();
if (health.ok) {
  const hb = readJson(HEARTBEAT_FILE);
  console.log(
    `ALREADY_UP reason=${health.reason} waConnected=${hb?.waConnected ?? "?"} pid=${hb?.pid ?? liveLockDisplay()} age=${hb?.ts ? Math.round((Date.now() - hb.ts) / 1000) : "?"}s`,
  );
  process.exit(0);
}

function liveLockDisplay() {
  return lockPidAlive() ?? "?";
}

console.log(`BOT_DOWN (${health.reason}) — starting supervisor…`);
const child = spawn(process.execPath, [SUPERVISE], {
  cwd: __dirname,
  detached: true,
  stdio: "ignore",
  env: process.env,
});
child.unref();
console.log(`STARTED_SUPERVISOR pid=${child.pid}`);
