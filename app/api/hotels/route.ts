import { NextResponse } from "next/server";
import { HOTELS_DEFAULT_CITY, HOTELS_DEFAULT_RADIUS_KM } from "@/lib/hotels/constants";
import { getHotelsSnapshot } from "@/lib/hotels/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = (searchParams.get("city") || HOTELS_DEFAULT_CITY).trim();
  const force = searchParams.get("refresh") === "1";
  const radiusParam = Number(searchParams.get("radius"));
  const radiusKm =
    Number.isFinite(radiusParam) && radiusParam > 0
      ? Math.min(30, radiusParam)
      : HOTELS_DEFAULT_RADIUS_KM;

  if (!city) {
    return NextResponse.json(
      { ok: false, error: "יש להזין עיר" },
      { status: 400 },
    );
  }

  const snapshot = await getHotelsSnapshot({ query: city, radiusKm, force });

  return NextResponse.json(snapshot, {
    status: snapshot.ok ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}
