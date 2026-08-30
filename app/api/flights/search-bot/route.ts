import { NextResponse } from "next/server";
import { isFlightsBotConfigured, verifyFlightsBotAuth } from "@/lib/flights-search/auth";
import { handleIncomingMessage } from "@/lib/flights-search/bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Health check for the external WhatsApp connector (scripts/whatsapp-flights-bot). */
export async function GET() {
  return NextResponse.json({ ok: true, configured: isFlightsBotConfigured() });
}

export async function POST(request: Request) {
  if (!isFlightsBotConfigured()) {
    return NextResponse.json(
      { ok: false, error: "FLIGHTS_BOT_SECRET not configured" },
      { status: 503 },
    );
  }

  if (!verifyFlightsBotAuth(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { chatId?: string; text?: string };
  try {
    body = (await request.json()) as { chatId?: string; text?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.chatId || typeof body.text !== "string") {
    return NextResponse.json(
      { ok: false, error: "chatId and text are required" },
      { status: 400 },
    );
  }

  try {
    const reply = await handleIncomingMessage(body.chatId, body.text);
    return NextResponse.json({ ok: true, reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "bot handler failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
