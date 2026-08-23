import Link from "next/link";
import { IMAGES, WHATSAPP_INVITE_LINK } from "@/lib/constants";

const WHATSAPP_GROUP_URL =
  WHATSAPP_INVITE_LINK || "https://chat.whatsapp.com/L47SyZIjYAR0k8qZ0C2Fcl";

export default function Hero() {
  return (
    <section id="home" className="relative overflow-hidden">
      <div className="relative min-h-[52vh] md:min-h-[58vh]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(5,5,5,0.35), rgba(5,5,5,0.92)), url('${IMAGES.stadium}')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-transparent to-black/40" />

        <div className="relative mx-auto flex min-h-[52vh] max-w-[1440px] items-center px-4 py-16 md:min-h-[58vh] md:px-8">
          <div className="max-w-2xl animate-fade-up text-center md:text-right">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-bold tracking-[0.2em] text-gold">
              <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
              LIVE FOOTBALL
            </p>

            <h1 className="font-display text-5xl font-black leading-[1.05] tracking-tight text-gold-gradient sm:text-6xl md:text-7xl">
              ליגות לייב
            </h1>

            <p className="mt-5 max-w-lg text-lg text-zinc-200 md:mr-0 md:ml-auto md:text-xl">
              כל מה שקורה היום בכדורגל — משחקים, טבלאות וליגת האלופות במקום אחד
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              אתר עכשיו · אפליקציה בהמשך · נתונים מ-365scores
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <Link
                href="#today"
                className="inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 text-sm font-black text-black shadow-[0_12px_40px_rgba(212,175,55,0.4)] transition-all hover:scale-[1.03] hover:shadow-[0_16px_48px_rgba(212,175,55,0.55)]"
              >
                מה היום
              </Link>
              <a
                href={WHATSAPP_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-whatsapp/40 bg-whatsapp/10 px-6 py-3.5 text-sm font-bold text-whatsapp transition-all hover:scale-[1.03] hover:bg-whatsapp/20"
              >
                התראות WhatsApp
              </a>
              <Link
                href="/schedule"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition-all hover:scale-[1.03] hover:border-gold/40 hover:text-gold"
              >
                לוח מלא
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
