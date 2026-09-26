import { NextResponse } from "next/server";
import { getAlertsSnapshot } from "@/lib/tlv-control/providers/oref-provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const snapshot = await getAlertsSnapshot();
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
