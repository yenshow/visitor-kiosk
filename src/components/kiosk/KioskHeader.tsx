"use client";

import { useSyncExternalStore } from "react";
import { formatClockDisplay } from "@/lib/kiosk/format";

const subscribeClock = (onStoreChange: () => void) => {
  const timer = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(timer);
};

const getClockSnapshot = () => Math.floor(Date.now() / 1000);
const getServerClockSnapshot = () => 0;

export const KioskHeader = () => {
  const epochSeconds = useSyncExternalStore(
    subscribeClock,
    getClockSnapshot,
    getServerClockSnapshot,
  );
  const clock =
    epochSeconds > 0 ? formatClockDisplay(new Date(epochSeconds * 1000)) : null;

  return (
    <header className="flex shrink-0 flex-col items-center gap-6 landscape:flex-row landscape:justify-around">
      <img
        src="/yenshow-logo.svg"
        alt="遠岫科技"
        width={320}
        height={80}
        className="h-20 w-auto object-contain landscape:h-28"
      />
      <div className="flex flex-col items-center landscape:items-end">
        <div className="ms-3 text-[32px] font-semibold tracking-[8px] landscape:text-[44px] landscape:tracking-[12px]">
          {clock?.date ?? "--"}
        </div>
        <div className="ms-1.5 mt-1 text-[18px] tracking-[4px] text-white/85 landscape:text-[26px] landscape:tracking-[6px]">
          {clock ? `${clock.weekday} ${clock.period} ${clock.time}` : "--"}
        </div>
      </div>
    </header>
  );
};
