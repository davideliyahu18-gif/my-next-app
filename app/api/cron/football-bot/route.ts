import { NextResponse } from "next/server";
import { verifyFootballBotCronAuth } from "@/lib/football-bot/cron-auth";
import { runFootballBotPoll } from "@/lib/football-bot/poll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!verifyFootballBotCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dryNotify = new URL(request.url).searchParams.get("dry") === "1";
    const summary = await runFootballBotPoll({ dryNotify });
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[cron/football-bot]", error);
    const message = error instanceof Error ? error.message : "Poll failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
