import Image from "next/image";
import { getTopScorers } from "@/lib/api";
import GlassCard from "./GlassCard";
import SectionHeader from "./SectionHeader";

export default async function TopScorers() {
  const topScorers = await getTopScorers();

  return (
    <section id="scorers" className="py-4">
      <SectionHeader
        title="מלך השערים"
        subtitle="דירוג המבקיעים המובילים בטורניר"
        action="טבלה מלאה"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {topScorers.map((scorer) => (
          <GlassCard
            key={scorer.rank}
            className="group relative overflow-hidden p-0"
          >
            <div className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-sm font-black text-black shadow-lg">
              {scorer.rank}
            </div>

            <div className="relative h-36 overflow-hidden">
              <Image
                src={scorer.photo}
                alt={scorer.name}
                fill
                className="object-cover object-top transition-transform duration-700 group-hover:scale-110"
                sizes="(max-width:640px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
              <div className="absolute bottom-3 right-4 text-2xl">
                {scorer.flag}
              </div>
            </div>

            <div className="p-5">
              <h3 className="text-lg font-black text-white">{scorer.name}</h3>
              <p className="mt-0.5 text-xs font-medium text-zinc-500">
                {scorer.team}
              </p>

              <div className="mt-4 flex gap-6 border-t border-white/5 pt-4">
                <div>
                  <p className="text-2xl font-black tabular-nums text-amber-300">
                    {scorer.goals}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    שערים
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-black tabular-nums text-zinc-400">
                    {scorer.assists}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    בישולים
                  </p>
                </div>
                <div className="mr-auto flex items-end">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-amber-400 to-amber-600 transition-all duration-500 group-hover:w-full"
                      style={{ width: `${(scorer.goals / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
