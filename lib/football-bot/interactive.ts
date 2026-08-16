import {
  getEnabledFootballCompetitions,
  type FootballCompetition,
} from "@/lib/football/competitions";

export type FootballInteractiveOption = {
  id: string;
  title: string;
  description?: string;
  header?: string;
};

export type FootballLeagueSelectInteractive = {
  kind: "league_select";
  intent: "schedule" | "lineup" | "standings";
  title: string;
  body: string;
  footer: string;
  buttonText: string;
  sectionTitle: string;
  options: FootballInteractiveOption[];
};

function shortLeagueTitle(competition: FootballCompetition): string {
  const he = competition.nameHe;
  const paren = he.indexOf(" (");
  if (paren > 0) return he.slice(0, paren).trim();
  return he;
}

function leagueDescription(competition: FootballCompetition): string {
  const he = competition.nameHe;
  const match = he.match(/\(([^)]+)\)/);
  if (match?.[1]) return match[1];
  return competition.nameEn;
}

/** Interactive league picker payload for WhatsApp native-flow buttons. */
export function buildScheduleLeagueSelect(
  competitions: FootballCompetition[] = getEnabledFootballCompetitions(),
): FootballLeagueSelectInteractive {
  const options: FootballInteractiveOption[] = competitions.map(
    (competition) => ({
      id: `fb:schedule:${competition.id}`,
      title: shortLeagueTitle(competition),
      description: leagueDescription(competition),
    }),
  );
  options.push({
    id: "fb:schedule:all",
    title: "הכל",
    description: "כל הליגות",
  });

  return {
    kind: "league_select",
    intent: "schedule",
    title: "📋 לוח משחקים",
    body: "בחרו ליגה מהרשימה 👇",
    footer: "דוד – עדכוני מונדיאל ⚽",
    buttonText: "בחרו ליגה",
    sectionTitle: "ליגות",
    options,
  };
}

export function buildLineupLeagueSelect(
  competitions: FootballCompetition[] = getEnabledFootballCompetitions(),
): FootballLeagueSelectInteractive {
  const options: FootballInteractiveOption[] = competitions.map(
    (competition) => ({
      id: `fb:lineup:${competition.id}`,
      title: shortLeagueTitle(competition),
      description: leagueDescription(competition),
    }),
  );

  return {
    kind: "league_select",
    intent: "lineup",
    title: "🧍 הרכבים",
    body: "בחרו ליגה להרכבים 👇",
    footer: "דוד – עדכוני מונדיאל ⚽",
    buttonText: "בחרו ליגה",
    sectionTitle: "ליגות",
    options,
  };
}

export function buildStandingsLeagueSelect(
  competitions: FootballCompetition[] = getEnabledFootballCompetitions(),
): FootballLeagueSelectInteractive {
  const options: FootballInteractiveOption[] = competitions.map(
    (competition) => ({
      id: `fb:standings:${competition.id}`,
      title: shortLeagueTitle(competition),
      description: leagueDescription(competition),
    }),
  );

  return {
    kind: "league_select",
    intent: "standings",
    title: "📊 טבלה",
    body: "בחרו ליגה לטבלה העדכנית 👇",
    footer: "דוד – עדכוני מונדיאל ⚽",
    buttonText: "בחרו ליגה",
    sectionTitle: "ליגות",
    options,
  };
}

/** Map a WhatsApp button/list id back to a Hebrew bot command. */
export function commandFromInteractiveId(rawId: string): string | null {
  const id = rawId.trim();
  const match = /^fb:(schedule|lineup|standings):(.+)$/i.exec(id);
  if (!match) return null;
  const intent = match[1].toLowerCase();
  const pick = match[2].trim();
  if (!pick) return null;
  const prefix =
    intent === "lineup" ? "הרכב" : intent === "standings" ? "טבלה" : "לוח";
  const arg = pick.toLowerCase() === "all" ? "הכל" : pick;
  return `${prefix} ${arg}`;
}
