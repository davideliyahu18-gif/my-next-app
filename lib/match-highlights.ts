import { unstable_cache } from "next/cache";
import type { LiveMatchView } from "./types";
import {
  buildHighlightSearchUrl,
  findYoutubeHighlightUrl,
} from "./youtube-highlights";

const cachedYoutubeHighlight = unstable_cache(
  async (
    homeCode: string,
    awayCode: string,
    home: string,
    away: string,
  ): Promise<string | null> => {
    return findYoutubeHighlightUrl(home, away, homeCode, awayCode);
  },
  ["youtube-match-highlight"],
  { revalidate: 1800 },
);

export async function resolveMatchHighlightUrl(
  match: Pick<
    LiveMatchView,
    "status" | "home" | "away" | "homeCode" | "awayCode"
  >,
): Promise<string | null> {
  const searchUrl = buildHighlightSearchUrl(
    match.home,
    match.away,
    match.homeCode,
    match.awayCode,
  );

  if (match.status === "upcoming") return null;

  if (match.status === "live") {
    return searchUrl;
  }

  const direct = await cachedYoutubeHighlight(
    match.homeCode,
    match.awayCode,
    match.home,
    match.away,
  );

  return direct ?? searchUrl;
}

export async function attachHighlightUrls(
  matches: LiveMatchView[],
): Promise<LiveMatchView[]> {
  return Promise.all(
    matches.map(async (match) => ({
      ...match,
      highlightUrl: await resolveMatchHighlightUrl(match),
    })),
  );
}
