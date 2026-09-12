"use client";

function CtrlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-[#0a1220]/90 text-slate-200 shadow-lg backdrop-blur-xl transition-colors hover:bg-white/10 active:bg-white/15 sm:h-9 sm:w-9"
    >
      {children}
    </button>
  );
}

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onFullscreen,
  onReset,
  onFitAircraft,
  onToggleLayer,
  isFullscreen,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFullscreen: () => void;
  onReset: () => void;
  onFitAircraft: () => void;
  onToggleLayer: () => void;
  isFullscreen: boolean;
}) {
  return (
    <div className="pointer-events-auto absolute left-2 top-2 z-[420] flex flex-col gap-1.5 sm:left-3 sm:top-3">
      <CtrlButton label={isFullscreen ? "יציאה ממסך מלא" : "מסך מלא"} onClick={onFullscreen}>
        {isFullscreen ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 1-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </CtrlButton>
      <div className="flex flex-col overflow-hidden rounded-md border border-white/10 bg-[#0a1220]/90 shadow-lg backdrop-blur-xl">
        <button
          type="button"
          title="התקרבות"
          aria-label="התקרבות"
          onClick={onZoomIn}
          className="flex h-8 w-8 items-center justify-center text-lg font-bold text-slate-200 hover:bg-white/10 sm:h-9 sm:w-9"
        >
          +
        </button>
        <div className="h-px bg-white/10" />
        <button
          type="button"
          title="התרחקות"
          aria-label="התרחקות"
          onClick={onZoomOut}
          className="flex h-8 w-8 items-center justify-center text-lg font-bold text-slate-200 hover:bg-white/10 sm:h-9 sm:w-9"
        >
          −
        </button>
      </div>
      <CtrlButton label="איפוס תצוגה" onClick={onReset}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12a9 9 0 1 1 3 6.7M3 12v5M3 12h5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </CtrlButton>
      <CtrlButton label="התאם לכל המטוסים" onClick={onFitAircraft}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </CtrlButton>
      <CtrlButton label="שכבות מפה" onClick={onToggleLayer}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </CtrlButton>
    </div>
  );
}
