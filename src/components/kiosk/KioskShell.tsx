"use client";

import type { ReactNode } from "react";
import { KioskHeader } from "@/components/kiosk/KioskHeader";
import { DEFAULT_MARQUEE } from "@/lib/kiosk/ui-constants";

type KioskShellProps = {
  children: ReactNode;
  licensed?: boolean;
  layout?: "home" | "flow";
  marquee?: string;
  logoUrl?: string;
};

const SHELL_MAIN =
  "mx-auto flex min-h-0 w-full flex-1 flex-col px-4 landscape:w-3/4 landscape:max-w-7xl landscape:px-0";

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
  licensed = true,
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

      <div
        className={`${SHELL_MAIN} ${
          isHome ? "pt-8 landscape:pt-12" : "py-3 landscape:py-4"
        }`}
      >
        {!licensed ? (
          <div
            className="mb-3 rounded-2xl border border-amber-300/70 bg-amber-950/40 px-4 py-3 text-center text-base text-amber-50"
            role="alert"
          >
            尚未授權訪客功能。請於桌面「YsopKiosk」完成授權後再使用預約與報到；簽退仍可使用。
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
