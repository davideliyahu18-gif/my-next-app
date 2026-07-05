import { getGroupStandings } from "@/lib/api";
import { formatGoalDifference } from "@/lib/utils";
import DashboardCard from "./DashboardCard";

export default async function Standings({ compact = false }: { compact?: boolean }) {
  const groupStandings = await getGroupStandings();
  const groups = compact ? groupStandings.slice(0, 1) : groupStandings;

  return (
    <aside className="relative space-y-6">
      <div id="standings" className="absolute -top-24" aria-hidden />
      <div id="teams" className="absolute -top-24" aria-hidden />
      {groups.map((group) => (
        <DashboardCard
          key={group.group}
          title={`טבלת בית ${group.group}`}
          badge={<span className="text-[10px] font-semibold text-zinc-500">LIVE</span>}
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
                  key={team.name}
                  className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-[#d4af37]/[0.04]"
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
                    <span className="flex items-center gap-2 font-semibold text-white">
                      <span>{team.flag}</span>
                      <span className="truncate">{team.name}</span>
                    </span>
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
                  <td className="px-4 py-3 text-center text-base font-black text-[#d4af37]">
                    {team.pts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashboardCard>
      ))}
    </aside>
  );
}
