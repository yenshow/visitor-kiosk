import type { ReactNode } from "react";

export type KioskStatsView = {
  onSite: number;
  tempOut: number;
  departedToday: number;
  vehicles: {
    onSite: number;
    outing: number;
  };
};

type HomeActionCardsProps = {
  onCheckin: () => void;
  onCheckout: () => void;
  onAppoint: () => void;
  stats?: KioskStatsView | null;
};

const TILE_BASE =
  "relative flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 px-5 py-5 text-center outline-none backdrop-blur-md transition duration-200 before:pointer-events-none before:absolute before:inset-[-50%] before:z-0 before:rotate-45 before:bg-[linear-gradient(45deg,transparent_30%,rgba(255,255,255,0.1)_50%,transparent_70%)] hover:-translate-y-0.5 active:scale-[0.99] landscape:min-h-[9.5rem] landscape:flex-1 landscape:gap-3 landscape:py-6 [&>*]:relative [&>*]:z-10";

const TILE_FOCUS =
  "focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,#5be7f1_55%,transparent),0_8px_32px_rgba(0,0,0,0.2)]";

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

const StatCell = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) => (
  <div
    className="flex min-h-28 flex-1 flex-col items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-4 py-5 text-center backdrop-blur-sm"
    aria-label={`${label} ${value}${hint ? `，${hint}` : ""}`}
  >
    <span className="text-lg tracking-wide text-white/80 landscape:text-2xl">
      {label}
    </span>
    <span className="mt-2 text-[36px] font-bold tabular-nums leading-none text-white landscape:mt-3 landscape:text-[96px]">
      {value}
    </span>
    {hint ? (
      <span className="mt-2 text-sm text-white/60 landscape:text-base">
        {hint}
      </span>
    ) : null}
  </div>
);

export const HomeActionCards = ({
  onCheckin,
  onCheckout,
  onAppoint,
  stats,
}: HomeActionCardsProps) => {
  const showVehicles = Boolean(
    stats && (stats.vehicles.onSite > 0 || stats.vehicles.outing > 0),
  );

  return (
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
            hint={showVehicles ? `場內車 ${stats.vehicles.onSite}` : undefined}
          />
          <StatCell
            label="臨時外出"
            value={stats.tempOut}
            hint={showVehicles ? `外出車 ${stats.vehicles.outing}` : undefined}
          />
          <StatCell label="今日離場" value={stats.departedToday} />
        </div>
      ) : null}

      <div className="flex w-full flex-col gap-4 landscape:flex-row landscape:items-stretch landscape:gap-8">
        <button
          type="button"
          className={`${TILE_BASE} ${TILE_FOCUS} border-white/55 bg-[linear-gradient(145deg,#2dd4bf_0%,#1ba9d3_100%)] text-[#0b2c3c] shadow-[0_12px_40px_rgba(23,217,199,0.28),0_0_24px_rgba(27,169,211,0.22),inset_0_1px_0_rgba(255,255,255,0.45)]`}
          aria-label="訪客報到，密碼或手機號碼簽到"
          onClick={onCheckin}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/25 landscape:h-20 landscape:w-20">
            <TileIcon>
              <rect x="8" y="10" width="22" height="28" rx="3" />
              <path d="M16 20h6M16 26h6M16 32h4" />
              <path d="M34 18v12" />
              <path d="M28 24h12" />
              <path d="M36 20l6 4-6 4" />
            </TileIcon>
          </span>
          <span className={TILE_TITLE}>訪客報到</span>
          <span className="text-base font-medium opacity-80 landscape:text-lg">
            密碼或手機號碼簽到
          </span>
        </button>

        <button
          type="button"
          className={`${TILE_BASE} ${TILE_FOCUS} border-[#5be7f1]/55 bg-white/10 text-[#e8fbff] shadow-[0_8px_32px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_4px_rgba(0,0,0,0.2)] hover:border-[#5be7f1]/75 hover:bg-white/16`}
          aria-label="訪客簽退離場，密碼或手機號碼離場"
          onClick={onCheckout}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-[#5be7f1]/50 bg-white/10 landscape:h-20 landscape:w-20">
            <TileIcon>
              <rect x="18" y="10" width="22" height="28" rx="3" />
              <path d="M14 18v12" />
              <path d="M20 24H8" />
              <path d="M12 20l-6 4 6 4" />
            </TileIcon>
          </span>
          <span className={TILE_TITLE}>訪客簽退</span>
          <span className="text-[#e8fbff]/75 text-base landscape:text-lg">
            臨時外出或正式簽退
          </span>
        </button>
      </div>

      <button
        type="button"
        className="cursor-pointer pt-2 text-xl font-semibold tracking-wide text-white/85 underline-offset-8 outline-none hover:text-white hover:underline focus-visible:text-white focus-visible:underline landscape:pt-3 landscape:text-2xl"
        aria-label="訪客預約，現場申請等待內部確認"
        onClick={onAppoint}
      >
        訪客預約
      </button>
    </div>
  );
};
