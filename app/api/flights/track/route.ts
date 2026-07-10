import { NextResponse } from "next/server";
import { findTrackedFlights } from "@/lib/flights/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const codes = (searchParams.get("codes") || "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
  const force = searchParams.get("refresh") === "1";

  const flights = await findTrackedFlights(codes, force);

  return NextResponse.json(
    {
      ok: true,
      flights,
      timestamp: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
