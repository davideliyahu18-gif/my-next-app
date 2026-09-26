import { NextResponse } from "next/server";
import { getWeatherSnapshot } from "@/lib/tlv-control/providers/weather-open-meteo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("refresh") === "1";
  const snapshot = await getWeatherSnapshot(force);
  return NextResponse.json(snapshot, {
    status: snapshot.ok ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}
