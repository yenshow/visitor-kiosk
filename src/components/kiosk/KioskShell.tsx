"use client";

import type { ReactNode } from "react";
import { KioskHeader } from "@/components/kiosk/KioskHeader";

type KioskShellProps = {
  children: ReactNode;
  hasCredentials?: boolean;
  layout?: "home" | "flow";
};

const DEFAULT_MARQUEE = "歡迎使用訪客服務機｜請選擇訪客報到、簽退或現場預約";

const SHELL_MAIN_HOME =
  "mx-auto flex min-h-0 w-3/4 flex-1 flex-col pt-8 landscape:max-w-7xl landscape:pt-12";

const SHELL_MAIN_FLOW =
  "mx-auto flex min-h-0 w-3/4 flex-1 flex-col py-3 landscape:max-w-7xl landscape:py-4";

const MarqueeBanner = ({ text }: { text: string }) => (
  <div
    className="shrink-0 overflow-hidden bg-blue-600 py-2"
    role="region"
    aria-label={text}
  >
    <div className="flex w-max animate-marquee motion-reduce:animate-none">
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
}: KioskShellProps) => {
  const isHome = layout === "home";

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden">
      {isHome ? (
        <MarqueeBanner
          text={
            process.env.NEXT_PUBLIC_KIOSK_MARQUEE?.trim() || DEFAULT_MARQUEE
          }
        />
      ) : null}

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

        {isHome ? <KioskHeader /> : null}

        <div className="flex min-h-0 flex-1 flex-col justify-center">
          {children}
        </div>
      </div>
    </div>
  );
};
