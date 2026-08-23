import type {
  ChampionsLeagueView,
  LeagueMatchView,
} from "@/lib/football/leagues-data";
import { formatGoalDifference } from "@/lib/utils";
import DashboardCard from "./DashboardCard";
import TeamCrest from "./TeamCrest";

function MatchRow({ match }: { match: LeagueMatchView }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const score =
    match.homeScore !== null && match.awayScore !== null
      ? `${match.homeScore} - ${match.awayScore}`
      : match.timeLabel || "VS";

  return (
    <div
      className={`flex items-center gap-3 border-b border-white/[0.05] px-5 py-4 last:border-0 ${
        isLive ? "bg-live/[0.06]" : ""
      }`}
    >
      <div className="w-16 shrink-0 text-center">
        <p className="text-[10px] font-semibold text-zinc-500">{match.dateLabel}</p>
        {isLive ? (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-live/20 px-2 py-0.5 text-[9px] font-black text-red-300">
            <span className="h-1 w-1 animate-live-pulse rounded-full bg-live" />
            LIVE
          </span>
        ) : isFinished ? (
          <p className="text-[10px] font-semibold text-zinc-500">הסתיים</p>
        ) : (
          <p className="text-xs font-bold text-gold">{match.timeLabel}</p>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="flex items-center gap-2 truncate text-sm font-bold text-white">
          <TeamCrest src={match.homeLogo} name={match.home} size={20} />
          <span className="truncate">{match.home}</span>
        </p>
        <p className="flex items-center gap-2 truncate text-sm font-bold text-white">
          <TeamCrest src={match.awayLogo} name={match.away} size={20} />
          <span className="truncate">{match.away}</span>
        </p>
        {match.roundLabel && (
          <p className="mt-1 text-[10px] text-zinc-500">{match.roundLabel}</p>
        )}
      </div>

      <div className="shrink-0 text-center">
        <span
          className={`text-lg font-black tabular-nums ${
            isLive ? "text-white" : isFinished ? "text-zinc-300" : "text-gold"
          }`}
        >
          {score}
        </span>
        {isLive && (
          <p className="text-[10px] font-bold text-zinc-400">{match.minute}</p>
        )}
      </div>
    </div>
  );
}

function zoneTone(rank: number, zone: string | null): string {
  if (!zone) return "text-zinc-500";
  if (zone.includes("שמינית")) return "bg-emerald-500/15 text-emerald-400";
  if (zone.includes("פלייאוף")) return "bg-violet-500/15 text-violet-300";
  if (rank <= 8) return "bg-emerald-500/15 text-emerald-400";
  if (rank <= 24) return "bg-violet-500/15 text-violet-300";
  return "text-zinc-500";
}

export default function ChampionsLeagueSection({
  data,
}: {
  data: ChampionsLeagueView;
}) {
  const { competition, matches, standings } = data;
  const liveCount = matches.filter((match) => match.status === "live").length;

  return (
    <section id="ucl" className="mt-12 animate-fade-up">
      <div className="mb-5">
        <p className="text-[11px] font-bold tracking-[0.22em] text-gold">
          UEFA CHAMPIONS LEAGUE
        </p>
        <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">
          {competition.countryFlag} {competition.nameHe}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          קטגוריה נפרדת — משחקי ליגת האלופות וטבלה מסודרת · 365scores
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <DashboardCard
            variant={liveCount > 0 ? "live" : "featured"}
            title="משחקי ליגת האלופות"
            badge={
              liveCount > 0 ? (
                <span className="flex items-center gap-1.5 rounded-full bg-live/20 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-red-300">
                  <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
                  {liveCount} LIVE
                </span>
              ) : (
                <span className="rounded-full border border-gold/30 px-2.5 py-0.5 text-[10px] font-semibold text-gold">
                  UCL
                </span>
              )
            }
          >
            {matches.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-zinc-500">
                אין משחקים מתוזמנים כרגע לליגת האלופות
              </p>
            ) : (
              matches.map((match) => <MatchRow key={match.id} match={match} />)
            )}
          </DashboardCard>
        </div>

        <div className="lg:col-span-7">
          <DashboardCard
            title="טבלת ליגת האלופות"
            badge={
              <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                {standings.rows.length} קבוצות · 365scores
              </span>
            }
          >
            {standings.rows.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-zinc-500">
                אין נתוני טבלה כרגע
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] text-zinc-500">
                      <th className="px-4 py-2.5 text-right font-semibold">#</th>
                      <th className="px-2 py-2.5 text-right font-semibold">קבוצה</th>
                      <th className="px-2 py-2.5 text-center font-semibold">מש&apos;</th>
                      <th className="px-2 py-2.5 text-center font-semibold">נצ&apos;</th>
                      <th className="px-2 py-2.5 text-center font-semibold">ת&apos;</th>
                      <th className="px-2 py-2.5 text-center font-semibold">הפ&apos;</th>
                      <th className="px-2 py-2.5 text-center font-semibold">+/-</th>
                      <th className="px-2 py-2.5 text-center font-semibold">נק&apos;</th>
                      <th className="px-4 py-2.5 text-right font-semibold">אזור</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.rows.map((team) => (
                      <tr
                        key={`${team.rank}-${team.teamName}`}
                        className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-gold/[0.04]"
                      >
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${zoneTone(
                              team.rank,
                              team.zone,
                            )}`}
                          >
                            {team.rank}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 font-semibold text-white">
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <TeamCrest
                              src={team.teamLogo}
                              name={team.teamName}
                              size={20}
                            />
                            <span className="truncate">{team.teamName}</span>
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center text-zinc-400">
                          {team.played}
                        </td>
                        <td className="px-2 py-2.5 text-center text-zinc-400">
                          {team.won}
                        </td>
                        <td className="px-2 py-2.5 text-center text-zinc-400">
                          {team.drawn}
                        </td>
                        <td className="px-2 py-2.5 text-center text-zinc-400">
                          {team.lost}
                        </td>
                        <td
                          className={`px-2 py-2.5 text-center text-xs font-bold ${
                            team.gd > 0
                              ? "text-emerald-400"
                              : team.gd < 0
                                ? "text-red-400"
                                : "text-zinc-500"
                          }`}
                        >
                          {formatGoalDifference(team.gd)}
                        </td>
                        <td className="px-2 py-2.5 text-center text-base font-black text-gold">
                          {team.points}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[11px] text-zinc-500">
                          {team.zone || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>

          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/40" />
              שמינית גמר
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-violet-500/40" />
              פלייאוף
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
