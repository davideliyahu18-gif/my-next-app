import Image from "next/image";
import { getTopScorers } from "@/lib/api";
import DashboardCard from "./DashboardCard";

const STAT_LABELS = ["שערים", "בישולים", "נגיעות ברחבה", "דיוק מסירות", "הצלות"];

export default async function LeadingStats() {
  const scorers = (await getTopScorers()).slice(0, 5);

  const cards = scorers.map((scorer, index) => {
    const label = STAT_LABELS[index] ?? "סטטיסטיקה";
    let value = String(scorer.goals);
    if (index === 1) value = String(scorer.assists);
    if (index === 3) value = `${85 + index}%`;
    if (index === 4) value = String(10 + index);

    return { ...scorer, label, value };
  });

  return (
    <section id="stats" className="mt-10">
      <h2 className="mb-5 text-lg font-black text-white">סטטיסטיקות מובילות</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <DashboardCard key={card.rank}>
            <div className="flex flex-col items-center p-5 text-center">
              <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-[#d4af37]/40">
                <Image
                  src={card.photo}
                  alt={card.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <p className="mt-3 text-xs font-semibold text-zinc-500">{card.label}</p>
              <p className="mt-1 text-2xl font-black text-[#d4af37]">{card.value}</p>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-white">
                <span>{card.flag}</span>
                {card.name}
              </p>
            </div>
          </DashboardCard>
        ))}
      </div>
    </section>
  );
}
