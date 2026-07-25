import { Redis } from "@upstash/redis";
import {
  FLIGHT_DEALS_HISTORY_KEY,
  FLIGHT_DEALS_MAX_HISTORY,
  FLIGHT_DEALS_SEEN_KEY,
} from "./constants";
import type { FlightDeal } from "./types";

declare global {
  var __flightDealsSeen: Set<string> | undefined;
  var __flightDealsHistory: FlightDeal[] | undefined;
  var __flightDealsRedis: Redis | undefined;
}

function isRedisConfigured(): boolean {
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

  if (!globalThis.__flightDealsRedis) {
    globalThis.__flightDealsRedis = new Redis({ url, token });
  }

  return globalThis.__flightDealsRedis;
}

function memorySeen(): Set<string> {
  if (!globalThis.__flightDealsSeen) {
    globalThis.__flightDealsSeen = new Set();
  }
  return globalThis.__flightDealsSeen;
}

function memoryHistory(): FlightDeal[] {
  if (!globalThis.__flightDealsHistory) {
    globalThis.__flightDealsHistory = [];
  }
  return globalThis.__flightDealsHistory;
}

export async function filterNewDeals(
  deals: FlightDeal[],
): Promise<{ newDeals: FlightDeal[]; skippedDuplicates: number }> {
  const redis = getRedis();
  const newDeals: FlightDeal[] = [];
  let skippedDuplicates = 0;

  if (redis) {
    for (const deal of deals) {
      const added = await redis.sadd(FLIGHT_DEALS_SEEN_KEY, deal.id);
      if (added === 1) {
        newDeals.push(deal);
        await redis.lpush(FLIGHT_DEALS_HISTORY_KEY, JSON.stringify(deal));
      } else {
        skippedDuplicates += 1;
      }
    }

    const length = await redis.llen(FLIGHT_DEALS_HISTORY_KEY);
    if (length > FLIGHT_DEALS_MAX_HISTORY) {
      await redis.ltrim(
        FLIGHT_DEALS_HISTORY_KEY,
        0,
        FLIGHT_DEALS_MAX_HISTORY - 1,
      );
    }

    return { newDeals, skippedDuplicates };
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Upstash Redis is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN for deal deduplication.",
    );
  }

  const seen = memorySeen();
  const history = memoryHistory();

  for (const deal of deals) {
    if (seen.has(deal.id)) {
      skippedDuplicates += 1;
      continue;
    }
    seen.add(deal.id);
    newDeals.push(deal);
    history.unshift(deal);
  }

  if (history.length > FLIGHT_DEALS_MAX_HISTORY) {
    history.splice(FLIGHT_DEALS_MAX_HISTORY);
  }

  return { newDeals, skippedDuplicates };
}

export async function listRecentDeals(limit = 50): Promise<FlightDeal[]> {
  const redis = getRedis();

  if (redis) {
    const raw = await redis.lrange<string>(FLIGHT_DEALS_HISTORY_KEY, 0, limit - 1);
    return raw
      .map((entry) => {
        try {
          return typeof entry === "string"
            ? (JSON.parse(entry) as FlightDeal)
            : (entry as FlightDeal);
        } catch {
          return null;
        }
      })
      .filter((deal): deal is FlightDeal => Boolean(deal?.id));
  }

  return memoryHistory().slice(0, limit);
}
