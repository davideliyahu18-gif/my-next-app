import { Redis } from "@upstash/redis";

const SENT_KEY = "rockets:telegram:sent-ids";
const MAX_SENT = 400;

declare global {
  var __rocketTelegramSentIds: Set<string> | undefined;
}

function memoryIds(): Set<string> {
  if (!globalThis.__rocketTelegramSentIds) {
    globalThis.__rocketTelegramSentIds = new Set();
  }
  return globalThis.__rocketTelegramSentIds;
}

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function wasAlertSent(id: string): Promise<boolean> {
  const client = redis();
  if (client) {
    const score = await client.zscore(SENT_KEY, id);
    return score != null;
  }
  return memoryIds().has(id);
}

export async function markAlertSent(id: string): Promise<void> {
  const client = redis();
  if (client) {
    const now = Date.now();
    await client.zadd(SENT_KEY, { score: now, member: id });
    await client.zremrangebyrank(SENT_KEY, 0, -(MAX_SENT + 1));
    return;
  }
  const ids = memoryIds();
  ids.add(id);
  if (ids.size > MAX_SENT) {
    const trimmed = [...ids].slice(-MAX_SENT);
    globalThis.__rocketTelegramSentIds = new Set(trimmed);
  }
}

export async function filterUnsent(ids: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const id of ids) {
    if (!(await wasAlertSent(id))) out.push(id);
  }
  return out;
}
