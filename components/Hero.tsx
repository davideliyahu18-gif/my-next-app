import Image from "next/image";
import Link from "next/link";
import { getTournament } from "@/lib/api";
import { IMAGES, TOURNAMENT_META } from "@/lib/constants";

export default async function Hero() {
  const tournament = await getTournament();

  return (
    <section id="home" className="relative overflow-hidden">
      <div className="relative min-h-[340px] md:min-h-[400px]">
        <Image
          src={tournament.images.stadium}
          alt="אצטדיון מואר בלילה"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-black via-black/80 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(212,175,55,0.18),transparent_55%)]" />

        <div className="relative mx-auto flex max-w-[1440px] flex-col items-center gap-8 px-4 py-12 md:flex-row md:items-center md:justify-between md:gap-12 md:px-8 md:py-16">
          <div className="max-w-xl text-center md:text-right">
            <h1 className="text-4xl font-black leading-tight text-[#d4af37] sm:text-5xl md:text-6xl">
              מונדיאל 2026
            </h1>
            <p className="mt-4 text-lg text-zinc-200 md:text-xl">
              כל המשחקים, כל השערים, כל הרגעים
            </p>
            <p className="mt-2 text-sm text-zinc-500">{TOURNAMENT_META.dateRange}</p>

            <Link
              href="/schedule"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#d4af37] px-7 py-3 text-sm font-black text-black shadow-[0_8px_32px_rgba(212,175,55,0.35)] transition-all hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(212,175,55,0.5)]"
            >
              <span>📅</span>
              לוח משחקים מלא
            </Link>
          </div>

          <div className="relative shrink-0">
            <div className="absolute -inset-6 rounded-full bg-[#d4af37]/20 blur-3xl" />
            <div className="relative h-48 w-48 md:h-64 md:w-64 lg:h-72 lg:w-72">
              <Image
                src={IMAGES.trophy}
                alt="גביע העולם FIFA"
                fill
                className="object-contain drop-shadow-[0_20px_60px_rgba(212,175,55,0.45)]"
                sizes="(max-width:768px) 192px, 288px"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
