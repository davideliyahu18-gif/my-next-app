#!/usr/bin/env node
/**
 * Continuous error watcher for the football WhatsApp bot.
 * Runs forever: checks health, looks for failure signals, and
 * starts the bot ONLY if it is truly down (never double-starts).
 *
 * Usage:
 *   node watchdog-loop.mjs
 *   npm run football-bot:watch
 */
import { spawn, execSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  appendFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HEARTBEAT_FILE = path.join(__dirname, "heartbeat.json");
const LOCK_FILE = path.join(__dirname, "bot.lock");
const ERROR_LOG = path.join(__dirname, "errors.log");
const WATCH_STATE = path.join(__dirname, "watchdog-state.json");
const ENSURE = path.join(__dirname, "ensure-up.mjs");

const CHECK_EVERY_MS = 60_000;
const HEARTBEAT_MAX_AGE_MS = 180_000;
const DOWN_STRIKES_BEFORE_ENSURE = 2;

let downStrikes = 0;
let lastActionAt = 0;
let checks = 0;
let fixes = 0;

function logLine(level, msg, extra = {}) {
  const row = {
    at: new Date().toISOString(),
    level,
    msg,
    ...extra,
  };
  const line = JSON.stringify(row);
  console.log(`[watchdog] ${level} ${msg}`, Object.keys(extra).length ? extra : "");
  try {
    appendFileSync(ERROR_LOG, `${line}\n`, "utf8");
  } catch {
    /* ignore */
  }
  try {
    writeFileSync(
      WATCH_STATE,
      JSON.stringify(
        {
          at: row.at,
          checks,
          fixes,
          downStrikes,
          lastMsg: msg,
          lastLevel: level,
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {
    /* ignore */
  }
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function pidAlive(pid) {
  return Boolean(pid) && existsSync(`/proc/${pid}`);
}

function processArgs() {
  try {
    return execSync("ps -eo args=", { encoding: "utf8" }).split("\n");
  } catch {
    return [];
  }
}

function botProcesses() {
  const args = processArgs();
  return {
    index: args.some((l) => l.includes("football-whatsapp/index.mjs")),
    supervise: args.some((l) => l.includes("football-whatsapp/supervise.mjs")),
    start: args.some((l) => l.includes("football-bot:start")),
  };
}

function diagnose() {
  const hb = readJson(HEARTBEAT_FILE);
  const procs = botProcesses();
  let lockPid = null;
  if (existsSync(LOCK_FILE)) {
    try {
      lockPid = Number(String(readFileSync(LOCK_FILE, "utf8")).trim().split("\n")[0]);
    } catch {
      /* ignore */
    }
  }

  const issues = [];
  const hbAge = hb?.ts ? Date.now() - Number(hb.ts) : Infinity;

  if (!procs.index && !procs.supervise && !procs.start) {
    issues.push("no-bot-process");
  }
  if (lockPid && !pidAlive(lockPid) && !procs.index) {
    issues.push("stale-lock");
  }
  if (hb?.loggedOut) {
    issues.push("logged-out");
  }
  if (Number(hb?.reconnectAttempts || 0) >= 10) {
    issues.push(`high-reconnect-attempts:${hb.reconnectAttempts}`);
  }
  if (hbAge > HEARTBEAT_MAX_AGE_MS && !procs.index) {
    issues.push(`heartbeat-stale:${Math.round(hbAge / 1000)}s`);
  }
  if (hb && hb.waConnected === false && procs.index && hbAge < HEARTBEAT_MAX_AGE_MS) {
    const lastOk = Math.max(
      Number(hb.lastSuccessfulSendAt || 0),
      Number(hb.lastWsActivityAt || 0),
      Number(hb.lastConnectionOpenAt || 0),
    );
    const offlineFor = lastOk ? Date.now() - lastOk : hbAge;
    if (offlineFor < 120_000) {
      return {
        ok: true,
        reconnecting: true,
        issues: [],
        hb,
        procs,
        lockPid,
        offlineFor,
      };
    }
    issues.push(`stuck-offline:${Math.round(offlineFor / 1000)}s`);
  }
  if (hb?.fail && hbAge < 120_000) {
    issues.push(`recent-fail:${hb.reason || "unknown"}`);
  }

  const ok =
    issues.length === 0 &&
    (procs.index || procs.supervise || procs.start) &&
    (hb?.waConnected === true || hb?.bootstrapping === true || procs.supervise);

  return { ok, reconnecting: false, issues, hb, procs, lockPid, hbAge };
}

function runEnsureUp() {
  const now = Date.now();
  if (now - lastActionAt < 90_000) {
    logLine("info", "ensure-up skipped (cooldown)");
    return;
  }
  lastActionAt = now;
  fixes += 1;
  logLine("warn", "running ensure-up after detected issues");
  const child = spawn(process.execPath, [ENSURE], {
    cwd: __dirname,
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => {
    logLine("info", "ensure-up finished", { code });
  });
}

function tick() {
  checks += 1;
  try {
    const d = diagnose();
    if (d.reconnecting) {
      downStrikes = 0;
      if (checks % 5 === 0) {
        logLine("info", "bot reconnecting — watching", {
          pid: d.hb?.pid,
          attempts: d.hb?.reconnectAttempts,
        });
      }
      return;
    }
    if (d.ok) {
      if (downStrikes > 0) {
        logLine("info", "recovered / healthy again", {
          pid: d.hb?.pid,
          waConnected: d.hb?.waConnected,
        });
      }
      downStrikes = 0;
      if (checks % 10 === 0) {
        logLine("info", "healthy", {
          pid: d.hb?.pid,
          waConnected: d.hb?.waConnected,
          hbAgeS: Number.isFinite(d.hbAge) ? Math.round(d.hbAge / 1000) : null,
        });
      }
      return;
    }

    downStrikes += 1;
    logLine("error", "issues detected", {
      issues: d.issues,
      downStrikes,
      procs: d.procs,
      waConnected: d.hb?.waConnected,
    });

    if (d.issues.includes("logged-out")) {
      logLine("error", "logged out — needs QR rescan (not auto-fixing auth)");
      return;
    }

    if (downStrikes >= DOWN_STRIKES_BEFORE_ENSURE) {
      runEnsureUp();
      downStrikes = 0;
    }
  } catch (error) {
    logLine("error", "watchdog tick failed", {
      error: String(error?.message || error),
    });
  }
}

try {
  mkdirSync(__dirname, { recursive: true });
} catch {
  /* ignore */
}

logLine("info", "watchdog started", { everyMs: CHECK_EVERY_MS });
tick();
setInterval(tick, CHECK_EVERY_MS);
