import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
} from "node:fs";
import {
  WHATSAPP_FEED_INITIAL_LIMIT,
  WEBSITE_FEED_PATH,
} from "./constants";
import type { WhatsAppFeedMessage } from "./types";

export function getWebsiteFeedPath(): string | null {
  const path = WEBSITE_FEED_PATH.trim();
  return path || null;
}

export function parseFeedLine(line: string): WhatsAppFeedMessage | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const entry = JSON.parse(trimmed) as Record<string, unknown>;
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

function parseFeedContent(content: string): WhatsAppFeedMessage[] {
  const messages: WhatsAppFeedMessage[] = [];

  for (const line of content.split("\n")) {
    const message = parseFeedLine(line);
    if (message?.id) {
      messages.push(message);
    }
  }

  return messages;
}

export function readFeedMessages(options?: {
  limit?: number;
}): { messages: WhatsAppFeedMessage[]; byteOffset: number } {
  const path = getWebsiteFeedPath();
  if (!path || !existsSync(path)) {
    return { messages: [], byteOffset: 0 };
  }

  const content = readFileSync(path, "utf8");
  const messages = parseFeedContent(content);
  const limit = options?.limit ?? WHATSAPP_FEED_INITIAL_LIMIT;

  return {
    messages: messages.slice(-limit),
    byteOffset: statSync(path).size,
  };
}

export function readFeedTail(fromByteOffset: number): {
  messages: WhatsAppFeedMessage[];
  byteOffset: number;
} {
  const path = getWebsiteFeedPath();
  if (!path || !existsSync(path)) {
    return { messages: [], byteOffset: 0 };
  }

  const size = statSync(path).size;
  if (fromByteOffset >= size) {
    return { messages: [], byteOffset: size };
  }

  const length = size - fromByteOffset;
  const buffer = Buffer.alloc(length);
  const fd = openSync(path, "r");

  try {
    readSync(fd, buffer, 0, length, fromByteOffset);
  } finally {
    closeSync(fd);
  }

  const chunk = buffer.toString("utf8");
  const messages = parseFeedContent(chunk);

  return { messages, byteOffset: size };
}
