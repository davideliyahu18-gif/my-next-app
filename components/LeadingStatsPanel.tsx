import Image from "next/image";
import type { ScorerView } from "@/lib/types";
import DashboardCard from "./DashboardCard";

export default function LeadingStatsPanel({ scorers }: { scorers: ScorerView[] }) {
  const cards = scorers.slice(0, 5).map((scorer) => ({
    ...scorer,
    label: "שערים",
    value: String(scorer.goals),
    secondary: scorer.assists > 0 ? `${scorer.assists} בישולים` : null,
  }));
  const leader = cards[0];

  return (
    <section id="stats" className="mt-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-gold">TOP SCORERS</p>
          <h2 className="mt-1 text-2xl font-black text-white">מי הבקיע הכי הרבה?</h2>
          {leader ? (
            <p className="mt-2 text-sm text-zinc-400">
              מוביל כרגע: {leader.flag} {leader.name} עם {leader.goals} שערים
              {leader.assists > 0 ? ` ו־${leader.assists} בישולים` : ""}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.length === 0 ? (
          <DashboardCard>
            <p className="px-5 py-10 text-center text-sm text-zinc-500">אין נתונים עדיין</p>
          </DashboardCard>
        ) : (
          cards.map((card, index) => (
            <DashboardCard
              key={card.rank}
              variant={index === 0 ? "featured" : "default"}
              className="transition-transform hover:-translate-y-1"
            >
              <div className="flex flex-col items-center p-5 text-center">
                <div className="relative">
                  <div className="absolute -inset-1 rounded-full bg-gold/20 blur-md" />
                  <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-gold/50">
                    <Image
                      src={card.photo}
                      alt={card.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <span className="absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-[11px] font-black text-black">
                    {card.rank}
                  </span>
                </div>
                <p className="mt-4 text-xs font-semibold text-zinc-500">{card.label}</p>
                <p className="mt-1 text-3xl font-black text-gold">{card.value}</p>
                {card.secondary && (
                  <p className="mt-1 text-[11px] text-zinc-500">{card.secondary}</p>
                )}
                <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-white">
                  <span>{card.flag}</span>
                  <span className="truncate">{card.name}</span>
                </p>
              </div>
            </DashboardCard>
          ))
        )}
      </div>
    </section>
  );
}
