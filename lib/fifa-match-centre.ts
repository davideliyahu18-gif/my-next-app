import { FIFA_CONFIG } from "./constants";

export function buildFifaMatchCentreUrl(params: {
  matchId: string;
  kickoffAt: string;
  idCompetition?: string;
  idSeason?: string;
  idStage?: string;
  locale?: "he" | "en";
}): string {
  const competition = params.idCompetition || FIFA_CONFIG.idCompetition;
  const season = params.idSeason || FIFA_CONFIG.idSeason;
  const stage = params.idStage || FIFA_CONFIG.idStage;
  const date = params.kickoffAt.slice(0, 10);
  const locale = params.locale ?? "en";

  return `https://www.fifa.com/${locale}/match-centre/match/${competition}/${season}/${stage}/${params.matchId}?date=${date}`;
}

export function buildInternalHighlightPath(matchId: string): string {
  return `/highlights/${matchId}`;
}

export function resolveMatchHighlightPath(
  match: Pick<
    LiveMatchCentreParams,
    "id" | "status" | "kickoffAt" | "idCompetition" | "idSeason" | "idStage"
  >,
): string | null {
  if (match.status === "upcoming") return null;
  return buildInternalHighlightPath(match.id);
}

export function resolveFifaCentreUrl(
  match: LiveMatchCentreParams,
  locale: "he" | "en" = "en",
): string {
  return buildFifaMatchCentreUrl({
    matchId: match.id,
    kickoffAt: match.kickoffAt,
    idCompetition: match.idCompetition,
    idSeason: match.idSeason,
    idStage: match.idStage,
    locale,
  });
}

export type LiveMatchCentreParams = {
  id: string;
  kickoffAt: string;
  idCompetition: string;
  idSeason: string;
  idStage: string;
  status: "live" | "upcoming" | "finished";
};

export function attachHighlightPaths<T extends LiveMatchCentreParams>(
  matches: T[],
): (T & { highlightUrl: string | null; fifaCentreUrl: string })[] {
  return matches.map((match) => ({
    ...match,
    highlightUrl: resolveMatchHighlightPath(match),
    fifaCentreUrl: resolveFifaCentreUrl(match),
  }));
}
