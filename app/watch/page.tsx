import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { WHATSAPP_INVITE_LINK } from "@/lib/constants";

export const revalidate = 3600;

const WHATSAPP_GROUP_URL =
  WHATSAPP_INVITE_LINK || "https://chat.whatsapp.com/L47SyZIjYAR0k8qZ0C2Fcl";

const CHANNELS = [
  {
    name: "Sport 5",
    detail: "שידורים חיים, אולפן וניתוחים — הערוץ המרכזי למונדיאל בישראל",
    tip: "בדקו את לוח השידורים באפליקציה / באתר",
    accent: "border-sky-400/30 bg-sky-500/10",
  },
  {
    name: "Sport 5 Plus / Gold",
    detail: "משחקים מקבילים כשיש כמה משחקים באותה שעה",
    tip: "מומלץ לחבילות ספורט מורחבות",
    accent: "border-indigo-400/30 bg-indigo-500/10",
  },
  {
    name: "FIFA+ / FIFA.com",
    detail: "תקצירים רשמיים, רגעים וסטטיסטיקות מהטורניר",
    tip: "קישורים לתקצירים גם מתוך האתר שלנו",
    accent: "border-gold/30 bg-gold/10",
  },
  {
    name: "רשתות חברתיות",
    detail: "קליפים קצרים ועדכונים מהירים בזמן אמת",
    tip: "יוטיוב / אינסטגרם של FIFA",
    accent: "border-pink-400/30 bg-pink-500/10",
  },
];

export default function WatchPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-background font-sans text-foreground">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-zinc-400 transition-colors hover:text-gold"
        >
          ← חזרה לדף הבית
        </Link>

        <p className="text-[11px] font-bold tracking-[0.2em] text-gold">WATCH</p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">איפה לצפות</h1>
        <p className="mt-3 text-zinc-400">
          איפה רואים את משחקי מונדיאל 2026 בישראל — ואיך לא לפספס שערים גם בלי מסך.
        </p>

        <div className="mt-8 space-y-4">
          {CHANNELS.map((channel) => (
            <article
              key={channel.name}
              className={`rounded-2xl border p-5 ${channel.accent}`}
            >
              <h2 className="text-lg font-extrabold text-white">{channel.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{channel.detail}</p>
              <p className="mt-2 text-xs text-zinc-500">{channel.tip}</p>
            </article>
          ))}
        </div>

        <section className="mt-10 rounded-2xl border border-whatsapp/30 bg-gradient-to-br from-[#0d1f14] to-card p-6">
          <h2 className="text-lg font-extrabold text-white">לא ליד הטלוויזיה?</h2>
          <p className="mt-2 text-sm text-zinc-400">
            הצטרפו לקבוצת WhatsApp וקבלו שערים, VAR ועדכונים חיים ישירות לנייד.
          </p>
          <a
            href={WHATSAPP_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-whatsapp px-5 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.03]"
          >
            הצטרפו להתראות
          </a>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-zinc-600">
          המידע כללי ועלול להשתנות לפי חבילות השידור והסכמי זכויות. בדקו תמיד את לוח
          השידורים העדכני אצל הספק שלכם.
        </p>
      </main>
      <Footer />
    </div>
  );
}
