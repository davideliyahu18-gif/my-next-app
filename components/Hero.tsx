import Image from "next/image";
import Link from "next/link";
import HeroKnockoutPreview from "@/components/HeroKnockoutPreview";
import { getFullSchedule, getTournament } from "@/lib/api";
import { TOURNAMENT_META, WHATSAPP_INVITE_LINK } from "@/lib/constants";

const WHATSAPP_GROUP_URL =
  WHATSAPP_INVITE_LINK || "https://chat.whatsapp.com/L47SyZIjYAR0k8qZ0C2Fcl";

export default async function Hero() {
  const [tournament, schedule] = await Promise.all([
    getTournament(),
    getFullSchedule(),
  ]);

  return (
    <section id="home" className="relative overflow-hidden">
      <div className="relative min-h-[72vh] md:min-h-[78vh]">
        <Image
          src={tournament.images.stadium}
          alt="אצטדיון מואר בלילה"
          fill
          priority
          className="object-cover object-center scale-105 animate-[fade-up_1.2s_ease-out]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-black/70 to-black/50" />
        <div className="absolute inset-0 bg-gradient-to-l from-background via-black/55 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(212,175,55,0.22),transparent_55%)]" />

        <div className="relative mx-auto flex min-h-[72vh] max-w-[1440px] flex-col justify-end px-4 pb-10 pt-28 md:min-h-[78vh] md:justify-center md:px-8 md:pb-14 md:pt-24">
          <div className="max-w-2xl animate-fade-up text-center md:text-right">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-bold tracking-[0.2em] text-gold">
              <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
              FIFA WORLD CUP
            </p>

            <h1 className="font-display text-5xl font-black leading-[1.05] tracking-tight text-gold-gradient sm:text-6xl md:text-7xl lg:text-8xl">
              מונדיאל 2026
            </h1>

            <p className="mt-5 max-w-lg text-lg text-zinc-200 md:mr-0 md:ml-auto md:text-xl">
              כל המשחקים, כל השערים, כל הרגעים — בזמן אמת
            </p>
            <p className="mt-2 text-sm text-zinc-500">{TOURNAMENT_META.dateRange}</p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <Link
                href="/schedule"
                className="inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 text-sm font-black text-black shadow-[0_12px_40px_rgba(212,175,55,0.4)] transition-all hover:scale-[1.03] hover:shadow-[0_16px_48px_rgba(212,175,55,0.55)]"
              >
                לוח משחקים מלא
              </Link>
              <a
                href={WHATSAPP_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-whatsapp/40 bg-whatsapp/10 px-6 py-3.5 text-sm font-bold text-whatsapp transition-all hover:scale-[1.03] hover:bg-whatsapp/20"
              >
                התראות WhatsApp
              </a>
            </div>
          </div>

          <HeroKnockoutPreview matches={schedule} />
        </div>
      </div>
    </section>
  );
}
