#!/usr/bin/env node
/**
 * Ensure the football WhatsApp bot is running.
 * - If healthy → do nothing (never kill a live session).
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
const FRESH_MS = 90_000;

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

function botHealthy() {
  const hb = readJson(HEARTBEAT_FILE);
  if (!hb?.ts) return false;
  if (Date.now() - Number(hb.ts) > FRESH_MS) return false;

  if (existsSync(LOCK_FILE)) {
    try {
      const lockPid = Number(
        String(readFileSync(LOCK_FILE, "utf8")).trim().split("\n")[0],
      );
      if (lockPid && pidAlive(lockPid) && hb.waConnected) return true;
      if (lockPid && pidAlive(lockPid) && hb.bootstrapping) return true;
    } catch {
      /* ignore */
    }
  }

  if (hb.bootstrapping) return true;
  if (hb.waConnected && (!hb.pid || pidAlive(hb.pid))) return true;
  return false;
}

function supervisingRunning() {
  try {
    const out = execSync("ps -eo args=", { encoding: "utf8" });
    return out
      .split("\n")
      .some((line) => line.includes("football-whatsapp/supervise.mjs"));
  } catch {
    return false;
  }
}

if (botHealthy()) {
  const hb = readJson(HEARTBEAT_FILE);
  console.log(
    `ALREADY_UP waConnected=${hb?.waConnected} pid=${hb?.pid ?? "?"} age=${Math.round((Date.now() - hb.ts) / 1000)}s`,
  );
  process.exit(0);
}

if (supervisingRunning()) {
  console.log(
    "SUPERVISOR_RUNNING — waiting for child heal (not starting duplicate)",
  );
  process.exit(0);
}

console.log("BOT_DOWN — starting supervisor…");
const child = spawn(process.execPath, [SUPERVISE], {
  cwd: __dirname,
  detached: true,
  stdio: "ignore",
  env: process.env,
});
child.unref();
console.log(`STARTED_SUPERVISOR pid=${child.pid}`);
