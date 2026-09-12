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
