import type { ScheduleMatchView } from "@/lib/types";
import DashboardCard from "./DashboardCard";
import HighlightButton from "./HighlightButton";
import UpcomingKnockoutPanel from "./UpcomingKnockoutPanel";
import { buildInternalHighlightPath } from "@/lib/fifa-match-centre";

function statusBadge(status: ScheduleMatchView["status"]) {
  if (status === "live") {
    return (
      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
        LIVE
      </span>
    );
  }
  if (status === "finished") {
    return (
      <span className="rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
        הסתיים
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[#d4af37]/15 px-2 py-0.5 text-[10px] font-medium text-[#d4af37]">
      עתידי
    </span>
  );
}

function scoreLabel(match: ScheduleMatchView): string {
  if (match.homeScore !== null && match.awayScore !== null) {
    return `${match.homeScore} - ${match.awayScore}`;
  }
  return "VS";
}

function MatchRow({ match }: { match: ScheduleMatchView }) {
  const highlightUrl =
    match.status === "upcoming" ? null : buildInternalHighlightPath(match.id);

  return (
    <tr className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
      <td className="px-3 py-3 text-xs text-zinc-500">{match.timeLabel}</td>
      <td className="hidden px-3 py-3 text-xs text-zinc-500 sm:table-cell">
        {match.matchNumber ?? "—"}
      </td>
      <td className="px-3 py-3 text-xs text-zinc-400">{match.stage}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span>{match.homeFlag}</span>
          <span className="font-medium text-white">{match.home}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-center font-black text-white">{scoreLabel(match)}</td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-2">
          <span className="font-medium text-white">{match.away}</span>
          <span>{match.awayFlag}</span>
        </div>
      </td>
      <td className="hidden px-3 py-3 text-xs text-zinc-500 lg:table-cell">
        {match.venue}
      </td>
      <td className="px-3 py-3">{statusBadge(match.status)}</td>
      <td className="px-3 py-3">
        <HighlightButton href={highlightUrl} />
      </td>
    </tr>
  );
}

export default function FullScheduleTable({
  matches,
  fetchedAt,
}: {
  matches: ScheduleMatchView[];
  fetchedAt: string;
}) {
  const grouped = matches.reduce<Record<string, ScheduleMatchView[]>>((acc, match) => {
    if (!acc[match.dateLabel]) acc[match.dateLabel] = [];
    acc[match.dateLabel].push(match);
    return acc;
  }, {});

  const finished = matches.filter((m) => m.status === "finished").length;
  const upcoming = matches.filter((m) => m.status === "upcoming").length;
  const live = matches.filter((m) => m.status === "live").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">טבלת כל המשחקים</h1>
          <p className="mt-1 text-sm text-zinc-500">מונדיאל 2026 · עד הגמר · מעודכן מ-FIFA</p>
        </div>
        <p className="text-xs text-zinc-500">
          עודכן{" "}
          {new Date(fetchedAt).toLocaleString("he-IL", {
            timeZone: "Asia/Jerusalem",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" · "}
          {matches.length} משחקים · {live} חיים · {finished} הסתיימו · {upcoming} עתידיים
        </p>
      </div>

      {Object.entries(grouped).map(([date, dayMatches]) => (
        <DashboardCard key={date} title={date}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] text-zinc-500">
                  <th className="px-3 py-2.5 text-right font-semibold">שעה</th>
                  <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">#</th>
                  <th className="px-3 py-2.5 text-right font-semibold">שלב</th>
                  <th className="px-3 py-2.5 text-right font-semibold">בית</th>
                  <th className="px-3 py-2.5 text-center font-semibold">תוצאה</th>
                  <th className="px-3 py-2.5 text-right font-semibold">חוץ</th>
                  <th className="hidden px-3 py-2.5 text-right font-semibold lg:table-cell">אצטדיון</th>
                  <th className="px-3 py-2.5 text-right font-semibold">סטטוס</th>
                  <th className="px-3 py-2.5 text-right font-semibold">תקציר</th>
                </tr>
              </thead>
              <tbody>
                {dayMatches.map((match) => (
                  <MatchRow key={match.id} match={match} />
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      ))}

      <UpcomingKnockoutPanel matches={matches} />
    </div>
  );
}
