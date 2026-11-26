"use client";

import { useEffect, useRef, useState } from "react";
import { AppointForm } from "@/components/kiosk/AppointForm";
import { ThemeSync } from "@/components/kiosk/ThemeSync";
import type { toSettingsView } from "@/lib/kiosk/settings";
import { PUBLIC_BOOKING_MAX_DAYS } from "@/lib/kiosk/ui-constants";

type BookPhase = "intro" | "form";
type BookSettings = Pick<
  ReturnType<typeof toSettingsView>,
  "theme" | "logoUrl" | "publicBookingEnabled"
>;

const BOOKING_STEPS = [
  {
    title: "填寫預約資料",
    description: "填寫聯絡資料，並選擇被訪人與來訪時段。",
  },
  {
    title: "查看預約結果",
    description: "送出後請確認畫面上的預約結果，並留意 Email 備查信。",
  },
  {
    title: "到場後報到",
    description:
      "在現場訪客機選擇「訪客報到」，輸入預約碼或預約時填寫的手機號碼。",
  },
];

export default function PublicBookPage() {
  const [settingsResult, setSettingsResult] = useState<
    BookSettings | "error" | null
  >(null);
  const [phase, setPhase] = useState<BookPhase>("intro");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const introHeading = useRef<HTMLHeadingElement>(null);
  const formRegion = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const options = { signal: controller.signal };
        const [res, status] = await Promise.all([
          fetch("/api/kiosk/settings", options),
          fetch("/api/kiosk/status", { ...options, cache: "no-store" }),
        ]);
        const result = res.ok && status.ok
          ? ((await res.json()) as { data?: BookSettings | null }).data
          : null;
        const license = status.ok
          ? ((await status.json()) as { data?: { licensed?: boolean } }).data
          : null;
        if (!controller.signal.aborted) {
          setSettingsResult(result && license
            ? { ...result, publicBookingEnabled: result.publicBookingEnabled && license.licensed === true }
            : "error");
        }
      } catch {
        if (!controller.signal.aborted) setSettingsResult("error");
      }
    };
    void load();
    return () => controller.abort();
  }, [loadAttempt]);

  useEffect(() => {
    const target = phase === "form" ? formRegion.current : introHeading.current;
    if (!target) return;
    target.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [phase]);

  const settings = settingsResult === "error" ? null : settingsResult;
  const enabled = settings !== null && settings.publicBookingEnabled !== false;
  const logoUrl = settings?.logoUrl || "/yenshow-logo.svg";

  const handleRetry = () => {
    introHeading.current?.focus();
    setSettingsResult(null);
    setLoadAttempt((attempt) => attempt + 1);
  };

  return (
    <>
      <ThemeSync theme={settings?.theme} />

      {phase === "intro" ? (
        <main
          className="flex min-h-dvh flex-col px-5 sm:px-10"
          aria-labelledby="book-title"
        >
          <header className="mx-auto flex w-full max-w-6xl items-center border-b border-(--border-panel) py-5 sm:py-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="公司標誌"
              className="h-9 max-w-[min(100%,13rem)] object-contain object-left sm:h-12"
            />
          </header>

          <div className="book-enter mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-9 py-9 motion-reduce:animate-none sm:gap-12 sm:py-14 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:py-20">
            <div>
              <h1
                id="book-title"
                ref={introHeading}
                tabIndex={-1}
                className="text-4xl font-bold tracking-tight outline-none sm:text-6xl lg:text-7xl"
              >
                訪客預約
              </h1>
              {enabled ? (
                <>
                  <p className="mt-4 text-lg leading-8 text-(--text-secondary) sm:mt-6 sm:text-xl">
                    可預約自今日起 {PUBLIC_BOOKING_MAX_DAYS} 天內的來訪時段。
                  </p>
                  <div className="mt-6 max-w-lg border-l-2 border-(--border-panel-strong) pl-4 sm:mt-8">
                    <h2 className="font-bold">預約前請準備</h2>
                    <p className="mt-1 leading-7 text-(--text-secondary)">
                      被訪人的部門與姓名、預計來訪時段，以及您的 Email
                      和手機號碼。
                    </p>
                  </div>
                  <button
                    type="button"
                    className="mt-8 inline-flex min-h-14 w-full cursor-pointer items-center justify-between gap-8 rounded-xl bg-blue-600 px-6 py-3 text-lg font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus-ring) sm:w-auto"
                    onClick={() => setPhase("form")}
                  >
                    開始預約
                    <span aria-hidden="true">→</span>
                  </button>
                </>
              ) : settingsResult === "error" ? (
                <>
                  <p
                    className="mt-5 leading-7 text-(--text-secondary)"
                    role="alert"
                  >
                    目前無法載入預約頁面，請稍後再試。
                  </p>
                  <button
                    type="button"
                    className="mt-6 min-h-12 cursor-pointer rounded-xl border border-(--border-panel-strong) px-5 font-bold hover:bg-(--surface-panel-hover) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus-ring)"
                    onClick={handleRetry}
                  >
                    重新載入
                  </button>
                </>
              ) : settings ? (
                <div className="mt-5">
                  <h2 className="text-xl font-bold">線上預約未開放</h2>
                  <p className="mt-2 leading-7 text-(--text-secondary)">
                    請使用現場訪客機辦理，或聯繫您的接待人員。
                  </p>
                </div>
              ) : (
                <p
                  className="mt-5 leading-7 text-(--text-secondary)"
                  role="status"
                >
                  正在載入預約服務…
                </p>
              )}
            </div>

            {enabled ? (
              <section
                className="rounded-3xl bg-white p-6 text-slate-900 shadow-xl sm:p-9 lg:p-10"
                aria-labelledby="book-steps-title"
              >
                <h2
                  id="book-steps-title"
                  className="text-xl font-bold sm:text-2xl"
                >
                  預約與報到流程
                </h2>
                <ol
                  className="mt-5 list-none divide-y divide-slate-200 border-t border-slate-200"
                  role="list"
                >
                  {BOOKING_STEPS.map((step, index) => (
                    <li
                      key={step.title}
                      className="flex items-start gap-4 py-4 last:pb-0 sm:py-5"
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-700"
                      >
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="font-bold">{step.title}</h3>
                        <p className="mt-1 leading-7 text-slate-600">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        </main>
      ) : (
        <main
          ref={formRegion}
          tabIndex={-1}
          aria-label="訪客預約表單"
          className="book-enter mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-4 py-8 outline-none motion-reduce:animate-none"
        >
          <AppointForm variant="public" onHome={() => setPhase("intro")} />
        </main>
      )}
    </>
  );
}
