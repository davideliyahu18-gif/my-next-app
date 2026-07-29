#!/usr/bin/env node
/**
 * Auto-restart supervisor for the WhatsApp football bot.
 *
 * Critical rules:
 * - Never SIGKILL a child that is not the one we decided to kill
 *   (a pending kill timer must not murder the replacement process).
 * - After VM sleep / clock jumps, heartbeat age can look huge even
 *   while the bot is fine — require a few consecutive stale reads and
 *   prefer process-liveness over wall-clock alone.
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
/** If heartbeat is older than this, consider it stale (after grace). */
const HEARTBEAT_STALE_MS = 180_000;
const HEARTBEAT_CHECK_MS = 30_000;
/** Grace period after spawn before enforcing heartbeat. */
const HEARTBEAT_GRACE_MS = 120_000;
/** Need this many consecutive stale checks before killing. */
const STALE_STRIKES = 3;

let delay = BASE_DELAY_MS;
let child = null;
/** Monotonic generation — kill timers must match the generation they were armed for. */
let childGeneration = 0;
let stopping = false;
let startedAt = 0;
let healthTimer = null;
let staleStrikes = 0;
let killTimer = null;

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

function clearKillTimer() {
  if (killTimer) {
    clearTimeout(killTimer);
    killTimer = null;
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

function pidAlive(pid) {
  return Boolean(pid) && existsSync(`/proc/${pid}`);
}

function armKill(targetPid, generation, signal, afterMs) {
  clearKillTimer();
  killTimer = setTimeout(() => {
    killTimer = null;
    // Only kill if this is STILL the same child generation.
    if (generation !== childGeneration) return;
    if (!child || child.pid !== targetPid) return;
    try {
      child.kill(signal);
    } catch {
      /* ignore */
    }
  }, afterMs);
}

function startHealthWatcher() {
  clearHealthTimer();
  staleStrikes = 0;
  healthTimer = setInterval(async () => {
    if (stopping || !child) return;
    const age = Date.now() - startedAt;
    if (age < HEARTBEAT_GRACE_MS) return;

    const hb = await readHeartbeat();
    const hbTs = hb?.ts ? Number(hb.ts) : 0;
    const hbAge = hbTs ? Date.now() - hbTs : Infinity;
    const hbPid = hb?.pid ? Number(hb.pid) : null;
    const childPid = child?.pid;

    // If the child process is gone, exit handler will restart — don't double-kill.
    if (childPid && !pidAlive(childPid)) return;

    // Fresh heartbeat → healthy.
    if (hbAge <= HEARTBEAT_STALE_MS) {
      staleStrikes = 0;
      return;
    }

    // Heartbeat file stale, but process still alive.
    // After VM freeze the wall clock jumps and hbAge looks huge once —
    // require consecutive strikes, and if hb claims this pid + waConnected,
    // give it another chance by not counting a single jump as fatal.
    staleStrikes += 1;
    console.error(
      `🛡️  supervisor: heartbeat stale (${Number.isFinite(hbAge) ? Math.round(hbAge / 1000) : "∞"}s) strike ${staleStrikes}/${STALE_STRIKES} (child pid=${childPid})`,
    );

    // If heartbeat still points at this living child and was connected,
    // rewrite a bootstrap pulse once so a single clock-jump doesn't kill it.
    if (
      staleStrikes === 1 &&
      hbPid &&
      childPid &&
      hbPid === childPid &&
      pidAlive(childPid)
    ) {
      try {
        await writeFile(
          HEARTBEAT_FILE,
          JSON.stringify({
            at: new Date().toISOString(),
            ts: Date.now(),
            pid: childPid,
            waConnected: Boolean(hb?.waConnected),
            groupJid: hb?.groupJid ?? null,
            supervisorPulse: true,
          }),
          "utf8",
        );
        console.error(
          "🛡️  supervisor: wrote pulse after stale read (likely clock/sleep jump) — not killing yet",
        );
        return;
      } catch {
        /* fall through */
      }
    }

    if (staleStrikes < STALE_STRIKES) return;

    staleStrikes = 0;
    const generation = childGeneration;
    const targetPid = childPid;
    console.error(
      `🛡️  supervisor: killing hung bot pid=${targetPid} after ${STALE_STRIKES} stale strikes`,
    );
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    // Escalation only for THIS generation/pid — never the replacement.
    armKill(targetPid, generation, "SIGKILL", 10_000);
  }, HEARTBEAT_CHECK_MS);
  if (typeof healthTimer.unref === "function") healthTimer.unref();
}

function start() {
  clearKillTimer();
  startedAt = Date.now();
  childGeneration += 1;
  const generation = childGeneration;
  staleStrikes = 0;
  console.log(`\n🛡️  supervisor: starting bot (${new Date().toISOString()})`);
  clearStaleLock();
  try {
    if (existsSync(HEARTBEAT_FILE)) unlink(HEARTBEAT_FILE).catch(() => {});
  } catch {
    /* ignore */
  }
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
    // Ignore exits from a superseded generation.
    if (generation !== childGeneration) return;
    child = null;
    clearHealthTimer();
    clearKillTimer();
    if (stopping) {
      console.log("🛡️  supervisor: stopped");
      process.exit(code ?? 0);
      return;
    }
    const uptime = Date.now() - startedAt;
    if (uptime > MIN_UPTIME_MS) delay = BASE_DELAY_MS;
    else delay = Math.min(MAX_DELAY_MS, Math.max(BASE_DELAY_MS, delay * 2));

    const restartIn = Math.max(delay, signal === "SIGTERM" || signal === "SIGKILL" ? 10_000 : 5_000);

    console.error(
      `🛡️  supervisor: bot exited code=${code} signal=${signal} uptime=${Math.round(uptime / 1000)}s — restart in ${Math.round(restartIn / 1000)}s`,
    );
    setTimeout(() => {
      if (stopping) return;
      if (generation !== childGeneration) return;
      start();
    }, restartIn);
  });
}

function shutdown(signal) {
  stopping = true;
  clearHealthTimer();
  const generation = childGeneration;
  const targetPid = child?.pid;
  console.log(`🛡️  supervisor: received ${signal}`);
  if (child && targetPid) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    armKill(targetPid, generation, "SIGKILL", 8_000);
    setTimeout(() => process.exit(0), 9_000);
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
