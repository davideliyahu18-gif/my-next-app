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
      className={`hamal-panel rounded-xl ${className}`}
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
