import { getGroupStandings } from "@/lib/api";
import { formatGoalDifference } from "@/lib/utils";
import GlassCard from "./GlassCard";
import SectionHeader from "./SectionHeader";

export default async function Standings() {
  const groupStandings = await getGroupStandings();

  return (
    <aside id="standings" className="space-y-6 lg:sticky lg:top-28 lg:self-start">
      <SectionHeader
        title="טבלאות בתים"
        subtitle="עדכון אחרון · שלב הבתים"
        action="הכל"
      />
      {groupStandings.map((group) => (
        <GlassCard key={group.group} className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-amber-400/10 bg-gradient-to-l from-amber-400/10 to-transparent px-5 py-3.5">
            <h3 className="text-base font-black text-amber-300">
              בית {group.group}
            </h3>
            <span className="text-[10px] font-semibold text-zinc-500">
              LIVE
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[11px] text-zinc-500">
                <th className="px-4 py-2.5 text-right font-semibold">#</th>
                <th className="px-2 py-2.5 text-right font-semibold">קבוצה</th>
                <th className="px-2 py-2.5 text-center font-semibold">מש'</th>
                <th className="px-2 py-2.5 text-center font-semibold">+/-</th>
                <th className="px-4 py-2.5 text-center font-semibold">נק'</th>
              </tr>
            </thead>
            <tbody>
              {group.teams.map((team, i) => (
                <tr
                  key={team.name}
                  className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-amber-400/[0.04]"
                >
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${i < 2 ? "bg-emerald-500/15 text-emerald-400" : "text-zinc-500"}`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <span className="flex items-center gap-2 font-semibold text-white">
                      <span className="text-base">{team.flag}</span>
                      <span className="truncate">{team.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center text-zinc-400">
                    {team.played}
                  </td>
                  <td
                    className={`px-2 py-3 text-center text-xs font-bold ${team.gd > 0 ? "text-emerald-400" : team.gd < 0 ? "text-red-400" : "text-zinc-500"}`}
                  >
                    {formatGoalDifference(team.gd)}
                  </td>
                  <td className="px-4 py-3 text-center text-base font-black text-amber-300">
                    {team.pts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      ))}
    </aside>
  );
}
