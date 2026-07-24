import { NextResponse } from "next/server";
import { verifyMissileAlertCronAuth } from "@/lib/missile-alerts/cron-auth";
import { runMissileAlertPoll } from "@/lib/missile-alerts/poll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!verifyMissileAlertCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const dryNotify = url.searchParams.get("dry") === "1";
    const includeDemo = url.searchParams.get("demo") === "1";
    const summary = await runMissileAlertPoll({ dryNotify, includeDemo });
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[cron/missile-alerts]", error);
    const message = error instanceof Error ? error.message : "Poll failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
