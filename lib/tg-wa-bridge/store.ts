import { Redis } from "@upstash/redis";

const SENT_KEY = "tg-wa-bridge:sent-ids";
const BOOTSTRAP_KEY = "tg-wa-bridge:bootstrapped";
const MAX_SENT = 800;

declare global {
  var __tgWaBridgeSentIds: Set<string> | undefined;
  var __tgWaBridgeBootstrapped: boolean | undefined;
}

function memoryIds(): Set<string> {
  if (!globalThis.__tgWaBridgeSentIds) {
    globalThis.__tgWaBridgeSentIds = new Set();
  }
  return globalThis.__tgWaBridgeSentIds;
}

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function wasMessageSent(id: string): Promise<boolean> {
  const client = redis();
  if (client) {
    const score = await client.zscore(SENT_KEY, id);
    return score != null;
  }
  return memoryIds().has(id);
}

export async function markMessagesSent(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const client = redis();
  if (client) {
    const now = Date.now();
    for (let index = 0; index < ids.length; index += 1) {
      await client.zadd(SENT_KEY, {
        score: now + index,
        member: ids[index],
      });
    }
    await client.zremrangebyrank(SENT_KEY, 0, -(MAX_SENT + 1));
    return;
  }
  const set = memoryIds();
  for (const id of ids) set.add(id);
  if (set.size > MAX_SENT) {
    globalThis.__tgWaBridgeSentIds = new Set([...set].slice(-MAX_SENT));
  }
}

export async function filterUnsent(ids: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const id of ids) {
    if (!(await wasMessageSent(id))) out.push(id);
  }
  return out;
}

/** First successful poll only marks history as seen — avoids flooding WhatsApp. */
export async function isBridgeBootstrapped(): Promise<boolean> {
  const client = redis();
  if (client) {
    return Boolean(await client.get(BOOTSTRAP_KEY));
  }
  return globalThis.__tgWaBridgeBootstrapped === true;
}

export async function markBridgeBootstrapped(): Promise<void> {
  const client = redis();
  if (client) {
    await client.set(BOOTSTRAP_KEY, "1");
    return;
  }
  globalThis.__tgWaBridgeBootstrapped = true;
}
