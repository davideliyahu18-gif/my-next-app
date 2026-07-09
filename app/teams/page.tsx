import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { getGroupStandings } from "@/lib/api";
import {
  countryFlag,
  HEBREW_TEAM_NAMES,
  hebrewTeamName,
} from "@/lib/team-display";

export const revalidate = 30;

export default async function TeamsIndexPage() {
  const standings = await getGroupStandings();
  const standingCodes = new Set(
    standings.flatMap((group) => group.teams.map((team) => team.code.toUpperCase())),
  );

  const fromStandings = standings.flatMap((group) =>
    group.teams.map((team) => ({
      code: team.code.toUpperCase(),
      name: team.name,
      flag: team.flag,
      group: group.group,
      pts: team.pts,
    })),
  );

  const extras = Object.keys(HEBREW_TEAM_NAMES)
    .filter((code) => !standingCodes.has(code))
    .map((code) => ({
      code,
      name: hebrewTeamName(code, code),
      flag: countryFlag(code),
      group: null as string | null,
      pts: null as number | null,
    }));

  const teams = [...fromStandings, ...extras].sort((a, b) =>
    a.name.localeCompare(b.name, "he"),
  );

  return (
    <div dir="rtl" className="min-h-screen bg-background font-sans text-foreground">
      <Header />
      <main className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-zinc-400 transition-colors hover:text-gold"
        >
          ← חזרה לדף הבית
        </Link>

        <p className="text-[11px] font-bold tracking-[0.2em] text-gold">TEAMS</p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">נבחרות</h1>
        <p className="mt-3 max-w-xl text-zinc-400">
          בחרו נבחרת לצפייה במשחקים, מיקום בבית ומבקיעים.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teams.map((team) => (
            <Link
              key={team.code}
              href={`/teams/${team.code.toLowerCase()}`}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-gold/35 hover:shadow-[0_12px_32px_rgba(212,175,55,0.08)]"
            >
              <span className="text-3xl">{team.flag}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold text-white">{team.name}</p>
                <p className="text-xs text-zinc-500">
                  {team.group ? `בית ${team.group}` : team.code}
                  {team.pts !== null ? ` · ${team.pts} נק׳` : ""}
                </p>
              </div>
              <span className="text-gold">←</span>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
