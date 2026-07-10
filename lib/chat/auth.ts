import { createHash, timingSafeEqual } from "node:crypto";

import { hasChatProvider } from "./complete";

export function getChatPassword(): string {
  return process.env.CHAT_PASSWORD?.trim() || "";
}

export function isChatConfigured(): boolean {
  return Boolean(getChatPassword() && hasChatProvider());
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function verifyChatPassword(candidate: string): boolean {
  const expected = getChatPassword();
  if (!expected || !candidate) return false;

  const a = digest(candidate);
  const b = digest(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function readChatPasswordFromRequest(request: Request): string {
  const header = request.headers.get("x-chat-password")?.trim();
  if (header) return header;

  const auth = request.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  return "";
}

export function isChatAuthorized(request: Request): boolean {
  return verifyChatPassword(readChatPasswordFromRequest(request));
}
