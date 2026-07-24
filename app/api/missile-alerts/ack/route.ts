import { NextResponse } from "next/server";
import { verifyMissileAlertCronAuth } from "@/lib/missile-alerts/cron-auth";
import { markAlertsSeen } from "@/lib/missile-alerts/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Mark alert ids as delivered (Baileys / external senders). */
export async function POST(request: Request) {
  if (!verifyMissileAlertCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { ids?: unknown };
  try {
    payload = (await request.json()) as { ids?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = Array.isArray(payload.ids)
    ? payload.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  await markAlertsSeen(ids);
  return NextResponse.json({ ok: true, marked: ids.length });
}
