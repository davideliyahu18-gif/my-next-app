import { NextResponse } from "next/server";
import { getHealthSnapshot } from "@/lib/tlv-control/utils/source-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { sources: getHealthSnapshot(), timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
