import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Redis } from "@upstash/redis";

const DEDUPE_TTL_SEC = Number(process.env.FIFA_BOT_DEDUPE_TTL_SEC || "180");
const DEDUPE_FILE =
  process.env.FIFA_BOT_DEDUPE_FILE || "/tmp/fifa-whatsapp-dedupe.json";
export const HOTPATH_LOCK_FILE =
  process.env.FIFA_HOTPATH_LOCK_FILE || "/tmp/fifa-hotpath.lock";

declare global {
  var __fifaBotDedupeRedis: Redis | undefined;
  var __fifaBotDedupeMemory: Map<string, number> | undefined;
}

function isRedisConfigured(): boolean {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
}

function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (!globalThis.__fifaBotDedupeRedis) {
    globalThis.__fifaBotDedupeRedis = Redis.fromEnv();
  }
  return globalThis.__fifaBotDedupeRedis;
}

function memoryMap(): Map<string, number> {
  if (!globalThis.__fifaBotDedupeMemory) {
    globalThis.__fifaBotDedupeMemory = new Map();
  }
  return globalThis.__fifaBotDedupeMemory;
}

export function fingerprintSend(chatId: string, body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim().slice(0, 500);
  return createHash("sha256")
    .update(`${chatId}\n${normalized}`)
    .digest("hex")
    .slice(0, 32);
}

async function claimFile(key: string, ttlSec: number): Promise<boolean> {
  const now = Date.now();
  let data: Record<string, number> = {};
  try {
    data = JSON.parse(await readFile(DEDUPE_FILE, "utf8")) as Record<
      string,
      number
    >;
  } catch {
    data = {};
  }
  for (const [k, exp] of Object.entries(data)) {
    if (exp <= now) delete data[k];
  }
  if (data[key] && data[key] > now) return false;
  data[key] = now + ttlSec * 1000;
  await mkdir(path.dirname(DEDUPE_FILE), { recursive: true }).catch(
    () => undefined,
  );
  await writeFile(DEDUPE_FILE, JSON.stringify(data));
  return true;
}

/**
 * Returns true if this send is allowed (first claim within TTL).
 * Returns false if the same chat+body was already sent recently.
 */
export async function claimWhatsAppSend(
  chatId: string,
  body: string,
  ttlSec = DEDUPE_TTL_SEC,
): Promise<boolean> {
  if (!chatId || !body) return true;
  const key = fingerprintSend(chatId, body);
  const redis = getRedis();
  if (redis) {
    const result = await redis.set(`fifa-bot:dedupe:${key}`, "1", {
      nx: true,
      ex: ttlSec,
    });
    // Upstash returns "OK" when set, null when key already exists.
    return result != null;
  }

  try {
    return await claimFile(key, ttlSec);
  } catch {
    const mem = memoryMap();
    const now = Date.now();
    for (const [k, exp] of mem) {
      if (exp <= now) mem.delete(k);
    }
    const existing = mem.get(key);
    if (existing && existing > now) return false;
    mem.set(key, now + ttlSec * 1000);
    return true;
  }
}

/** True when live-hotpath holds the send lock on this machine. */
export function isHotpathLockActive(): boolean {
  try {
    if (!existsSync(HOTPATH_LOCK_FILE)) return false;
    const raw = readFileSync(HOTPATH_LOCK_FILE, "utf8");
    const parsed = JSON.parse(raw) as { expiresAt?: number };
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}
