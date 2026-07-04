import type { CSSProperties, ReactNode } from "react";

export default function GlassCard({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-all duration-500 hover:border-amber-400/25 hover:bg-white/[0.06] hover:shadow-[0_12px_48px_rgba(212,175,55,0.08)] ${className}`}
    >
      {children}
    </div>
  );
}
