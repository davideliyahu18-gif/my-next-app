import { NextResponse } from "next/server";
import { getAlertsSnapshot } from "@/lib/tlv-control/providers/oref-provider";

export const dynamic = "force-dynamic";
// Edge, not Node.js — same fix as /api/tlv/aircraft: oref.org.il returned
// HTTP 403 from the Node.js serverless function, most likely the same class
// of WAF/CDN block against that IP range (Israeli government sites tend to
// run aggressive bot mitigation, unsurprisingly for an alert system). All of
// oref-provider.ts (fetch, AbortController, TextDecoder) is Edge-compatible.
export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("refresh") === "1";
  const snapshot = await getAlertsSnapshot(force);
  return NextResponse.json(snapshot, {
    status: snapshot.state === "connected" ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}
