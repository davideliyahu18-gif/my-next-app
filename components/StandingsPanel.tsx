import Link from "next/link";
import type { GroupStandingView } from "@/lib/types";
import { formatGoalDifference } from "@/lib/utils";
import DashboardCard from "./DashboardCard";

export default function StandingsPanel({
  standings,
  compact = false,
}: {
  standings: GroupStandingView[];
  compact?: boolean;
}) {
  const groups = compact ? standings.slice(0, 1) : standings;

  return (
    <aside className="relative space-y-6">
      <div id="standings" className="absolute -top-24" aria-hidden />
      <div id="teams" className="absolute -top-24" aria-hidden />

      {groups.length === 0 ? (
        <DashboardCard title="טבלאות בתים">
          <p className="px-5 py-8 text-center text-sm text-zinc-500">אין נתוני טבלה עדיין</p>
        </DashboardCard>
      ) : (
        groups.map((group) => (
          <DashboardCard
            key={group.group}
            title={`טבלת בית ${group.group}`}
            badge={<span className="text-[10px] font-semibold text-zinc-500">FIFA</span>}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] text-zinc-500">
                  <th className="px-4 py-2.5 text-right font-semibold">#</th>
                  <th className="px-2 py-2.5 text-right font-semibold">קבוצה</th>
                  <th className="px-2 py-2.5 text-center font-semibold">מש&apos;</th>
                  <th className="px-2 py-2.5 text-center font-semibold">+/-</th>
                  <th className="px-4 py-2.5 text-center font-semibold">נק&apos;</th>
                </tr>
              </thead>
              <tbody>
                {group.teams.map((team, i) => (
                  <tr
                    key={team.code || team.name}
                    className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-gold/[0.04]"
                  >
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${
                          i < 2 ? "bg-emerald-500/15 text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <Link
                        href={`/teams/${(team.code || "xxx").toLowerCase()}`}
                        className="flex items-center gap-2 font-semibold text-white transition-colors hover:text-gold"
                      >
                        <span>{team.flag}</span>
                        <span className="truncate">{team.name}</span>
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-center text-zinc-400">{team.played}</td>
                    <td
                      className={`px-2 py-3 text-center text-xs font-bold ${
                        team.gd > 0
                          ? "text-emerald-400"
                          : team.gd < 0
                            ? "text-red-400"
                            : "text-zinc-500"
                      }`}
                    >
                      {formatGoalDifference(team.gd)}
                    </td>
                    <td className="px-4 py-3 text-center text-base font-black text-gold">
                      {team.pts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {compact && (
              <div className="border-t border-white/[0.06] px-4 py-3">
                <Link
                  href="/teams"
                  className="text-xs font-bold text-gold transition-colors hover:text-white"
                >
                  כל הנבחרות ←
                </Link>
              </div>
            )}
          </DashboardCard>
        ))
      )}
    </aside>
  );
}
