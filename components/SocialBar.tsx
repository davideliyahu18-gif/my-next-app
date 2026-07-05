import DashboardCard from "./DashboardCard";

const SOCIAL_LINKS = [
  { label: "Telegram", icon: "✈️", href: "#" },
  { label: "WhatsApp", icon: "💬", href: "#" },
  { label: "Instagram", icon: "📷", href: "#" },
  { label: "YouTube", icon: "▶️", href: "#" },
  { label: "X", icon: "𝕏", href: "#" },
];

export default function SocialBar() {
  return (
    <div className="space-y-4">
      <DashboardCard>
        <div className="flex items-center gap-4 p-5">
          <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black text-2xl">
            📱
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">קבלו התראות בזמן אמת</p>
            <p className="mt-1 text-xs text-zinc-500">שערים, VAR ועדכונים ישירות לנייד</p>
            <button
              type="button"
              className="mt-3 rounded-full bg-[#d4af37] px-4 py-1.5 text-xs font-bold text-black"
            >
              הרשמו עכשיו
            </button>
          </div>
        </div>
      </DashboardCard>

      <div className="flex items-center justify-center gap-3">
        {SOCIAL_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
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
