import { NextResponse } from "next/server";
import { fetchMatchCenter } from "@/lib/football/match-center";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const match = await fetchMatchCenter(id, true);
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    return NextResponse.json(match);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Match fetch failed";
    console.error("[match] fetch failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
