/**
 * Resolve official FOX Sports World Cup highlight clips for a finished match.
 * Prefer the ~4 minute game recap (`*_HL_*_lowres.mp4`).
 */

const FOX_API_KEY =
  process.env.FOX_SPORTS_API_KEY || "jE7yBJVRNAwdDesMgTzTXUUSx1It41Fq";
const FOX_API = "https://api.foxsports.com/bifrost/v1";
const FOX_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** FIFA 3-letter → English long name used by FOX Sports. */
const FOX_TEAM_EN: Record<string, string> = {
  ALG: "Algeria",
  ARG: "Argentina",
  AUS: "Australia",
  AUT: "Austria",
  BEL: "Belgium",
  BIH: "Bosnia and Herzegovina",
  BRA: "Brazil",
  CAN: "Canada",
  CIV: "Ivory Coast",
  COD: "DR Congo",
  COL: "Colombia",
  CPV: "Cape Verde",
  CRO: "Croatia",
  CUW: "Curacao",
  CZE: "Czechia",
  ECU: "Ecuador",
  EGY: "Egypt",
  ENG: "England",
  ESP: "Spain",
  FRA: "France",
  GER: "Germany",
  GHA: "Ghana",
  HAI: "Haiti",
  IRN: "Iran",
  IRQ: "Iraq",
  JOR: "Jordan",
  JPN: "Japan",
  KOR: "South Korea",
  KSA: "Saudi Arabia",
  MAR: "Morocco",
  MEX: "Mexico",
  NED: "Netherlands",
  NOR: "Norway",
  NZL: "New Zealand",
  PAN: "Panama",
  PAR: "Paraguay",
  POR: "Portugal",
  QAT: "Qatar",
  RSA: "South Africa",
  SCO: "Scotland",
  SEN: "Senegal",
  SUI: "Switzerland",
  SWE: "Sweden",
  TUN: "Tunisia",
  TUR: "Turkey",
  URU: "Uruguay",
  USA: "USA",
  UZB: "Uzbekistan",
};

export interface FoxHighlightClip {
  title: string;
  fmcId: string;
  mp4Url: string;
  watchUrl: string;
  source: "boxscore" | "trending" | "watch";
}

function monthSegments(kickoffAt: string): string[] {
  const d = new Date(kickoffAt);
  if (Number.isNaN(d.getTime())) {
    return ["202607", "202606"];
  }
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const cur = `${y}${String(m).padStart(2, "0")}`;
  const prevDate = new Date(Date.UTC(y, d.getUTCMonth() - 1, 1));
  const prev = `${prevDate.getUTCFullYear()}${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;
  return [...new Set([cur, prev])];
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function codesMatch(
  upperCode: string,
  lowerCode: string,
  homeCode: string,
  awayCode: string,
): boolean {
  const u = upperCode.toUpperCase();
  const l = lowerCode.toUpperCase();
  const h = homeCode.toUpperCase();
  const a = awayCode.toUpperCase();
  return (u === h && l === a) || (u === a && l === h);
}

async function foxJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": FOX_UA },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function foxHtml(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": FOX_UA },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.text();
}

interface FoxEventHit {
  eventId: string;
  webUrl: string;
  upperCode: string;
  lowerCode: string;
  upperName: string;
  lowerName: string;
}

async function findFoxEvent(options: {
  homeCode: string;
  awayCode: string;
  kickoffAt: string;
}): Promise<FoxEventHit | null> {
  for (const segment of monthSegments(options.kickoffAt)) {
    const data = (await foxJson(
      `${FOX_API}/soccer/specialevent/wc/segment/${segment}?apikey=${FOX_API_KEY}`,
    )) as {
      sectionList?: Array<{
        events?: Array<{
          id?: string;
          entityLink?: { webUrl?: string };
          upperTeam?: { name?: string; longName?: string };
          lowerTeam?: { name?: string; longName?: string };
        }>;
      }>;
    } | null;
    if (!data?.sectionList) continue;

    for (const section of data.sectionList) {
      for (const ev of section.events ?? []) {
        const upperCode = ev.upperTeam?.name || "";
        const lowerCode = ev.lowerTeam?.name || "";
        if (
          !codesMatch(
            upperCode,
            lowerCode,
            options.homeCode,
            options.awayCode,
          )
        ) {
          continue;
        }
        const webUrl = ev.entityLink?.webUrl;
        const eventId = String(ev.id || "").replace(/^soccer/, "");
        if (!webUrl || !eventId) continue;
        return {
          eventId,
          webUrl,
          upperCode,
          lowerCode,
          upperName: ev.upperTeam?.longName || upperCode,
          lowerName: ev.lowerTeam?.longName || lowerCode,
        };
      }
    }
  }
  return null;
}

function pickBestMp4(
  mp4Urls: string[],
  preferredFmcId?: string | null,
): string | null {
  if (!mp4Urls.length) return null;

  // Prefer catch-up lowres when present — much smaller than the 4-min HL master.
  const cuwh = mp4Urls.find((url) => /cuwh/i.test(url));
  if (cuwh) return cuwh;

  const scored = mp4Urls.map((url) => {
    let score = 0;
    const file = url.toLowerCase();
    if (preferredFmcId && url.includes(preferredFmcId)) score += 50;
    if (/4min_.*_hl_|_hl_.*lowres/.test(file)) score += 40;
    if (/_hl_/.test(file)) score += 25;
    if (/goal|equal|comp_yt|rivalry|feature|essay|sot_/.test(file)) score -= 30;
    if (/lowres\.mp4$/.test(file)) score += 5;
    return { url, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.url ?? null;
}

function extractHighlightFromHtml(
  html: string,
  homeEn: string,
  awayEn: string,
): FoxHighlightClip | null {
  const mp4Urls = [
    ...html.matchAll(
      /https:\/\/statics\.foxsports\.com\/mediacloud\/fmc-[a-z0-9]+\/[^"'\\\s]+\.mp4/gi,
    ),
  ].map((m) => m[0]);

  const home = norm(homeEn);
  const away = norm(awayEn);

  // Prefer non-extended "X vs Y Highlights" carousel entries.
  let preferredFmc: string | null = null;
  let preferredTitle = "";
  const titleRe =
    /((?:[A-Za-z .]+)\s+vs\s+(?:[A-Za-z .]+)\s+(?:Extended\s+)?Highlights[^"<]*)/gi;
  for (const match of html.matchAll(titleRe)) {
    const title = match[1].replace(/\s+/g, " ").trim();
    const compact = norm(title);
    const hasTeams =
      (compact.includes(home) && compact.includes(away)) ||
      (compact.includes(away) && compact.includes(home));
    if (!hasTeams) continue;
    if (/extendedhighlights/.test(compact)) continue;
    const around = html.slice(
      Math.max(0, match.index! - 180),
      Math.min(html.length, match.index! + title.length + 180),
    );
    const fmc = around.match(/fmc-[a-z0-9]+/i)?.[0]?.toLowerCase();
    if (fmc) {
      preferredFmc = fmc;
      preferredTitle = title;
      break;
    }
  }

  const mp4Url = pickBestMp4(mp4Urls, preferredFmc);
  if (!mp4Url) return null;
  const fmcId =
    preferredFmc ||
    mp4Url.match(/mediacloud\/(fmc-[a-z0-9]+)\//i)?.[1]?.toLowerCase() ||
    "";
  if (!fmcId) return null;

  return {
    title:
      preferredTitle ||
      `${homeEn} vs ${awayEn} Highlights · 2026 FIFA World Cup`,
    fmcId,
    mp4Url,
    watchUrl: `https://www.foxsports.com/watch/${fmcId}`,
    source: "boxscore",
  };
}

async function findHighlightInTrending(
  homeEn: string,
  awayEn: string,
): Promise<FoxHighlightClip | null> {
  const data = (await foxJson(
    `${FOX_API}/general/trending/videos?duration=4&apikey=${FOX_API_KEY}`,
  )) as {
    data?: {
      results?: Array<{
        title?: string;
        external_id?: string;
        canonical_url?: string;
        mcvod?: {
          proxy_url?: string;
          show_code?: string;
          content_id?: string;
        };
      }>;
    };
  } | null;

  const home = norm(homeEn);
  const away = norm(awayEn);
  for (const row of data?.data?.results ?? []) {
    const title = row.title || "";
    const compact = norm(title);
    if (!compact.includes("highlights")) continue;
    if (compact.includes("extendedhighlights")) continue;
    if (!(compact.includes(home) && compact.includes(away))) continue;
    const show = row.mcvod?.show_code || "";
    if (show && !show.includes("4-minute") && !show.includes("game-recap")) {
      // Still allow if title is clearly the match highlights.
    }
    const fmcId = (
      row.external_id ||
      row.mcvod?.content_id ||
      ""
    ).toLowerCase();
    const mp4Url = row.mcvod?.proxy_url;
    if (!fmcId || !mp4Url) continue;
    return {
      title,
      fmcId,
      mp4Url,
      watchUrl: row.canonical_url?.startsWith("http")
        ? row.canonical_url
        : `https://www.foxsports.com/watch/${fmcId}`,
      source: "trending",
    };
  }
  return null;
}

export async function resolveFoxMatchHighlight(options: {
  homeCode: string;
  awayCode: string;
  kickoffAt: string;
  homeName?: string;
  awayName?: string;
}): Promise<FoxHighlightClip | null> {
  const homeEn =
    FOX_TEAM_EN[options.homeCode.toUpperCase()] ||
    options.homeName ||
    options.homeCode;
  const awayEn =
    FOX_TEAM_EN[options.awayCode.toUpperCase()] ||
    options.awayName ||
    options.awayCode;

  const event = await findFoxEvent(options);
  if (event) {
    const html = await foxHtml(`https://www.foxsports.com${event.webUrl}`);
    if (html) {
      const fromBox = extractHighlightFromHtml(html, homeEn, awayEn);
      if (fromBox) return fromBox;
    }
  }

  const trending = await findHighlightInTrending(homeEn, awayEn);
  if (trending) return trending;

  // Last resort: fetch a related watch page if we know fmc from partial boxscore data.
  if (event) {
    const html = await foxHtml(`https://www.foxsports.com${event.webUrl}`);
    if (html) {
      const watchIds = [
        ...html.matchAll(/\/watch\/(fmc-[a-z0-9]+)/gi),
      ].map((m) => m[1].toLowerCase());
      for (const fmcId of [...new Set(watchIds)].slice(0, 8)) {
        const page = await foxHtml(`https://www.foxsports.com/watch/${fmcId}`);
        if (!page) continue;
        const titleMatch = page.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
        const compact = norm(titleMatch);
        if (!compact.includes("highlights")) continue;
        if (compact.includes("extended")) continue;
        if (!(compact.includes(norm(homeEn)) && compact.includes(norm(awayEn)))) {
          continue;
        }
        const mp4Urls = [
          ...page.matchAll(
            /https:\/\/statics\.foxsports\.com\/mediacloud\/fmc-[a-z0-9]+\/[^"'\\\s]+\.mp4/gi,
          ),
        ].map((m) => m[0]);
        const mp4Url = pickBestMp4(mp4Urls, fmcId);
        if (!mp4Url) continue;
        return {
          title: titleMatch.replace(/\s*\|\s*FOX Sports.*/i, "").trim(),
          fmcId,
          mp4Url,
          watchUrl: `https://www.foxsports.com/watch/${fmcId}`,
          source: "watch",
        };
      }
    }
  }

  return null;
}

export function englishTeamNameForFox(code: string, fallback: string): string {
  return FOX_TEAM_EN[code.toUpperCase()] || fallback;
}
