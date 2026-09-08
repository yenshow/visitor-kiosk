"use client";

import type { ReactNode } from "react";
import { IdleCountdown } from "@/components/kiosk/IdleCountdown";

type FlowCardProps = {
  title: string;
  onBack: () => void;
  children: ReactNode;
};

export const FlowCard = ({ title, onBack, children }: FlowCardProps) => (
  <div className="flex w-full flex-col items-center">
    <div className="w-full rounded-3xl bg-white p-6 text-slate-900 shadow-xl scheme-light">
      <h2 className="mb-4 text-center text-3xl font-bold">{title}</h2>
      {children}
    </div>
    <button
      type="button"
      className="mt-4 shrink-0 cursor-pointer text-xl font-semibold tracking-wide text-(--text-secondary) underline-offset-8 outline-none hover:text-(--text-primary) hover:underline focus-visible:text-(--text-primary) focus-visible:underline landscape:text-2xl"
      aria-label="返回首頁"
      onClick={onBack}
    >
      返回
    </button>
  </div>
);

type FlowResultProps = {
  title: string;
  tone?: "success" | "error";
  idleSeconds: number;
  onHome: () => void;
  onRetry?: () => void;
  extraActions?: ReactNode;
  children: ReactNode;
};

export const FlowResult = ({
  title,
  tone = "success",
  idleSeconds,
  onHome,
  onRetry,
  extraActions,
  children,
}: FlowResultProps) => (
  <div className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-3xl bg-white p-10 shadow-xl">
    <h2
      className={`text-3xl font-bold ${
        tone === "error" ? "text-slate-900" : "text-emerald-700"
      }`}
    >
      {title}
    </h2>
    <div className="mt-4 text-center text-slate-700">{children}</div>
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      {onRetry ? (
        <button
          type="button"
          className="min-h-16 rounded-xl border border-slate-300 px-6 text-lg font-semibold text-slate-700 active:bg-slate-50"
          aria-label="再試一次"
          onClick={onRetry}
        >
          再試一次
        </button>
      ) : null}
      {extraActions}
      <button
        type="button"
        className={
          onRetry
            ? "min-h-16 rounded-xl border border-slate-300 px-6 text-lg font-semibold text-slate-700 active:bg-slate-50"
            : "min-h-16 rounded-xl bg-slate-800 px-8 text-xl font-semibold text-white active:bg-slate-700"
        }
        aria-label="返回首頁"
        onClick={onHome}
      >
        返回首頁
      </button>
    </div>
    <IdleCountdown seconds={idleSeconds} onComplete={onHome} />
  </div>
);
