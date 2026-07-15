import { NextResponse } from "next/server";
import { verifyFifaBotCronAuth } from "@/lib/fifa-bot/cron-auth";
import { runFifaBotPoll } from "@/lib/fifa-bot/poll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!verifyFifaBotCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dryNotify = new URL(request.url).searchParams.get("dry") === "1";
    const summary = await runFifaBotPoll({ dryNotify });
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[cron/fifa-bot]", error);
    const message = error instanceof Error ? error.message : "Poll failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
