"use client";

import Link from "next/link";

export default function HighlightButton({ href }: { href: string | null }) {
  if (!href) {
    return (
      <span className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-600">
        צפו בתקציר
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="shrink-0 rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-1.5 text-[11px] font-bold text-[#d4af37] transition-colors hover:bg-[#d4af37]/25 hover:text-white"
    >
      ▶ צפו בתקציר
    </Link>
  );
}
