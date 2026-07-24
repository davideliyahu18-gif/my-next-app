import { NextResponse } from "next/server";
import { verifyMissileAlertCronAuth } from "@/lib/missile-alerts/cron-auth";
import { createDemoMissileAlert } from "@/lib/missile-alerts/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Preview a demo Iran→Kuwait alert without sending. */
export async function GET(request: Request) {
  if (!verifyMissileAlertCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alert = createDemoMissileAlert();
  return NextResponse.json({ ok: true, alert });
}

export async function POST(request: Request) {
  return GET(request);
}
