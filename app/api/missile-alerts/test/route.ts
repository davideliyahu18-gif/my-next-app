import { NextResponse } from "next/server";
import { verifyMissileAlertCronAuth } from "@/lib/missile-alerts/cron-auth";
import { createDemoMissileAlert } from "@/lib/missile-alerts/format";
import {
  isMissileNotificationConfigured,
  notifyMissileAlert,
} from "@/lib/missile-alerts/notify";
import { markAlertsSeen } from "@/lib/missile-alerts/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Sends one demo Iran → Kuwait alert (text + WhatsApp location pin).
 * Auth: Bearer CRON_SECRET / MISSILE_ALERT_SECRET / FEED_API_SECRET
 */
export async function POST(request: Request) {
  if (!verifyMissileAlertCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alert = createDemoMissileAlert();
  const configured = isMissileNotificationConfigured();

  if (!configured) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Configure GREEN_API_INSTANCE, GREEN_API_TOKEN, and MISSILE_WHATSAPP_CHAT_ID (or WHATSAPP_GROUP_CHAT_ID)",
        preview: alert,
      },
      { status: 503 },
    );
  }

  const result = await notifyMissileAlert(alert);
  if (result.whatsapp || result.telegram) {
    await markAlertsSeen([alert.id]);
  }

  return NextResponse.json({
    ok: result.whatsapp || result.telegram,
    result,
    alert: {
      id: alert.id,
      text: alert.text,
      location: alert.location,
      launchLocation: alert.launchLocation,
    },
  });
}

export async function GET(request: Request) {
  return POST(request);
}
