import { TOURNAMENT_META } from "@/lib/constants";
import ScrollLink from "./ScrollLink";

const FOOTER_LINKS = [
  { href: "#home", label: "אודות" },
  { href: "#news", label: "צור קשר" },
  { href: "#home", label: "תנאים" },
  { href: "#home", label: "פרטיות" },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-white/[0.06] bg-black">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-6 px-4 py-10 md:flex-row md:px-8">
        <div className="text-center md:text-right">
          <p className="text-lg font-black text-white">
            WORLD CUP <span className="text-[#d4af37]">2026</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">{TOURNAMENT_META.footerHosts}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-400">
          {FOOTER_LINKS.map((link) => (
            <ScrollLink
              key={link.label}
              href={link.href}
              className="transition-colors hover:text-[#d4af37]"
            >
              {link.label}
            </ScrollLink>
          ))}
        </div>

        <p className="text-xs text-zinc-600">© 2026 FIFA World Cup</p>
      </div>
    </footer>
  );
}
