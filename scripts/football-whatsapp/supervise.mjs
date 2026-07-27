#!/usr/bin/env node
/**
 * Auto-restart supervisor for the WhatsApp football bot.
 * If index.mjs exits for any reason, wait and start again.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(__dirname, "index.mjs");
const MIN_UPTIME_MS = 15_000;
const BASE_DELAY_MS = 3_000;
const MAX_DELAY_MS = 60_000;

let delay = BASE_DELAY_MS;
let child = null;
let stopping = false;

function start() {
  const startedAt = Date.now();
  console.log(`\n🛡️  supervisor: starting bot (${new Date().toISOString()})`);
  child = spawn(process.execPath, [ENTRY], {
    cwd: __dirname,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    child = null;
    if (stopping) {
      console.log("🛡️  supervisor: stopped");
      process.exit(code ?? 0);
      return;
    }
    const uptime = Date.now() - startedAt;
    if (uptime > MIN_UPTIME_MS) delay = BASE_DELAY_MS;
    else delay = Math.min(MAX_DELAY_MS, delay * 2);

    console.error(
      `🛡️  supervisor: bot exited code=${code} signal=${signal} uptime=${Math.round(uptime / 1000)}s — restart in ${Math.round(delay / 1000)}s`,
    );
    setTimeout(start, delay);
  });
}

function shutdown(signal) {
  stopping = true;
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
