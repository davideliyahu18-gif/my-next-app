import { NextResponse } from "next/server";
import { isChatAuthorized, isChatConfigured, verifyChatPassword } from "@/lib/chat/auth";
import { CHAT_MAX_HISTORY } from "@/lib/chat/constants";
import { completeChat, getChatProviderLabel } from "@/lib/chat/complete";
import type { ChatRequestBody, ChatResponseBody } from "@/lib/chat/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    configured: isChatConfigured(),
    provider: getChatProviderLabel(),
  });
}

export async function POST(request: Request) {
  if (!isChatConfigured()) {
    return NextResponse.json(
      { ok: false, error: "הצ'אט לא מוגדר בשרת (CHAT_PASSWORD + GROQ_API_KEY)" },
      { status: 503 },
    );
  }

  if (!isChatAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "סיסמה שגויה" }, { status: 401 });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter(
          (message) =>
            message &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string" &&
            message.content.trim(),
        )
        .slice(-CHAT_MAX_HISTORY)
        .map((message) => ({
          role: message.role,
          content: message.content.trim(),
        }))
    : [];

  const last = messages.at(-1);
  if (!last || last.role !== "user") {
    return NextResponse.json(
      { ok: false, error: "נדרשת הודעת משתמש אחרונה" },
      { status: 400 },
    );
  }

  try {
    const answer = await completeChat(messages);
    const payload: ChatResponseBody = {
      ok: true,
      message: {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer,
        createdAt: new Date().toISOString(),
      },
    };
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא צפויה";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  if (!getChatPasswordConfigured()) {
    return NextResponse.json({ ok: false, error: "הצ'אט לא מוגדר" }, { status: 503 });
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = String(body.password || "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }

  if (!verifyChatPassword(password)) {
    return NextResponse.json({ ok: false, error: "סיסמה שגויה" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

function getChatPasswordConfigured(): boolean {
  return Boolean(process.env.CHAT_PASSWORD?.trim());
}
