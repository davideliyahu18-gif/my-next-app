import { NextResponse } from "next/server";
import { savePushSubscriber } from "@/lib/push/store";
import { sendPushToSubscriber } from "@/lib/push/send";
import { isPushConfigured } from "@/lib/push/vapid";
import { SITE_BRAND } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isPushConfigured()) {
    return NextResponse.json(
      {
        error:
          "Push is not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the server.",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      subscription?: {
        endpoint?: string;
        expirationTime?: number | null;
        keys?: { p256dh?: string; auth?: string };
      };
      leagues?: string[];
    };

    if (
      !body.subscription?.endpoint ||
      !body.subscription.keys?.p256dh ||
      !body.subscription.keys?.auth
    ) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const subscriber = await savePushSubscriber({
      subscription: {
        endpoint: body.subscription.endpoint,
        expirationTime: body.subscription.expirationTime ?? null,
        keys: {
          p256dh: body.subscription.keys.p256dh,
          auth: body.subscription.keys.auth,
        },
      },
      leagues: body.leagues,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    // Immediate proof that push works for this device.
    await sendPushToSubscriber(subscriber, {
      title: `${SITE_BRAND.nameWithEmoji}`,
      body: "ההתראות הופעלו ✓ תקבל פוש על שערי לייב",
      url: "/#today",
      tag: "push-welcome",
    });

    return NextResponse.json({ ok: true, endpoint: subscriber.endpoint });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Subscribe failed";
    console.error("[push] subscribe failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
