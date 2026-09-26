"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="iran-airspace-overlay">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-4 top-1/2 mx-auto max-w-md -translate-y-1/2 rounded-xl border border-sky-400/10 bg-[#0a1220] shadow-2xl sm:inset-x-0">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4 text-sm text-slate-300">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
