import { NextResponse } from "next/server";
import { getAircraftSnapshot } from "@/lib/iran-airspace/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("refresh") === "1";
  const snapshot = await getAircraftSnapshot({ force });

  return NextResponse.json(snapshot, {
    status: snapshot.aircraft.length > 0 ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}
