#!/usr/bin/env node
/**
 * Keep the WhatsApp bot running forever.
 * If index.mjs exits for any reason (crash, OOM, disconnect cleanup),
 * restart it with exponential backoff. Healthy runs reset the backoff.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOT_ENTRY = path.join(__dirname, "index.mjs");
const LOCK_FILE = path.join(__dirname, "bot.lock");
const SUPERVISOR_PID = path.join(__dirname, "supervise.pid");
const HEARTBEAT_FILE = path.join(__dirname, "bot-heartbeat.json");

const MIN_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;
const HEALTHY_MS = 90_000;

let child = null;
let stopping = false;
let backoffMs = MIN_BACKOFF_MS;
let restartCount = 0;

function log(...args) {
  const ts = new Date().toISOString();
  console.log(`[supervise ${ts}]`, ...args);
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

function clearStaleLock() {
  if (!existsSync(LOCK_FILE)) return;
  try {
    const raw = readFileSync(LOCK_FILE, "utf8").trim();
    const pid = Number(raw);
    if (pidAlive(pid)) {
      log(`lock held by live pid ${pid} — will not clear`);
      return false;
    }
    unlinkSync(LOCK_FILE);
    log(`cleared stale bot.lock (dead pid ${raw || "?"})`);
    return true;
  } catch (error) {
    log("stale lock cleanup failed:", error?.message || error);
    return false;
  }
}

function writeSupervisorPid() {
  try {
    writeFileSync(SUPERVISOR_PID, String(process.pid));
  } catch {
    // ignore
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startChild() {
  clearStaleLock();
  restartCount += 1;
  const startedAt = Date.now();
  log(`starting bot (attempt #${restartCount})…`);

  child = spawn(process.execPath, [BOT_ENTRY], {
    cwd: path.join(__dirname, "../.."),
    env: {
      ...process.env,
      FLIGHT_DEALS_SUPERVISED: "1",
    },
    stdio: "inherit",
  });

  const childPid = child.pid;
  child.on("exit", (code, signal) => {
    child = null;
    const livedMs = Date.now() - startedAt;
    log(
      `bot exited code=${code} signal=${signal || "-"} lived=${Math.round(livedMs / 1000)}s`,
    );

    if (stopping) {
      log("supervisor stopping — not restarting");
      return;
    }

    // Intentional clean stop from inside the bot (SIGINT already handled).
    if (code === 0 && signal == null) {
      // Still restart — the bot should stay up unless supervisor is stopped.
      log("clean exit — restarting anyway to keep watches alive");
    }

    if (livedMs >= HEALTHY_MS) {
      backoffMs = MIN_BACKOFF_MS;
    } else {
      backoffMs = Math.min(MAX_BACKOFF_MS, Math.round(backoffMs * 1.6));
    }

    const wait = backoffMs;
    log(`restarting in ${Math.round(wait / 1000)}s…`);
    setTimeout(() => {
      if (!stopping) startChild();
    }, wait);
  });

  child.on("error", (error) => {
    log("failed to spawn bot:", error?.message || error);
    child = null;
    if (!stopping) {
      setTimeout(() => startChild(), backoffMs);
    }
  });

  return childPid;
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  log(`received ${signal} — shutting down child`);
  try {
    if (child?.pid) child.kill("SIGTERM");
  } catch {
    // ignore
  }
  setTimeout(() => {
    try {
      if (child?.pid) child.kill("SIGKILL");
    } catch {
      // ignore
    }
    try {
      unlinkSync(SUPERVISOR_PID);
    } catch {
      // ignore
    }
    process.exit(0);
  }, 8_000).unref?.();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
  log("supervisor uncaughtException:", error?.stack || error);
});
process.on("unhandledRejection", (error) => {
  log("supervisor unhandledRejection:", error?.stack || error);
});

writeSupervisorPid();
log(`supervisor online pid=${process.pid}`);
log(`heartbeat file: ${HEARTBEAT_FILE}`);
startChild();
