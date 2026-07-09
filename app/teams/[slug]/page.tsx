import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import {
  getFullSchedule,
  getGroupStandings,
  getAllScorers,
} from "@/lib/api";
import { formatGoalDifference } from "@/lib/utils";
import {
  countryFlag,
  HEBREW_TEAM_NAMES,
  hebrewTeamName,
} from "@/lib/team-display";
import type { ScheduleMatchView } from "@/lib/types";

export const revalidate = 30;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return Object.keys(HEBREW_TEAM_NAMES).map((code) => ({
    slug: code.toLowerCase(),
  }));
}

function MatchCard({ match, code }: { match: ScheduleMatchView; code: string }) {
  const isHome = match.homeCode.toUpperCase() === code;
  const score =
    match.homeScore !== null && match.awayScore !== null
      ? `${match.homeScore} - ${match.awayScore}`
      : match.timeLabel;

  return (
    <Link
      href={`/highlights/${match.id}`}
      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3 transition-colors hover:border-gold/30"
    >
      <div className="min-w-0 flex-1 text-right">
        <p className={`truncate text-sm font-bold ${isHome ? "text-gold" : "text-white"}`}>
          {match.homeFlag} {match.home}
        </p>
        <p className={`truncate text-sm font-bold ${!isHome ? "text-gold" : "text-white"}`}>
          {match.awayFlag} {match.away}
        </p>
      </div>
      <div className="shrink-0 text-center">
        <p className="text-sm font-black tabular-nums text-white">{score}</p>
        <p className="mt-0.5 text-[10px] text-zinc-500">
          {match.dateLabel}
          {match.status === "live" ? " · LIVE" : ""}
        </p>
      </div>
    </Link>
  );
}

export default async function TeamPage({ params }: PageProps) {
  const { slug } = await params;
  const code = slug.toUpperCase();

  if (!HEBREW_TEAM_NAMES[code] && !/^[A-Z]{3}$/.test(code)) {
    notFound();
  }

  const name = hebrewTeamName(code, code);
  const flag = countryFlag(code);

  const [standings, schedule, scorers] = await Promise.all([
    getGroupStandings(),
    getFullSchedule(),
    getAllScorers(),
  ]);

  let groupLabel: string | null = null;
  let standingRow:
    | { name: string; code: string; flag: string; played: number; gd: number; pts: number }
    | null = null;
  let groupTeams:
    | { name: string; code: string; flag: string; played: number; gd: number; pts: number }[]
    | null = null;

  for (const group of standings) {
    const found = group.teams.find((team) => team.code.toUpperCase() === code);
    if (found) {
      groupLabel = group.group;
      standingRow = found;
      groupTeams = group.teams;
      break;
    }
  }

  const teamMatches = schedule.filter(
    (match) =>
      match.homeCode.toUpperCase() === code || match.awayCode.toUpperCase() === code,
  );
  const upcoming = teamMatches
    .filter((match) => match.status === "upcoming" || match.status === "live")
    .slice(0, 6);
  const recent = teamMatches
    .filter((match) => match.status === "finished")
    .slice(-6)
    .reverse();

  const teamScorers = scorers
    .filter((scorer) => scorer.teamCode?.toUpperCase() === code)
    .slice(0, 8);

  const rank =
    groupTeams && standingRow
      ? groupTeams.findIndex((team) => team.code.toUpperCase() === code) + 1
      : null;

  return (
    <div dir="rtl" className="min-h-screen bg-background font-sans text-foreground">
      <Header />
      <main className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
          <Link href="/" className="hover:text-gold">
            בית
          </Link>
          <span>/</span>
          <Link href="/teams" className="hover:text-gold">
            נבחרות
          </Link>
          <span>/</span>
          <span className="text-white">{name}</span>
        </div>

        <section className="overflow-hidden rounded-3xl border border-gold/20 bg-gradient-to-l from-card via-card to-gold/10 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-5">
            <span className="text-6xl drop-shadow-lg md:text-7xl">{flag || "🏳️"}</span>
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-gold">{code}</p>
              <h1 className="mt-1 text-3xl font-black text-white md:text-5xl">{name}</h1>
              <p className="mt-2 text-sm text-zinc-400">
                {groupLabel ? `בית ${groupLabel}` : "מונדיאל 2026"}
                {rank ? ` · מקום ${rank}` : ""}
                {standingRow ? ` · ${standingRow.pts} נק׳` : ""}
              </p>
            </div>
          </div>

          {standingRow && (
            <div className="mt-6 grid grid-cols-3 gap-3 md:max-w-md">
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-center">
                <p className="text-xl font-black text-gold">{standingRow.played}</p>
                <p className="text-[10px] text-zinc-500">משחקים</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-center">
                <p className="text-xl font-black text-gold">
                  {formatGoalDifference(standingRow.gd)}
                </p>
                <p className="text-[10px] text-zinc-500">הפרש</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-center">
                <p className="text-xl font-black text-gold">{standingRow.pts}</p>
                <p className="text-[10px] text-zinc-500">נקודות</p>
              </div>
            </div>
          )}
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <section className="rounded-2xl border border-white/[0.07] bg-card p-5">
              <h2 className="text-sm font-extrabold text-white">משחקים קרובים</h2>
              <div className="mt-4 space-y-2">
                {upcoming.length === 0 ? (
                  <p className="py-6 text-center text-sm text-zinc-500">אין משחקים קרובים</p>
                ) : (
                  upcoming.map((match) => (
                    <MatchCard key={match.id} match={match} code={code} />
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.07] bg-card p-5">
              <h2 className="text-sm font-extrabold text-white">משחקים אחרונים</h2>
              <div className="mt-4 space-y-2">
                {recent.length === 0 ? (
                  <p className="py-6 text-center text-sm text-zinc-500">אין תוצאות עדיין</p>
                ) : (
                  recent.map((match) => (
                    <MatchCard key={match.id} match={match} code={code} />
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6 lg:col-span-5">
            {groupTeams && (
              <section className="rounded-2xl border border-white/[0.07] bg-card p-5">
                <h2 className="text-sm font-extrabold text-white">
                  טבלת בית {groupLabel}
                </h2>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-zinc-500">
                      <th className="px-2 py-2 text-right">#</th>
                      <th className="px-2 py-2 text-right">קבוצה</th>
                      <th className="px-2 py-2 text-center">מש׳</th>
                      <th className="px-2 py-2 text-center">+/-</th>
                      <th className="px-2 py-2 text-center">נק׳</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupTeams.map((team, index) => {
                      const active = team.code.toUpperCase() === code;
                      return (
                        <tr
                          key={team.code || team.name}
                          className={`border-t border-white/[0.04] ${
                            active ? "bg-gold/10" : ""
                          }`}
                        >
                          <td className="px-2 py-2.5 text-zinc-500">{index + 1}</td>
                          <td className="px-2 py-2.5">
                            <Link
                              href={`/teams/${team.code.toLowerCase()}`}
                              className={`flex items-center gap-2 font-semibold ${
                                active ? "text-gold" : "text-white hover:text-gold"
                              }`}
                            >
                              <span>{team.flag}</span>
                              <span className="truncate">{team.name}</span>
                            </Link>
                          </td>
                          <td className="px-2 py-2.5 text-center text-zinc-400">
                            {team.played}
                          </td>
                          <td className="px-2 py-2.5 text-center text-xs text-zinc-400">
                            {formatGoalDifference(team.gd)}
                          </td>
                          <td className="px-2 py-2.5 text-center font-black text-gold">
                            {team.pts}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}

            <section className="rounded-2xl border border-white/[0.07] bg-card p-5">
              <h2 className="text-sm font-extrabold text-white">מבקיעים מהנבחרת</h2>
              <div className="mt-3 space-y-2">
                {teamScorers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-zinc-500">
                    אין נתוני שערים עדיין
                  </p>
                ) : (
                  teamScorers.map((scorer, index) => (
                    <div
                      key={`${scorer.name}-${index}`}
                      className="flex items-center justify-between rounded-xl px-2 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {scorer.name}
                        </p>
                      </div>
                      <span className="text-lg font-black text-gold">{scorer.goals}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <Link
              href="/watch"
              className="block rounded-2xl border border-gold/25 bg-gold/10 px-5 py-4 text-center text-sm font-bold text-gold transition-colors hover:bg-gold/20"
            >
              איפה לצפות במשחקים?
            </Link>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
