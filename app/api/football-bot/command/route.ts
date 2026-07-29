import { NextResponse } from "next/server";
import { runFootballBotCommand } from "@/lib/football-bot/commands";
import { verifyFootballBotCommandAuth } from "@/lib/football-bot/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!verifyFootballBotCommandAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text =
    typeof payload.text === "string"
      ? payload.text
      : typeof payload.command === "string"
        ? payload.command
        : "";

  if (!text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const result = await runFootballBotCommand(text);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[football-bot/command]", error);
    const message = error instanceof Error ? error.message : "Command failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
