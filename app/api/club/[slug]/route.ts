import { NextResponse } from "next/server";
import { fetchClubProfile } from "@/lib/football/match-center";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  try {
    const club = await fetchClubProfile(slug);
    if (!club) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }
    return NextResponse.json(club);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Club fetch failed";
    console.error("[club] fetch failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
