import { getTopScorers } from "@/lib/api";
import DashboardCard from "./DashboardCard";

export default async function CompactScorers() {
  const scorers = (await getTopScorers()).slice(0, 5);

  return (
    <DashboardCard title="מלכי השערים">
      <div className="p-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-zinc-500">
              <th className="px-3 py-2 text-right font-semibold">#</th>
              <th className="px-2 py-2 text-right font-semibold">שחקן</th>
              <th className="px-3 py-2 text-center font-semibold">שערים</th>
            </tr>
          </thead>
          <tbody>
            {scorers.map((scorer) => (
              <tr
                key={scorer.rank}
                className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.03]"
              >
                <td className="px-3 py-2.5 text-right text-xs font-bold text-zinc-500">
                  {scorer.rank}
                </td>
                <td className="px-2 py-2.5">
                  <span className="flex items-center gap-2 font-medium text-white">
                    <span>{scorer.flag}</span>
                    <span className="truncate">{scorer.name}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center text-base font-black text-[#d4af37]">
                  {scorer.goals}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}
