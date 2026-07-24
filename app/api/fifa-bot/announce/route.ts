import { NextResponse } from "next/server";
import type { FifaBotChannel } from "@/lib/fifa-bot/channels";
import { verifyFifaBotCommandAuth } from "@/lib/fifa-bot/cron-auth";
import {
  isGreenApiConfigured,
  sendWhatsAppToChannels,
} from "@/lib/fifa-bot/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function parseChannels(raw: unknown): FifaBotChannel[] {
  if (!Array.isArray(raw) || raw.length === 0) return ["main", "vip"];
  const channels: FifaBotChannel[] = [];
  for (const item of raw) {
    if (item === "main" || item === "vip") channels.push(item);
  }
  return channels.length ? channels : ["main", "vip"];
}

/** POST a custom WhatsApp message to MAIN / VIP via Green API. */
export async function POST(request: Request) {
  if (!verifyFifaBotCommandAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGreenApiConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Green API not configured. Set GREEN_API_INSTANCE, GREEN_API_TOKEN, FIFA_WHATSAPP_MAIN_CHAT_ID, FIFA_WHATSAPP_VIP_CHAT_ID.",
      },
      { status: 503 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "text too long" }, { status: 413 });
  }

  try {
    const channels = parseChannels(payload.channels);
    const results = await sendWhatsAppToChannels(text, channels);
    const sent = results.filter((result) => result.ok).length;
    return NextResponse.json({
      ok: sent > 0,
      sent,
      results: results.map(({ channel, ok, chatId }) => ({
        channel,
        ok,
        chatId: chatId ? `${chatId.slice(0, 8)}…` : "",
      })),
    });
  } catch (error) {
    console.error("[fifa-bot/announce]", error);
    const message = error instanceof Error ? error.message : "Announce failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
