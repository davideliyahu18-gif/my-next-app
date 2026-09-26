import type { CSSProperties, ReactNode } from "react";

export default function Panel({
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
      className={`rounded-xl border border-sky-400/10 bg-[#0a1220]/80 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 px-4 pt-3.5 text-[13px] font-bold tracking-wide text-slate-200">
      {children}
    </h2>
  );
}

export function StatTile({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`mt-0.5 text-xl font-extrabold tabular-nums ${accent ?? "text-slate-50"}`}>{value}</div>
    </div>
  );
}
