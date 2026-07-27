import {
  getEnabledFootballCompetitions,
  type FootballCompetition,
} from "@/lib/football/competitions";

export type LeaguePick =
  | { kind: "all" }
  | { kind: "one"; competition: FootballCompetition }
  | { kind: "none" };

const LEAGUE_ALIASES: { id: string; aliases: string[] }[] = [
  {
    id: "eng.1",
    aliases: [
      "אנגלית",
      "אנגליה",
      "פרמייר",
      "פרמייר ליג",
      "premier",
      "epl",
      "eng",
      "eng.1",
    ],
  },
  {
    id: "esp.1",
    aliases: [
      "ספרדית",
      "ספרד",
      "לה ליגה",
      "לליגה",
      "laliga",
      "la liga",
      "esp",
      "esp.1",
    ],
  },
  {
    id: "isr.1",
    aliases: [
      "ישראלית",
      "ישראל",
      "ליגת העל",
      "ליגת-העל",
      "israeli",
      "isr",
      "isr.1",
    ],
  },
  {
    id: "ita.1",
    aliases: [
      "איטלקית",
      "איטליה",
      "סרייה",
      "סריה",
      "סרייה א",
      "סריה א",
      "serie a",
      "seriea",
      "ita",
      "ita.1",
    ],
  },
];

const ALL_ALIASES = ["0", "הכל", "כולם", "כל הליגות", "all", "everyone"];

function normalizeLeagueQuery(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/['׳״"`]/g, "")
    .replace(/[?!.,]/g, "")
    .replace(/\s+/g, " ");
}

/** Resolve a typed league choice (number / Hebrew name / id). */
export function resolveLeaguePick(raw: string): LeaguePick {
  const query = normalizeLeagueQuery(raw);
  if (!query) return { kind: "none" };

  if (ALL_ALIASES.includes(query)) return { kind: "all" };

  const competitions = getEnabledFootballCompetitions();
  const byId = new Map(competitions.map((c) => [c.id, c]));

  // Menu numbers follow current enabled order: 1..N
  if (/^\d+$/.test(query)) {
    const index = Number(query);
    if (index >= 1 && index <= competitions.length) {
      return { kind: "one", competition: competitions[index - 1] };
    }
    return { kind: "none" };
  }

  for (const entry of LEAGUE_ALIASES) {
    const hit = entry.aliases.some((alias) => {
      const a = normalizeLeagueQuery(alias);
      return (
        query === a ||
        query.startsWith(`${a} `) ||
        query.endsWith(` ${a}`) ||
        (a.length >= 4 && query.includes(a))
      );
    });
    if (!hit) continue;
    const competition = byId.get(entry.id);
    if (competition) return { kind: "one", competition };
  }

  for (const competition of competitions) {
    const nameHe = normalizeLeagueQuery(competition.nameHe);
    const nameEn = normalizeLeagueQuery(competition.nameEn);
    const firstHe = nameHe.split(" ")[0] ?? "";
    if (
      query === competition.id.toLowerCase() ||
      (firstHe.length >= 3 && (nameHe.includes(query) || query.includes(firstHe))) ||
      (nameEn && nameEn.includes(query))
    ) {
      return { kind: "one", competition };
    }
  }

  return { kind: "none" };
}

/** Extract "לוח …" / "לוז …" trailing league query, if any. */
export function extractScheduleLeagueQuery(raw: string): string | null {
  const text = normalizeLeagueQuery(raw);
  const prefixes = ["לוח", "לוז", "לו״ז", "לו'ז", "schedule"];
  for (const prefix of prefixes) {
    if (text === prefix) return "";
    if (text.startsWith(`${prefix} `)) {
      return text.slice(prefix.length).trim();
    }
  }
  if (text.includes("משחקים הבאים")) return "";
  return null;
}

/** Extract "הרכב …" / "הרכבים …" trailing league query, if any. */
export function extractLineupLeagueQuery(raw: string): string | null {
  const text = normalizeLeagueQuery(raw);
  const prefixes = ["הרכב", "הרכבים", "lineup", "lineups"];
  for (const prefix of prefixes) {
    if (text === prefix) return "";
    if (text.startsWith(`${prefix} `)) {
      return text.slice(prefix.length).trim();
    }
  }
  return null;
}

export function formatScheduleLeagueMenu(
  competitions: FootballCompetition[] = getEnabledFootballCompetitions(),
): string {
  const lines = [
    "📋 *לוח משחקים — איזו ליגה?*",
    "",
    "בחרו מספר או שם:",
  ];

  competitions.forEach((competition, index) => {
    lines.push(`${index + 1}️⃣ *${competition.nameHe}*`);
  });

  lines.push("");
  lines.push("0️⃣ *הכל* — כל הליגות");
  lines.push("");
  lines.push("דוגמה: *לוח 1* · *לוח אנגלית* · *לוח ספרדית*");
  return lines.join("\n");
}

export function formatLineupLeagueMenu(
  competitions: FootballCompetition[] = getEnabledFootballCompetitions(),
): string {
  const lines = [
    "🧍 *הרכבים — איזו ליגה?*",
    "",
    "בחרו מספר או שם:",
  ];

  competitions.forEach((competition, index) => {
    lines.push(`${index + 1}️⃣ *${competition.nameHe}*`);
  });

  lines.push("");
  lines.push("דוגמה: *הרכב 1* · *הרכב אנגלית* · *הרכב ספרדית*");
  lines.push("הרכבים נשלחים גם אוטומטית בתזכורת לפני המשחק.");
  return lines.join("\n");
}
