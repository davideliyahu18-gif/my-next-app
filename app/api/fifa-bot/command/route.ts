import { NextResponse } from "next/server";
import { runFifaBotCommand } from "@/lib/fifa-bot/commands";
import { verifyFifaBotCommandAuth } from "@/lib/fifa-bot/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!verifyFifaBotCommandAuth(request)) {
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
    const result = await runFifaBotCommand(text);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[fifa-bot/command]", error);
    const message = error instanceof Error ? error.message : "Command failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
