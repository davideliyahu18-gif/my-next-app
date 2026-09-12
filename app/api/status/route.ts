import { NextResponse } from "next/server";
import { getSystemStatus } from "@/lib/iran-airspace/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const status = await getSystemStatus();
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
