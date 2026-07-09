import type { ReactNode } from "react";

const VARIANT_STYLES = {
  default: "border-white/[0.07] bg-card shadow-[var(--shadow-card)]",
  featured:
    "border-gold/25 bg-gradient-to-b from-card-elevated to-card shadow-[0_16px_48px_rgba(212,175,55,0.08)]",
  live: "border-live/25 bg-gradient-to-b from-red-950/40 to-card shadow-[0_16px_48px_rgba(239,68,68,0.1)]",
} as const;

export default function DashboardCard({
  children,
  className = "",
  title,
  badge,
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  badge?: ReactNode;
  variant?: keyof typeof VARIANT_STYLES;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-card)] border backdrop-blur-sm ${VARIANT_STYLES[variant]} ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <h3 className="text-sm font-extrabold tracking-wide text-white">{title}</h3>
          {badge}
        </div>
      )}
      {children}
    </div>
  );
}
