import { Redis } from "@upstash/redis";

export type BotSubscriber = {
  chatId: string;
  /** Empty = receive all launch alerts. */
  areas: string[];
  muted: boolean;
  safeAt?: string;
  firstName?: string;
  updatedAt: string;
};

const SUBS_KEY = "rockets:bot:subscribers";

declare global {
  var __rocketBotSubscribers: Map<string, BotSubscriber> | undefined;
}

function memorySubs(): Map<string, BotSubscriber> {
  if (!globalThis.__rocketBotSubscribers) {
    globalThis.__rocketBotSubscribers = new Map();
  }
  return globalThis.__rocketBotSubscribers;
}

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function parseSub(value: unknown, chatId: string): BotSubscriber | null {
  if (!value) return null;
  try {
    const raw =
      typeof value === "string"
        ? (JSON.parse(value) as Record<string, unknown>)
        : (value as Record<string, unknown>);
    return {
      chatId: String(raw.chatId ?? chatId),
      areas: Array.isArray(raw.areas)
        ? raw.areas.map((a) => String(a))
        : [],
      muted: Boolean(raw.muted),
      safeAt: typeof raw.safeAt === "string" ? raw.safeAt : undefined,
      firstName: typeof raw.firstName === "string" ? raw.firstName : undefined,
      updatedAt:
        typeof raw.updatedAt === "string"
          ? raw.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getSubscriber(
  chatId: string | number,
): Promise<BotSubscriber | null> {
  const id = String(chatId);
  const client = redis();
  if (client) {
    const value = await client.hget(SUBS_KEY, id);
    return parseSub(value, id);
  }
  return memorySubs().get(id) ?? null;
}

export async function upsertSubscriber(
  input: Omit<Partial<BotSubscriber>, "chatId"> & { chatId: string | number },
): Promise<BotSubscriber> {
  const id = String(input.chatId);
  const existing = (await getSubscriber(id)) ?? {
    chatId: id,
    areas: [],
    muted: false,
    updatedAt: new Date().toISOString(),
  };
  const next: BotSubscriber = {
    ...existing,
    ...input,
    chatId: id,
    areas: input.areas ?? existing.areas,
    muted: input.muted ?? existing.muted,
    updatedAt: new Date().toISOString(),
  };

  const client = redis();
  if (client) {
    await client.hset(SUBS_KEY, { [id]: JSON.stringify(next) });
  } else {
    memorySubs().set(id, next);
  }
  return next;
}

export async function listSubscribers(): Promise<BotSubscriber[]> {
  const client = redis();
  if (client) {
    const all = (await client.hgetall(SUBS_KEY)) as Record<
      string,
      unknown
    > | null;
    if (!all) return [];
    return Object.entries(all)
      .map(([id, value]) => parseSub(value, id))
      .filter((s): s is BotSubscriber => Boolean(s));
  }
  return [...memorySubs().values()];
}

export async function toggleSubscriberArea(
  chatId: string | number,
  areaId: string,
): Promise<BotSubscriber> {
  const sub = await upsertSubscriber({ chatId });
  const has = sub.areas.includes(areaId);
  const areas = has
    ? sub.areas.filter((id) => id !== areaId)
    : [...sub.areas, areaId];
  return upsertSubscriber({ chatId, areas });
}

export async function markSubscriberSafe(
  chatId: string | number,
): Promise<BotSubscriber> {
  return upsertSubscriber({
    chatId,
    safeAt: new Date().toISOString(),
  });
}

export function subscriberWantsArea(
  sub: BotSubscriber,
  areaIds: string[],
): boolean {
  if (sub.muted) return false;
  // No preference = receive everything.
  if (sub.areas.length === 0) return true;
  if (areaIds.length === 0) return true;
  return areaIds.some(
    (id) =>
      sub.areas.includes(id) ||
      sub.areas.includes("israel") ||
      id === "israel",
  );
}
