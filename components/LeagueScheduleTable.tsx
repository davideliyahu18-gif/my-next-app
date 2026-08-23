"use client";

import type { FootballLeague, LeagueMatchView } from "@/lib/football/leagues-data";
import DashboardCard from "./DashboardCard";

function ScheduleRow({ match }: { match: LeagueMatchView }) {
  const score =
    match.homeScore !== null && match.awayScore !== null
      ? `${match.homeScore} - ${match.awayScore}`
      : match.timeLabel;

  return (
    <tr className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
      <td className="px-4 py-3 text-xs text-zinc-500">{match.dateLabel}</td>
      <td className="px-2 py-3 text-sm font-bold text-white">{match.home}</td>
      <td className="px-2 py-3 text-center text-sm font-black text-gold">{score}</td>
      <td className="px-2 py-3 text-sm font-bold text-white">{match.away}</td>
      <td className="px-4 py-3 text-xs text-zinc-500">{match.statusLabel}</td>
    </tr>
  );
}

export default function LeagueScheduleTable({
  leagues,
  matchesByLeague,
  fetchedAt,
}: {
  leagues: FootballLeague[];
  matchesByLeague: Record<string, LeagueMatchView[]>;
  fetchedAt: string;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">לוח משחקים מלא</h1>
          <p className="mt-2 text-sm text-zinc-500">
            כל הליגות במקום אחד · עודכן{" "}
            {new Date(fetchedAt).toLocaleTimeString("he-IL", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Jerusalem",
            })}
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-500">
          365scores
        </span>
      </div>

      {leagues.map((league) => {
        const matches = matchesByLeague[league.slug] ?? [];
        return (
          <DashboardCard
            key={league.slug}
            title={`${league.countryFlag} ${league.nameHe}`}
            badge={
              <span className="text-[10px] font-semibold text-zinc-500">
                {matches.length} משחקים
              </span>
            }
          >
            {matches.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-zinc-500">
                אין משחקים בלוח לליגה הזו
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] text-zinc-500">
                      <th className="px-4 py-2.5 text-right font-semibold">תאריך</th>
                      <th className="px-2 py-2.5 text-right font-semibold">בית</th>
                      <th className="px-2 py-2.5 text-center font-semibold">תוצאה</th>
                      <th className="px-2 py-2.5 text-right font-semibold">חוץ</th>
                      <th className="px-4 py-2.5 text-right font-semibold">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((match) => (
                      <ScheduleRow key={match.id} match={match} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>
        );
      })}
    </div>
  );
}
