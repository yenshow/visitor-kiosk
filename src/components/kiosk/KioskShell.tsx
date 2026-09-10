"use client";

import type { ReactNode } from "react";
import { KioskHeader } from "@/components/kiosk/KioskHeader";
import { DEFAULT_MARQUEE } from "@/lib/kiosk/ui-constants";

type KioskShellProps = {
  children: ReactNode;
  hasCredentials?: boolean;
  layout?: "home" | "flow";
  marquee?: string;
  logoUrl?: string;
};

const SHELL_MAIN_HOME =
  "mx-auto flex min-h-0 w-full flex-1 flex-col px-4 pt-8 landscape:w-3/4 landscape:max-w-7xl landscape:px-0 landscape:pt-12";

const SHELL_MAIN_FLOW =
  "mx-auto flex min-h-0 w-full flex-1 flex-col px-4 py-3 landscape:w-3/4 landscape:max-w-7xl landscape:px-0 landscape:py-4";

/** 跑馬燈對齊 ba SafetyBanner：固定 bg-blue-600，不隨主題變色 */
const MarqueeBanner = ({ text }: { text: string }) => (
  <div
    className="shrink-0 overflow-hidden bg-blue-600 py-2"
    role="region"
    aria-label={text}
  >
    <div className="kiosk-marquee-track flex w-max">
      {Array.from({ length: 3 }, (_, index) => (
        <span
          key={index}
          className="shrink-0 px-4 text-[36px] font-semibold whitespace-nowrap text-white portrait:text-[40px] min-[1536px]:landscape:text-[64px]"
          aria-hidden="true"
        >
          {text}
        </span>
      ))}
    </div>
  </div>
);

export const KioskShell = ({
  children,
  hasCredentials = true,
  layout = "home",
  marquee,
  logoUrl,
}: KioskShellProps) => {
  const isHome = layout === "home";
  const marqueeText = marquee?.trim() || DEFAULT_MARQUEE;

  return (
    <div
      className={
        isHome
          ? "flex h-dvh max-h-dvh flex-col overflow-hidden bg-(image:--shell-gradient) text-(--text-primary)"
          : "flex min-h-dvh flex-col overflow-x-hidden overflow-y-auto bg-(image:--shell-gradient) text-(--text-primary) landscape:h-dvh landscape:max-h-dvh landscape:overflow-hidden"
      }
    >
      {isHome ? <MarqueeBanner text={marqueeText} /> : null}

      <div className={isHome ? SHELL_MAIN_HOME : SHELL_MAIN_FLOW}>
        {!hasCredentials ? (
          <div
            className="rounded-2xl border border-red-300/70 bg-red-950/40 px-4 py-3 text-center text-base text-red-100"
            role="alert"
          >
            尚未設定連線金鑰，無法連線 YSCP。請在 `.env` 填入 OpenAPI
            金鑰後重啟服務。
          </div>
        ) : null}

        {isHome ? <KioskHeader logoUrl={logoUrl} /> : null}

        <div
          className={
            isHome
              ? "flex min-h-0 flex-1 flex-col justify-center"
              : "flex min-h-0 flex-1 flex-col justify-start landscape:justify-center"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
};
