import { Redis } from "@upstash/redis";
import { isRedisConfigured } from "@/lib/feed-store";

export type PushSubscriptionJSON = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushSubscriber = {
  endpoint: string;
  subscription: PushSubscriptionJSON;
  leagues: string[];
  createdAt: string;
  updatedAt: string;
  userAgent?: string;
};

const SUBS_SET_KEY = "push:subs";
const SUB_KEY = (endpoint: string) => `push:sub:${hashEndpoint(endpoint)}`;

declare global {
  var __pushSubsMemory: Map<string, PushSubscriber> | undefined;
}

function memoryMap(): Map<string, PushSubscriber> {
  if (!globalThis.__pushSubsMemory) {
    globalThis.__pushSubsMemory = new Map();
  }
  return globalThis.__pushSubsMemory;
}

function hashEndpoint(endpoint: string): string {
  // Stable short key without crypto module edge issues.
  let hash = 0;
  for (let i = 0; i < endpoint.length; i += 1) {
    hash = (hash * 31 + endpoint.charCodeAt(i)) >>> 0;
  }
  return `${hash.toString(16)}:${endpoint.length}`;
}

function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL!;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN!;
  return new Redis({ url, token });
}

function normalizeSubscription(
  raw: PushSubscriptionJSON,
): PushSubscriptionJSON | null {
  if (!raw?.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) return null;
  return {
    endpoint: String(raw.endpoint),
    expirationTime: raw.expirationTime ?? null,
    keys: {
      p256dh: String(raw.keys.p256dh),
      auth: String(raw.keys.auth),
    },
  };
}

export async function savePushSubscriber(input: {
  subscription: PushSubscriptionJSON;
  leagues?: string[];
  userAgent?: string;
}): Promise<PushSubscriber> {
  const subscription = normalizeSubscription(input.subscription);
  if (!subscription) {
    throw new Error("Invalid push subscription");
  }

  const now = new Date().toISOString();
  const existing = await getPushSubscriber(subscription.endpoint);
  const subscriber: PushSubscriber = {
    endpoint: subscription.endpoint,
    subscription,
    leagues: Array.isArray(input.leagues)
      ? input.leagues.map(String).filter(Boolean)
      : existing?.leagues ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    userAgent: input.userAgent || existing?.userAgent,
  };

  const redis = getRedis();
  if (redis) {
    await redis.set(SUB_KEY(subscriber.endpoint), subscriber);
    await redis.sadd(SUBS_SET_KEY, subscriber.endpoint);
  } else {
    memoryMap().set(subscriber.endpoint, subscriber);
  }

  return subscriber;
}

export async function getPushSubscriber(
  endpoint: string,
): Promise<PushSubscriber | null> {
  const redis = getRedis();
  if (redis) {
    const value = await redis.get<PushSubscriber>(SUB_KEY(endpoint));
    return value ?? null;
  }
  return memoryMap().get(endpoint) ?? null;
}

export async function removePushSubscriber(endpoint: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(SUB_KEY(endpoint));
    await redis.srem(SUBS_SET_KEY, endpoint);
  } else {
    memoryMap().delete(endpoint);
  }
}

export async function listPushSubscribers(): Promise<PushSubscriber[]> {
  const redis = getRedis();
  if (redis) {
    const endpoints = (await redis.smembers(SUBS_SET_KEY)) as string[];
    if (!endpoints.length) return [];
    const rows = await Promise.all(
      endpoints.map(async (endpoint) => {
        const value = await redis.get<PushSubscriber>(SUB_KEY(endpoint));
        return value;
      }),
    );
    return rows.filter((row): row is PushSubscriber => Boolean(row));
  }
  return [...memoryMap().values()];
}
