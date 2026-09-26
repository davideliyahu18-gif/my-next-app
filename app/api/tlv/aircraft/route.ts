import { NextResponse } from "next/server";
import { getAircraftSnapshot } from "@/lib/tlv-control/providers/aircraft-provider";
import { DEFAULT_RADIUS_NM, RADIUS_OPTIONS_NM } from "@/lib/tlv-control/utils/geo";

export const dynamic = "force-dynamic";
// Edge, not Node.js: the ADS-B providers work fine from a normal browser/
// residential connection (verified directly) but were failing from this
// project's Node.js serverless functions — most likely Cloudflare bot
// mitigation against that IP range. Vercel's Edge Network egresses through a
// different network path, which may avoid that block. All of this route's
// dependencies (fetch, AbortController, globalThis) are Edge-compatible.
export const runtime = "edge";

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
