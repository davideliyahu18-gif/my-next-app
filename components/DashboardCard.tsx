import type { ReactNode } from "react";

export default function DashboardCard({
  children,
  className = "",
  title,
  badge,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  badge?: ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/[0.06] bg-[#121212] shadow-[0_8px_32px_rgba(0,0,0,0.45)] ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          {badge}
        </div>
      )}
      {children}
    </div>
  );
}
