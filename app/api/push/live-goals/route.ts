import { NextResponse } from "next/server";
import { FEED_API_SECRET } from "@/lib/constants";
import { processLiveGoals } from "@/lib/push/live-goals";
import type { PushSubscriptionJSON } from "@/lib/push/store";

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

function readSubscription(body: unknown): PushSubscriptionJSON | null {
  if (!body || typeof body !== "object") return null;
  const subscription = (body as { subscription?: PushSubscriptionJSON })
    .subscription;
  if (
    !subscription?.endpoint ||
    !subscription.keys?.p256dh ||
    !subscription.keys?.auth
  ) {
    return null;
  }
  return {
    endpoint: String(subscription.endpoint),
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      p256dh: String(subscription.keys.p256dh),
      auth: String(subscription.keys.auth),
    },
  };
}

function readLeagues(body: unknown): string[] | undefined {
  if (!body || typeof body !== "object") return undefined;
  const leagues = (body as { leagues?: unknown }).leagues;
  if (!Array.isArray(leagues)) return undefined;
  return leagues.map(String).filter(Boolean);
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = null;
  if (request.method !== "GET") {
    try {
      body = await request.json();
    } catch {
      body = null;
    }
  }

  try {
    const result = await processLiveGoals({
      subscription: readSubscription(body),
      leagues: readLeagues(body),
      userAgent: request.headers.get("user-agent") || undefined,
    });
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
