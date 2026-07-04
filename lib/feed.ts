import { WHATSAPP_FEED_INITIAL_LIMIT } from "./constants";
import {
  getFeedLength,
  listFeedMessages,
  listFeedMessagesAfter,
} from "./feed-store";
import type { WhatsAppFeedMessage } from "./types";

export function parseFeedMessage(
  entry: Record<string, unknown>,
): WhatsAppFeedMessage | null {
  if (typeof entry.body !== "string" || !entry.body.trim()) return null;

  return {
    id: String(entry.id ?? ""),
    body: entry.body,
    sentAt: String(entry.sentAt ?? new Date().toISOString()),
    source: String(entry.source ?? "whatsapp"),
  };
}

export async function readFeedMessages(options?: {
  limit?: number;
}): Promise<{ messages: WhatsAppFeedMessage[]; cursor: number }> {
  const limit = options?.limit ?? WHATSAPP_FEED_INITIAL_LIMIT;
  const messages = await listFeedMessages(limit);
  const cursor = await getFeedLength();

  return { messages, cursor };
}

export async function readFeedTail(fromCursor: number): Promise<{
  messages: WhatsAppFeedMessage[];
  cursor: number;
}> {
  return listFeedMessagesAfter(fromCursor);
}
