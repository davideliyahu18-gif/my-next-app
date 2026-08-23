import type { LeagueMatchView } from "@/lib/football/leagues-data";
import DashboardCard from "./DashboardCard";

export default function LeagueNextMatch({
  match,
  liveCount,
}: {
  match: LeagueMatchView | null;
  liveCount: number;
}) {
  return (
    <DashboardCard
      title="המשחק הבא"
      badge={
        liveCount > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full bg-live/20 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-red-300">
            <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
            {liveCount} LIVE
          </span>
        ) : (
          <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-500">
            365scores
          </span>
        )
      }
    >
      {!match ? (
        <p className="px-5 py-8 text-center text-sm text-zinc-500">
          אין משחקים קרובים כרגע
        </p>
      ) : (
        <div className="px-5 py-5">
          <p className="mb-3 text-xs font-bold text-gold">
            {match.leagueFlag} {match.leagueName}
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-bold text-white">{match.home}</span>
              <span className="text-lg font-black text-zinc-300">VS</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-bold text-white">{match.away}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs text-zinc-400">
            <span>{match.dateLabel}</span>
            <span className="font-bold text-gold">{match.timeLabel}</span>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
