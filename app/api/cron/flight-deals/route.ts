import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/flight-deals/cron-auth";
import { runFlightDealScan } from "@/lib/flight-deals/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runFlightDealScan();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[cron/flight-deals]", error);
    const message = error instanceof Error ? error.message : "Scan failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
