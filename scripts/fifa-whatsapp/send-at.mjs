#!/usr/bin/env node
/**
 * Wait until a local wall-clock time (Asia/Jerusalem by default), then run a command.
 * Avoids long single sleep() drift by polling every second near the target.
 *
 * Usage:
 *   node send-at.mjs --at 08:00 --tz Asia/Jerusalem -- node send-something.mjs
 *   node send-at.mjs --at 2026-07-19T08:00:00 -- node send-something.mjs
 */
import { spawn } from "node:child_process";

function parseArgs(argv) {
  const out = { at: null, tz: "Asia/Jerusalem", cmd: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--at") out.at = argv[++i];
    else if (a === "--tz") out.tz = argv[++i];
    else if (a === "--") {
      out.cmd = argv.slice(i + 1);
      break;
    } else if (!out.at) out.at = a;
    else {
      out.cmd = argv.slice(i);
      break;
    }
  }
  return out;
}

function nowInTz(timeZone) {
  // Return a Date whose UTC epoch is "now", plus formatter helpers.
  return new Date();
}

function partsInTz(date, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function targetEpochMs(at, timeZone) {
  const now = new Date();
  const p = partsInTz(now, timeZone);
  let year = p.year, month = p.month, day = p.day, hour = 0, minute = 0, second = 0;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(at)) {
    const [datePart, timePart] = at.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm, ss] = timePart.split(":").map(Number);
    year = y; month = m; day = d; hour = hh; minute = mm; second = ss || 0;
  } else if (/^\d{1,2}:\d{2}/.test(at)) {
    const [hh, mm, ss] = at.split(":").map(Number);
    hour = hh; minute = mm; second = ss || 0;
    // If already past today's time, schedule tomorrow.
    const cur = p.hour * 3600 + p.minute * 60 + p.second;
    const tgt = hour * 3600 + minute * 60 + second;
    if (cur >= tgt) {
      const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
      const tp = partsInTz(tomorrow, timeZone);
      year = tp.year; month = tp.month; day = tp.day;
    }
  } else {
    throw new Error(`Bad --at value: ${at}`);
  }

  // Binary search UTC instant that formats to the desired local wall time.
  // Start guess: treat as if tz offset ~ current offset.
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 6; i++) {
    const got = partsInTz(new Date(guess), timeZone);
    const wantSec = ((hour * 60 + minute) * 60) + second;
    const gotSec = ((got.hour * 60 + got.minute) * 60) + got.second;
    // Also adjust day drift
    const wantDay = Date.UTC(year, month - 1, day);
    const gotDay = Date.UTC(got.year, got.month - 1, got.day);
    const dayDiffSec = (wantDay - gotDay) / 1000;
    guess += (dayDiffSec + (wantSec - gotSec)) * 1000;
  }
  return guess;
}

async function waitUntil(targetMs, timeZone) {
  for (;;) {
    const now = Date.now();
    const left = targetMs - now;
    const p = partsInTz(new Date(), timeZone);
    if (left <= 0) return;
    if (left > 60_000) {
      console.log(`[send-at] ${p.hour.toString().padStart(2,"0")}:${p.minute.toString().padStart(2,"0")}:${p.second.toString().padStart(2,"0")} sleep ${Math.round(left/1000)}s`);
      await new Promise((r) => setTimeout(r, Math.min(left - 15_000, 30_000)));
    } else {
      await new Promise((r) => setTimeout(r, Math.min(left, 500)));
    }
  }
}

const args = parseArgs(process.argv.slice(2));
if (!args.at || !args.cmd.length) {
  console.error("Usage: node send-at.mjs --at HH:MM|--at ISO --tz Asia/Jerusalem -- <command...>");
  process.exit(1);
}
const targetMs = targetEpochMs(args.at, args.tz);
console.log(`[send-at] target epoch ${new Date(targetMs).toISOString()} tz=${args.tz}`);
await waitUntil(targetMs, args.tz);
console.log(`[send-at] firing at ${new Date().toISOString()}`);
const child = spawn(args.cmd[0], args.cmd.slice(1), { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
