import { Redis } from "@upstash/redis";
import type { WhatsAppFeedMessage } from "./types";

const FEED_LIST_KEY = "whatsapp:feed";
const FEED_IDS_KEY = "whatsapp:feed:ids";
const MAX_STORED_MESSAGES = 500;

declare global {
  var __whatsappFeedStore: WhatsAppFeedMessage[] | undefined;
  var __upstashRedis: Redis | undefined;
}

function memoryStore(): WhatsAppFeedMessage[] {
  if (!globalThis.__whatsappFeedStore) {
    globalThis.__whatsappFeedStore = [];
  }
  return globalThis.__whatsappFeedStore;
}

function memoryIds(): Set<string> {
  if (!globalThis.__whatsappFeedIds) {
    globalThis.__whatsappFeedIds = new Set();
  }
  return globalThis.__whatsappFeedIds;
}

declare global {
  var __whatsappFeedIds: Set<string> | undefined;
}

export function isRedisConfigured(): boolean {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
}

function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;

  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL!;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN!;

  if (!globalThis.__upstashRedis) {
    globalThis.__upstashRedis = new Redis({ url, token });
  }

  return globalThis.__upstashRedis;
}

function parseStored(value: unknown): WhatsAppFeedMessage | null {
  if (!value) return null;

  try {
    const entry =
      typeof value === "string"
        ? (JSON.parse(value) as Record<string, unknown>)
        : (value as Record<string, unknown>);

    if (typeof entry.body !== "string" || !entry.body.trim()) return null;

    return {
      id: String(entry.id ?? ""),
      body: entry.body,
      sentAt: String(entry.sentAt ?? new Date().toISOString()),
      source: String(entry.source ?? "whatsapp"),
    };
  } catch {
    return null;
  }
}

export async function appendFeedMessage(
  message: WhatsAppFeedMessage,
): Promise<void> {
  const redis = getRedis();

  if (redis) {
    const added = await redis.sadd(FEED_IDS_KEY, message.id);
    if (added === 0) return;

    await redis.rpush(FEED_LIST_KEY, message);
    const length = await redis.llen(FEED_LIST_KEY);
    if (length > MAX_STORED_MESSAGES) {
      const trimFrom = length - MAX_STORED_MESSAGES;
      await redis.ltrim(FEED_LIST_KEY, trimFrom, -1);
    }
    return;
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Upstash Redis is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.",
    );
  }

  const ids = memoryIds();
  if (ids.has(message.id)) return;
  ids.add(message.id);

  const store = memoryStore();
  store.push(message);
  if (store.length > MAX_STORED_MESSAGES) {
    const removed = store.splice(0, store.length - MAX_STORED_MESSAGES);
    for (const item of removed) {
      ids.delete(item.id);
    }
  }
}

export async function getFeedLength(): Promise<number> {
  const redis = getRedis();
  if (redis) return redis.llen(FEED_LIST_KEY);

  return memoryStore().length;
}

export async function listFeedMessages(
  limit: number,
): Promise<WhatsAppFeedMessage[]> {
  const redis = getRedis();

  if (redis) {
    const raw = await redis.lrange<WhatsAppFeedMessage | string>(
      FEED_LIST_KEY,
      -limit,
      -1,
    );
    return raw
      .map((entry) => parseStored(entry))
      .filter((message): message is WhatsAppFeedMessage =>
        Boolean(message?.id),
      );
  }

  return memoryStore().slice(-limit);
}

export async function listFeedMessagesAfter(cursor: number): Promise<{
  messages: WhatsAppFeedMessage[];
  cursor: number;
}> {
  const redis = getRedis();

  if (redis) {
    const length = await redis.llen(FEED_LIST_KEY);
    if (cursor >= length) {
      return { messages: [], cursor: length };
    }

    const raw = await redis.lrange<WhatsAppFeedMessage | string>(
      FEED_LIST_KEY,
      cursor,
      -1,
    );
    return {
      messages: raw
        .map((entry) => parseStored(entry))
        .filter((message): message is WhatsAppFeedMessage =>
          Boolean(message?.id),
        ),
      cursor: length,
    };
  }

  const store = memoryStore();
  return {
    messages: store.slice(cursor),
    cursor: store.length,
  };
}
