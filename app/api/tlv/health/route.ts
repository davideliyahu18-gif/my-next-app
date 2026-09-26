import { NextResponse } from "next/server";
import { getHealthSnapshot } from "@/lib/tlv-control/utils/source-health";
// Imported for its module-level side effect (registers Oref as
// permanently unavailable) so it shows up here even before /api/tlv/alerts
// has been hit.
import "@/lib/tlv-control/providers/oref-provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { sources: getHealthSnapshot(), timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
