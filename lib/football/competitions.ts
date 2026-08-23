/** Leagues tracked on the site — data from 365scores (free public API). */

export interface FootballLeague {
  /** 365scores competition id */
  id: number;
  /** Short slug for URLs / keys */
  slug: string;
  nameHe: string;
  nameEn: string;
  countryFlag: string;
  /** ESPN league id fallback (optional) */
  espnId?: string;
}

export const FOOTBALL_LEAGUES: FootballLeague[] = [
  {
    id: 11,
    slug: "laliga",
    nameHe: "ליגה ספרדית",
    nameEn: "La Liga",
    countryFlag: "🇪🇸",
    espnId: "esp.1",
  },
  {
    id: 25,
    slug: "bundesliga",
    nameHe: "ליגה גרמנית",
    nameEn: "Bundesliga",
    countryFlag: "🇩🇪",
    espnId: "ger.1",
  },
  {
    id: 7,
    slug: "premier-league",
    nameHe: "ליגה אנגלית",
    nameEn: "Premier League",
    countryFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    espnId: "eng.1",
  },
  {
    id: 42,
    slug: "ligat-haal",
    nameHe: "ליגת העל",
    nameEn: "Israeli Premier League",
    countryFlag: "🇮🇱",
    espnId: "isr.1",
  },
  {
    id: 35,
    slug: "ligue-1",
    nameHe: "ליגה צרפתית",
    nameEn: "Ligue 1",
    countryFlag: "🇫🇷",
    espnId: "fra.1",
  },
  {
    id: 17,
    slug: "serie-a",
    nameHe: "ליגה איטלקית",
    nameEn: "Serie A",
    countryFlag: "🇮🇹",
    espnId: "ita.1",
  },
];

export const LEAGUE_BY_ID = new Map(
  FOOTBALL_LEAGUES.map((league) => [league.id, league]),
);

export const LEAGUE_BY_SLUG = new Map(
  FOOTBALL_LEAGUES.map((league) => [league.slug, league]),
);

export function getLeagueIdsCsv(): string {
  return FOOTBALL_LEAGUES.map((league) => league.id).join(",");
}
