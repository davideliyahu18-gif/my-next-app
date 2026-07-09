import Image from "next/image";
import Link from "next/link";
import type { ScorerView } from "@/lib/types";
import DashboardCard from "./DashboardCard";

export default function CompactScorersPanel({ scorers }: { scorers: ScorerView[] }) {
  const rows = scorers.slice(0, 5);

  return (
    <DashboardCard title="מלכי השערים">
      <div className="p-2">
        {rows.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-zinc-500">אין נתוני שערים עדיין</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((scorer) => {
              const teamHref = scorer.teamCode
                ? `/teams/${scorer.teamCode.toLowerCase()}`
                : null;
              const content = (
                <>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                      scorer.rank === 1
                        ? "bg-gold text-black"
                        : "bg-white/5 text-zinc-400"
                    }`}
                  >
                    {scorer.rank}
                  </span>
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10">
                    <Image
                      src={scorer.photo}
                      alt={scorer.name}
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{scorer.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {scorer.flag} {scorer.team}
                    </p>
                  </div>
                  <span className="text-lg font-black tabular-nums text-gold">
                    {scorer.goals}
                  </span>
                </>
              );

              return (
                <li key={scorer.rank}>
                  {teamHref ? (
                    <Link
                      href={teamHref}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
