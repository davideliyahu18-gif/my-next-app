import Image from "next/image";
import Link from "next/link";
import type { ScorerView } from "@/lib/types";
import DashboardCard from "./DashboardCard";

export default function CompactScorersPanel({ scorers }: { scorers: ScorerView[] }) {
  const rows = scorers.slice(0, 10);
  const leader = rows[0] ?? null;

  return (
    <DashboardCard
      title="מלכי השערים"
      badge={
        <span className="text-[10px] font-bold tracking-wide text-gold/80">GOLDEN BOOT</span>
      }
      variant={leader ? "featured" : "default"}
    >
      <div className="p-2">
        {leader ? (
          <div className="mb-2 rounded-xl border border-gold/20 bg-gold/5 px-3 py-3">
            <p className="text-[10px] font-bold tracking-[0.18em] text-gold">מוביל הטורניר</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-gold/60">
                <Image
                  src={leader.photo}
                  alt={leader.name}
                  fill
                  className="object-cover"
                  sizes="44px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-white">{leader.name}</p>
                <p className="text-[11px] text-zinc-400">
                  {leader.flag} {leader.team}
                </p>
              </div>
              <div className="text-left">
                <p className="text-2xl font-black tabular-nums leading-none text-gold">
                  {leader.goals}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-zinc-500">שערים</p>
              </div>
            </div>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-zinc-500">אין נתוני שערים עדיין</p>
        ) : (
          <>
            <div className="grid grid-cols-[28px_1fr_auto] gap-2 px-3 pb-1 text-[10px] font-bold tracking-wide text-zinc-600">
              <span>#</span>
              <span>שחקן</span>
              <span className="text-left">שערים</span>
            </div>
            <ul className="space-y-0.5">
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
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10">
                        <Image
                          src={scorer.photo}
                          alt={scorer.name}
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{scorer.name}</p>
                        <p className="truncate text-[11px] text-zinc-500">
                          {scorer.flag} {scorer.team}
                          {scorer.assists > 0 ? ` · ${scorer.assists} בישולים` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="min-w-[2ch] text-left text-lg font-black tabular-nums text-gold">
                      {scorer.goals}
                    </span>
                  </>
                );

                return (
                  <li key={`${scorer.rank}-${scorer.name}`}>
                    {teamHref ? (
                      <Link
                        href={teamHref}
                        className="grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.04]"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-xl px-3 py-2">
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </DashboardCard>
  );
}
