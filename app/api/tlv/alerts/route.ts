import { NextResponse } from "next/server";
import { getAlertsSnapshot } from "@/lib/tlv-control/providers/oref-provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("refresh") === "1";
  const snapshot = await getAlertsSnapshot(force);
  return NextResponse.json(snapshot, {
    status: snapshot.state === "connected" ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}
