import { randomUUID } from "node:crypto";
import { verifyFeedAuth } from "@/lib/feed-auth";
import { parseFeedMessage } from "@/lib/feed";
import { appendFeedMessage, isRedisConfigured } from "@/lib/feed-store";
import type { WhatsAppFeedMessage } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_LENGTH = 16_384;

/** Lightweight health check for feed storage (no secrets exposed). */
export async function GET() {
  return Response.json({
    ok: true,
    redis: isRedisConfigured(),
  });
}

export async function POST(request: Request) {
  if (!verifyFeedAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof payload.body !== "string" || !payload.body.trim()) {
    return Response.json({ error: "body is required" }, { status: 400 });
  }

  if (payload.body.length > MAX_BODY_LENGTH) {
    return Response.json({ error: "body too long" }, { status: 413 });
  }

  const message: WhatsAppFeedMessage | null = parseFeedMessage({
    id: payload.id ?? randomUUID().replace(/-/g, ""),
    body: payload.body,
    sentAt: payload.sentAt ?? new Date().toISOString(),
    source: payload.source ?? "whatsapp",
  });

  if (!message?.id) {
    return Response.json({ error: "Invalid message payload" }, { status: 400 });
  }

  try {
    await appendFeedMessage(message);
  } catch (error) {
    console.error("[feed] Redis store failed:", error);
    return Response.json({ error: "Feed storage unavailable" }, { status: 503 });
  }

  return Response.json({ ok: true, id: message.id }, { status: 201 });
}
