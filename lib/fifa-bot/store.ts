import { Redis } from "@upstash/redis";

const SNAPSHOT_KEY = "fifa-bot:snapshots";
const SEEN_ALERTS_KEY = "fifa-bot:seen-alerts";
const MAX_SEEN = 400;

declare global {
  var __fifaBotSnapshots: Record<string, unknown> | undefined;
  var __fifaBotSeenAlerts: Set<string> | undefined;
  var __fifaBotRedis: Redis | undefined;
}

function isRedisConfigured(): boolean {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
}

function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (!globalThis.__fifaBotRedis) {
    globalThis.__fifaBotRedis = Redis.fromEnv();
  }
  return globalThis.__fifaBotRedis;
}

function memorySnapshots(): Record<string, unknown> {
  if (!globalThis.__fifaBotSnapshots) {
    globalThis.__fifaBotSnapshots = {};
  }
  return globalThis.__fifaBotSnapshots;
}

function memorySeen(): Set<string> {
  if (!globalThis.__fifaBotSeenAlerts) {
    globalThis.__fifaBotSeenAlerts = new Set();
  }
  return globalThis.__fifaBotSeenAlerts;
}

export async function loadMatchSnapshots<T>(): Promise<Record<string, T>> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<Record<string, T>>(SNAPSHOT_KEY);
    return raw ?? {};
  }
  return { ...(memorySnapshots() as Record<string, T>) };
}

export async function saveMatchSnapshots(
  snapshots: Record<string, unknown>,
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(SNAPSHOT_KEY, snapshots);
    return;
  }
  globalThis.__fifaBotSnapshots = snapshots;
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
      // Best-effort TTL so the seen-set cannot grow forever.
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
