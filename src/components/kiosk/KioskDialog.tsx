"use client";

import { useEffect, useId, type ReactNode } from "react";

type KioskDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  maxWidthClass?: string;
  children: ReactNode;
};

export const KioskDialog = ({
  open,
  onClose,
  title,
  closeLabel,
  maxWidthClass = "max-w-5xl",
  children,
}: KioskDialogProps) => {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[92vh] w-full ${maxWidthClass} flex-col rounded-2xl bg-white shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <h2 id={titleId} className="text-2xl font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            className="min-h-12 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 active:bg-slate-50"
            aria-label={closeLabel}
            onClick={onClose}
          >
            關閉
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
};
