const YOUTUBE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const VIDEO_ID_PATTERN = /"videoId":"([A-Za-z0-9_-]{11})"/g;

function highlightSearchQuery(
  home: string,
  away: string,
  homeCode?: string,
  awayCode?: string,
): string {
  return `${homeCode || home} ${awayCode || away} FIFA World Cup 2026 highlights`;
}

export function buildHighlightSearchUrl(
  home: string,
  away: string,
  homeCode?: string,
  awayCode?: string,
): string {
  const query = highlightSearchQuery(home, away, homeCode, awayCode);
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

async function youtubeTitle(videoId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      {
        headers: { "User-Agent": YOUTUBE_USER_AGENT },
        next: { revalidate: 3600 },
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { title?: string };
    return data.title?.trim() || null;
  } catch {
    return null;
  }
}

/** Find a YouTube highlights video for a finished match (same logic as the WhatsApp bot). */
export async function findYoutubeHighlightUrl(
  home: string,
  away: string,
  homeCode?: string,
  awayCode?: string,
): Promise<string | null> {
  const query = highlightSearchQuery(home, away, homeCode, awayCode);

  let response: Response;
  try {
    response = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      {
        headers: { "User-Agent": YOUTUBE_USER_AGENT },
        next: { revalidate: 1800 },
      },
    );
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const html = await response.text();
  const seen = new Set<string>();

  for (const match of html.matchAll(VIDEO_ID_PATTERN)) {
    const videoId = match[1];
    if (seen.has(videoId)) continue;
    seen.add(videoId);

    const title = (await youtubeTitle(videoId))?.toLowerCase() ?? "";
    if (!title) continue;
    if (!title.includes("highlight")) continue;

    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  return null;
}
