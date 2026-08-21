#!/usr/bin/env node
/**
 * Keep cloud-poller.mjs running with exponential backoff restarts.
 */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const BOT_ENTRY = path.join(__dirname, "cloud-poller.mjs");
const DATA_DIR = path.join(__dirname, ".data");
const LOCK_FILE = path.join(DATA_DIR, "supervise.lock");
const MIN_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;
const HEALTHY_MS = 90_000;

mkdirSync(DATA_DIR, { recursive: true });

let child = null;
let stopping = false;
let backoffMs = MIN_BACKOFF_MS;
let restartCount = 0;

function log(...args) {
  console.log(`[tg-wa-supervise ${new Date().toISOString()}]`, ...args);
}

function pidAlive(pid) {
  if (!pid || !Number.isFinite(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  if (existsSync(LOCK_FILE)) {
    try {
      const pid = Number(readFileSync(LOCK_FILE, "utf8").trim());
      if (pidAlive(pid) && pid !== process.pid) {
        log(`another supervisor already running (pid ${pid}) — exit`);
        process.exit(0);
      }
    } catch {
      // replace stale
    }
  }
  writeFileSync(LOCK_FILE, String(process.pid));
}

function releaseLock() {
  try {
    if (existsSync(LOCK_FILE)) {
      const pid = Number(readFileSync(LOCK_FILE, "utf8").trim());
      if (pid === process.pid) unlinkSync(LOCK_FILE);
    }
  } catch {
    // ignore
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const HEARTBEAT_FILE = path.join(DATA_DIR, "heartbeat.json");
const STALE_HEARTBEAT_MS = Number(process.env.TG_WA_STALE_MS || 180_000);

function heartbeatAgeMs() {
  try {
    if (!existsSync(HEARTBEAT_FILE)) return Infinity;
    const raw = JSON.parse(readFileSync(HEARTBEAT_FILE, "utf8"));
    const at = Date.parse(raw?.at || "");
    if (!Number.isFinite(at)) return Infinity;
    return Date.now() - at;
  } catch {
    return Infinity;
  }
}

function startChild() {
  restartCount += 1;
  const startedAt = Date.now();
  log(`starting poller (attempt #${restartCount})`);

  child = spawn(process.execPath, [BOT_ENTRY], {
    cwd: ROOT,
    env: {
      ...process.env,
      TG_WA_SUPERVISED: "1",
    },
    stdio: "inherit",
  });

  child.on("exit", async (code, signal) => {
    child = null;
    const livedMs = Date.now() - startedAt;
    log(
      `poller exited code=${code} signal=${signal || "-"} lived=${Math.round(livedMs / 1000)}s`,
    );
    if (stopping) return;

    if (livedMs >= HEALTHY_MS) backoffMs = MIN_BACKOFF_MS;
    else backoffMs = Math.min(MAX_BACKOFF_MS, backoffMs * 2);

    log(`restart in ${Math.round(backoffMs / 1000)}s`);
    await sleep(backoffMs);
    if (!stopping) startChild();
  });
}

function watchStaleHeartbeat() {
  setInterval(() => {
    if (stopping || !child) return;
    // Give brand-new child time to write first heartbeat.
    const age = heartbeatAgeMs();
    if (age > STALE_HEARTBEAT_MS) {
      log(
        `stale heartbeat ${Math.round(age / 1000)}s — killing hung poller for restart`,
      );
      try {
        child.kill("SIGTERM");
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
    }
  }, 30_000).unref();
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  log(`received ${signal} — shutting down`);
  if (child) {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  releaseLock();
  setTimeout(() => process.exit(0), 1500).unref();
}

acquireLock();
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("exit", releaseLock);

log("supervisor online");
startChild();
watchStaleHeartbeat();