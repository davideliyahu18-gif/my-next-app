import { NextResponse } from "next/server";
import { sendPushToSubscriber } from "@/lib/push/send";
import {
  savePushSubscriber,
  type PushSubscriptionJSON,
} from "@/lib/push/store";
import { isPushConfigured } from "@/lib/push/vapid";

export const dynamic = "force-dynamic";

type Body = {
  subscription?: PushSubscriptionJSON;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  leagues?: string[];
};

export async function POST(request: Request) {
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  }

  try {
    const body = (await request.json()) as Body;
    if (
      !body.subscription?.endpoint ||
      !body.subscription.keys?.p256dh ||
      !body.subscription.keys?.auth
    ) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    if (!body.title?.trim() || !body.body?.trim()) {
      return NextResponse.json({ error: "Missing title/body" }, { status: 400 });
    }

    const subscriber = await savePushSubscriber({
      subscription: {
        endpoint: String(body.subscription.endpoint),
        expirationTime: body.subscription.expirationTime ?? null,
        keys: {
          p256dh: String(body.subscription.keys.p256dh),
          auth: String(body.subscription.keys.auth),
        },
      },
      leagues: body.leagues,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    const result = await sendPushToSubscriber(subscriber, {
      title: body.title.trim().slice(0, 120),
      body: body.body.trim().slice(0, 240),
      url: body.url || "/#today",
      tag: body.tag || "goal-client",
    });

    return NextResponse.json({ ok: result.ok, gone: result.gone, error: result.error });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deliver failed";
    console.error("[push] deliver failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
