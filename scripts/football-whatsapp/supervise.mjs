#!/usr/bin/env node
/**
 * Auto-restart supervisor for the WhatsApp football bot.
 * Restarts on crash / stale heartbeat. After any exit, waits before
 * respawning so WhatsApp can drop the previous multi-device session
 * (avoids 428 "connection replaced" fight loops).
 */
import { spawn } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(__dirname, "index.mjs");
const HEARTBEAT_FILE = path.join(__dirname, "heartbeat.json");
const LOCK_FILE = path.join(__dirname, "bot.lock");
const MIN_UPTIME_MS = 20_000;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 30_000;
/** If heartbeat is older than this, kill and restart the child. */
const HEARTBEAT_STALE_MS = 120_000;
const HEARTBEAT_CHECK_MS = 25_000;
/** Grace period after spawn before enforcing heartbeat. */
const HEARTBEAT_GRACE_MS = 90_000;

let delay = BASE_DELAY_MS;
let child = null;
let stopping = false;
let startedAt = 0;
let healthTimer = null;

async function readHeartbeat() {
  if (!existsSync(HEARTBEAT_FILE)) return null;
  try {
    const raw = await readFile(HEARTBEAT_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearHealthTimer() {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
}

function clearStaleLock() {
  if (!existsSync(LOCK_FILE)) return;
  try {
    const raw = readFileSync(LOCK_FILE, "utf8");
    const pid = Number(String(raw).trim().split("\n")[0]);
    if (pid && existsSync(`/proc/${pid}`)) return;
    unlinkSync(LOCK_FILE);
  } catch {
    try {
      unlinkSync(LOCK_FILE);
    } catch {
      /* ignore */
    }
  }
}

function startHealthWatcher() {
  clearHealthTimer();
  healthTimer = setInterval(async () => {
    if (stopping || !child) return;
    const age = Date.now() - startedAt;
    if (age < HEARTBEAT_GRACE_MS) return;
    const hb = await readHeartbeat();
    const hbAge = hb?.ts ? Date.now() - Number(hb.ts) : Infinity;
    if (hbAge <= HEARTBEAT_STALE_MS) return;

    console.error(
      `🛡️  supervisor: heartbeat stale (${Math.round(hbAge / 1000)}s) — killing hung bot for fast restart`,
    );
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      if (child) {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }
    }, 8_000);
  }, HEARTBEAT_CHECK_MS);
  if (typeof healthTimer.unref === "function") healthTimer.unref();
}

function start() {
  startedAt = Date.now();
  console.log(`\n🛡️  supervisor: starting bot (${new Date().toISOString()})`);
  clearStaleLock();
  try {
    if (existsSync(HEARTBEAT_FILE)) unlink(HEARTBEAT_FILE).catch(() => {});
  } catch {
    /* ignore */
  }
  // Placeholder heartbeat so we don't false-kill during WA connect.
  writeFile(
    HEARTBEAT_FILE,
    JSON.stringify({
      at: new Date().toISOString(),
      ts: Date.now(),
      pid: null,
      waConnected: false,
      bootstrapping: true,
    }),
    "utf8",
  ).catch(() => {});

  child = spawn(process.execPath, [ENTRY], {
    cwd: __dirname,
    stdio: "inherit",
    env: process.env,
  });

  startHealthWatcher();

  child.on("exit", (code, signal) => {
    child = null;
    clearHealthTimer();
    if (stopping) {
      console.log("🛡️  supervisor: stopped");
      process.exit(code ?? 0);
      return;
    }
    const uptime = Date.now() - startedAt;
    if (uptime > MIN_UPTIME_MS) delay = BASE_DELAY_MS;
    else delay = Math.min(MAX_DELAY_MS, Math.max(BASE_DELAY_MS, delay * 2));

    // Always wait so WhatsApp releases the multi-device session.
    const restartIn = Math.max(delay, signal === "SIGTERM" ? 8_000 : 5_000);

    console.error(
      `🛡️  supervisor: bot exited code=${code} signal=${signal} uptime=${Math.round(uptime / 1000)}s — restart in ${Math.round(restartIn / 1000)}s`,
    );
    setTimeout(start, restartIn);
  });
}

function shutdown(signal) {
  stopping = true;
  clearHealthTimer();
  console.log(`🛡️  supervisor: received ${signal}`);
  if (child) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      if (child) {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }
      process.exit(0);
    }, 8_000);
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
