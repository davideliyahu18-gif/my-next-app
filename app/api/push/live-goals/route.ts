import { NextResponse } from "next/server";
import { FEED_API_SECRET } from "@/lib/constants";
import { processLiveGoals } from "@/lib/push/live-goals";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  // Public tick is OK (rate-limited) so open site visitors can drive detection.
  // Optional secret still accepted for cron / external pingers.
  const secret = FEED_API_SECRET || process.env.PUSH_SEND_SECRET || "";
  if (!secret) return true;
  const header = request.headers.get("authorization") || "";
  if (!header) return true;
  return header === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processLiveGoals();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Live goals tick failed";
    console.error("[push] live-goals failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
