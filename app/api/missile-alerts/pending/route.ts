import { NextResponse } from "next/server";
import { verifyMissileAlertCronAuth } from "@/lib/missile-alerts/cron-auth";
import { messagesToMissileAlerts } from "@/lib/missile-alerts/format";
import { hasSeenAlert } from "@/lib/missile-alerts/store";
import { fetchTelegramLaunchMessages } from "@/lib/rockets/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Fresh Iran→Kuwait alerts with full bodies (for Baileys local sender). */
export async function GET(request: Request) {
  if (!verifyMissileAlertCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { messages, errors } = await fetchTelegramLaunchMessages();
    const alerts = messagesToMissileAlerts(messages);
    const fresh = [];
    for (const alert of alerts) {
      if (await hasSeenAlert(alert.id)) continue;
      fresh.push(alert);
    }

    return NextResponse.json({
      ok: true,
      alerts: fresh,
      errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
