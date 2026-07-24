import { Redis } from "@upstash/redis";

const SEEN_ALERTS_KEY = "missile-alerts:seen";
const MAX_SEEN = 500;

declare global {
  var __missileAlertSeen: Set<string> | undefined;
  var __missileAlertRedis: Redis | undefined;
}

function isRedisConfigured(): boolean {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
}

function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (!globalThis.__missileAlertRedis) {
    const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL!;
    const token =
      process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN!;
    globalThis.__missileAlertRedis = new Redis({ url, token });
  }
  return globalThis.__missileAlertRedis;
}

function memorySeen(): Set<string> {
  if (!globalThis.__missileAlertSeen) {
    globalThis.__missileAlertSeen = new Set();
  }
  return globalThis.__missileAlertSeen;
}

export async function hasSeenAlert(id: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    return Boolean(await redis.sismember(SEEN_ALERTS_KEY, id));
  }
  return memorySeen().has(id);
}

export async function markAlertsSeen(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const redis = getRedis();
  if (redis) {
    for (const id of ids) {
      await redis.sadd(SEEN_ALERTS_KEY, id);
    }
    const size = await redis.scard(SEEN_ALERTS_KEY);
    if (size > MAX_SEEN) {
      await redis.expire(SEEN_ALERTS_KEY, 60 * 60 * 24 * 45);
    }
    return;
  }
  const seen = memorySeen();
  for (const id of ids) seen.add(id);
  if (seen.size > MAX_SEEN) {
    const extra = [...seen].slice(0, seen.size - MAX_SEEN);
    for (const id of extra) seen.delete(id);
  }
}
