import { NextResponse } from "next/server";
import { getAircraftSnapshot } from "@/lib/tlv-control/providers/aircraft-provider";
import { DEFAULT_RADIUS_NM, RADIUS_OPTIONS_NM } from "@/lib/tlv-control/utils/geo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("refresh") === "1";
  const radiusParam = Number(searchParams.get("radius"));
  const radiusNm = RADIUS_OPTIONS_NM.includes(radiusParam as (typeof RADIUS_OPTIONS_NM)[number])
    ? radiusParam
    : DEFAULT_RADIUS_NM;

  const snapshot = await getAircraftSnapshot({ radiusNm, force });
  return NextResponse.json(snapshot, {
    status: snapshot.ok ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}
