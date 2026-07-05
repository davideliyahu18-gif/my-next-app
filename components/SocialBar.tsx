import { WHATSAPP_INVITE_LINK } from "@/lib/constants";
import DashboardCard from "./DashboardCard";

const WHATSAPP_GROUP_URL =
  WHATSAPP_INVITE_LINK || "https://chat.whatsapp.com/L47SyZIjYAR0k8qZ0C2Fcl";

const SOCIAL_LINKS = [
  { label: "WhatsApp", icon: "💬", href: WHATSAPP_GROUP_URL },
  { label: "YouTube", icon: "▶️", href: "https://www.youtube.com/@FIFA" },
  { label: "Instagram", icon: "📷", href: "https://www.instagram.com/fifa" },
];

export default function SocialBar() {
  return (
    <div className="space-y-4">
      <DashboardCard>
        <div className="flex items-center gap-4 p-5">
          <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-xl border border-[#25D366]/30 bg-[#25D366]/10 text-2xl">
            💬
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">התראות ב-WhatsApp</p>
            <p className="mt-1 text-xs text-zinc-500">
              שערים, VAR ועדכונים חיים — אותן הודעות שבקבוצה
            </p>
            <a
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-1.5 text-xs font-bold text-white transition-transform hover:scale-[1.03] hover:bg-[#20bd5a]"
            >
              הרשמו עכשיו
            </a>
          </div>
        </div>
      </DashboardCard>

      <div className="flex items-center justify-center gap-3">
        {SOCIAL_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#121212] text-sm transition-colors hover:border-[#d4af37]/40 hover:text-[#d4af37]"
          >
            {link.icon}
          </a>
        ))}
      </div>
    </div>
  );
}
