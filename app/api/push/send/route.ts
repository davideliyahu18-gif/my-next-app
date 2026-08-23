import { NextResponse } from "next/server";
import { FEED_API_SECRET } from "@/lib/constants";
import { broadcastPush } from "@/lib/push/send";
import { isPushConfigured } from "@/lib/push/vapid";
import { SITE_BRAND } from "@/lib/constants";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = FEED_API_SECRET || process.env.PUSH_SEND_SECRET || "";
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      body?: string;
      url?: string;
      leagues?: string[];
    };

    const result = await broadcastPush(
      {
        title: body.title || SITE_BRAND.nameWithEmoji,
        body: body.body || "עדכון כדורגל חדש",
        url: body.url || "/#today",
      },
      { leagues: body.leagues },
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
