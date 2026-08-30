import { Redis } from "@upstash/redis";
import { CONVERSATION_KEY_PREFIX, CONVERSATION_TTL_SECONDS } from "./constants";
import type { ConversationState } from "./types";

declare global {
  var __flightsBotConversations: Map<string, ConversationState> | undefined;
  var __upstashRedis: Redis | undefined;
}

function memoryStore(): Map<string, ConversationState> {
  if (!globalThis.__flightsBotConversations) {
    globalThis.__flightsBotConversations = new Map();
  }
  return globalThis.__flightsBotConversations;
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

  if (!globalThis.__upstashRedis) {
    globalThis.__upstashRedis = new Redis({ url, token });
  }
  return globalThis.__upstashRedis;
}

function keyFor(chatId: string): string {
  return `${CONVERSATION_KEY_PREFIX}${chatId}`;
}

export async function getConversation(
  chatId: string,
): Promise<ConversationState | null> {
  const redis = getRedis();
  if (redis) {
    return (await redis.get<ConversationState>(keyFor(chatId))) ?? null;
  }
  return memoryStore().get(chatId) ?? null;
}

export async function setConversation(
  chatId: string,
  state: ConversationState,
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(keyFor(chatId), state, { ex: CONVERSATION_TTL_SECONDS });
    return;
  }
  memoryStore().set(chatId, state);
}

export async function clearConversation(chatId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(keyFor(chatId));
    return;
  }
  memoryStore().delete(chatId);
}
