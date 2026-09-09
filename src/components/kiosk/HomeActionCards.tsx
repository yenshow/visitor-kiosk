import type { ReactNode } from "react";
import type { RecordsFilter } from "@/lib/kiosk/ui-constants";

export type KioskStatsView = {
  onSite: number;
  tempOut: number;
  /** 今日離場 */
  departed: number;
  /** 所有離場累計 */
  departedTotal?: number;
};

type HomeActionCardsProps = {
  onCheckin: () => void;
  onCheckout: () => void;
  onAppoint: () => void;
  onOpenRecords: (filter: RecordsFilter) => void;
  showAppoint?: boolean;
  stats?: KioskStatsView | null;
};

const TILE_BASE =
  "relative flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 px-5 py-5 text-center outline-none backdrop-blur-md transition duration-200 hover:-translate-y-0.5 active:scale-[0.99] landscape:min-h-[9.5rem] landscape:flex-1 landscape:gap-3 landscape:py-6";

const TILE_FOCUS =
  "focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--focus-ring)_55%,transparent),0_8px_32px_rgba(0,0,0,0.2)]";

const TILE_TITLE = "text-3xl font-bold tracking-wide landscape:text-4xl";

const TileIcon = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 48 48"
    className="h-12 w-12 landscape:h-14 landscape:w-14"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

/** 統計卡：沿用原本輕量面板，不另加重底 */
const StatCell = ({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick: () => void;
}) => (
  <button
    type="button"
    className="flex min-h-28 flex-1 flex-col items-center justify-center rounded-2xl border border-(--border-panel) bg-(--surface-panel) px-4 py-5 text-center outline-none backdrop-blur-sm transition hover:bg-(--surface-panel-hover) focus-visible:ring-2 focus-visible:ring-(--focus-ring) active:scale-[0.99]"
    aria-label={`${label} ${value}，開啟訪客紀錄`}
    onClick={onClick}
  >
    <span className="text-lg tracking-wide text-(--text-secondary) landscape:text-2xl">
      {label}
    </span>
    <span className="mt-2 text-[36px] font-bold tabular-nums leading-none text-(--text-primary) landscape:mt-3 landscape:text-[96px]">
      {value}
    </span>
  </button>
);

export const HomeActionCards = ({
  onCheckin,
  onCheckout,
  onAppoint,
  onOpenRecords,
  showAppoint = true,
  stats,
}: HomeActionCardsProps) => (
  <div className="flex w-full flex-col items-center gap-4 landscape:gap-8">
    {stats ? (
      <div
        className="flex w-full gap-4 landscape:gap-8"
        role="region"
        aria-label="訪客統計"
      >
        <StatCell
          label="目前在場"
          value={stats.onSite}
          onClick={() => onOpenRecords("on_site")}
        />
        <StatCell
          label="臨時外出"
          value={stats.tempOut}
          onClick={() => onOpenRecords("temp_out")}
        />
        <StatCell
          label="今日離場"
          value={stats.departed}
          onClick={() => onOpenRecords("departed_today")}
        />
      </div>
    ) : null}

    <div className="flex w-full flex-col gap-4 landscape:flex-row landscape:items-stretch landscape:gap-8">
      <button
        type="button"
        className={`${TILE_BASE} ${TILE_FOCUS} kiosk-tile-primary`}
        aria-label="訪客報到，簽到或臨時外出返回"
        onClick={onCheckin}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-(--tile-primary-icon-bg) landscape:h-20 landscape:w-20">
          <TileIcon>
            <rect x="8" y="10" width="22" height="28" rx="3" />
            <path d="M16 20h6M16 26h6M16 32h4" />
            <path d="M34 18v12" />
            <path d="M28 24h12" />
            <path d="M36 20l6 4-6 4" />
          </TileIcon>
        </span>
        <span className={TILE_TITLE}>訪客報到</span>
        <span className="text-base font-medium text-(--tile-primary-muted) landscape:text-lg">
          簽到或臨時外出返回
        </span>
      </button>

      <button
        type="button"
        className={`${TILE_BASE} ${TILE_FOCUS} kiosk-tile-secondary`}
        aria-label="訪客簽退離場，密碼或手機號碼離場"
        onClick={onCheckout}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-(--tile-secondary-icon-border) bg-(--tile-secondary-icon-bg) landscape:h-20 landscape:w-20">
          <TileIcon>
            <rect x="18" y="10" width="22" height="28" rx="3" />
            <path d="M14 18v12" />
            <path d="M20 24H8" />
            <path d="M12 20l-6 4 6 4" />
          </TileIcon>
        </span>
        <span className={TILE_TITLE}>訪客簽退</span>
        <span className="text-base text-(--tile-secondary-muted) landscape:text-lg">
          臨時外出或正式簽退
        </span>
      </button>
    </div>

    {showAppoint ? (
      <button
        type="button"
        className="cursor-pointer pt-2 text-xl font-semibold tracking-wide text-(--text-secondary) underline-offset-8 outline-none hover:text-(--text-primary) hover:underline focus-visible:text-(--text-primary) focus-visible:underline landscape:pt-3 landscape:text-2xl"
        aria-label="訪客預約，現場申請等待內部確認"
        onClick={onAppoint}
      >
        訪客預約
      </button>
    ) : null}
  </div>
);
