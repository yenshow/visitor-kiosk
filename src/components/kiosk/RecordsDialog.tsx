"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { KioskStatsView } from "@/components/kiosk/HomeActionCards";
import { formatDateTime } from "@/lib/kiosk/format";
import type { RecordsFilter } from "@/lib/kiosk/ui-constants";

type VisitorRecordRow = {
  recordId: string;
  presence: "on_site" | "temp_out" | "overstay" | "departed";
  visitorName: string;
  phoneNo: string;
  plateNo: string;
  companyName: string;
  receptionistName: string;
  at: string;
  isDepartedToday?: boolean;
};

type RecordsDialogProps = {
  open: boolean;
  onClose: () => void;
  reloadToken?: number;
  initialFilter?: RecordsFilter;
};

const PAGE_SIZE = 10;

const SUMMARY_COLS = [
  "目前在場",
  "臨時外出",
  "逾期在場",
  "今日離場",
  "所有離場",
] as const;

const DETAIL_COLS = [
  "狀態",
  "姓名",
  "手機",
  "車牌",
  "公司",
  "被訪人",
  "時間",
] as const;

const PRESENCE_LABEL: Record<VisitorRecordRow["presence"], string> = {
  on_site: "目前在場",
  temp_out: "臨時外出",
  overstay: "逾期在場",
  departed: "已離場",
};

const FILTER_OPTIONS: { value: RecordsFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "on_site", label: "目前在場" },
  { value: "temp_out", label: "臨時外出" },
  { value: "overstay", label: "逾期在場" },
  { value: "departed_today", label: "今日離場" },
  { value: "departed", label: "所有離場" },
];

const SECTION_TITLE =
  "mb-3 w-fit border-b-2 border-slate-400 pb-1 text-lg font-semibold text-slate-800";
const CELL = "border border-slate-200 px-3 py-2";
const BTN =
  "min-h-11 cursor-pointer rounded-lg border border-slate-300 px-4 text-base font-semibold text-slate-700 active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

const matchesFilter = (
  row: VisitorRecordRow,
  filter: RecordsFilter,
): boolean => {
  if (filter === "all") return true;
  if (filter === "on_site") return row.presence === "on_site";
  if (filter === "temp_out") return row.presence === "temp_out";
  if (filter === "overstay") return row.presence === "overstay";
  if (filter === "departed_today") {
    return row.presence === "departed" && Boolean(row.isDepartedToday);
  }
  return filter === "departed" && row.presence === "departed";
};

const cellText = (value: string) => value || "—";

const RecordsPanel = ({
  initialFilter = "all",
  reloadToken = 0,
}: {
  initialFilter?: RecordsFilter;
  reloadToken?: number;
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<KioskStatsView | null>(null);
  const [rows, setRows] = useState<VisitorRecordRow[]>([]);
  const [filter, setFilter] = useState<RecordsFilter>(initialFilter);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/kiosk/records");
        const json = (await res.json()) as {
          msg?: string;
          data?: { summary?: KioskStatsView; rows?: VisitorRecordRow[] };
        };
        if (!res.ok || !json.data) {
          if (!cancelled) setError(json.msg || "載入紀錄失敗");
          return;
        }
        if (!cancelled) {
          setSummary(json.data.summary ?? null);
          setRows(json.data.rows ?? []);
        }
      } catch {
        if (!cancelled) setError("載入紀錄失敗");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!matchesFilter(row, filter)) return false;
      if (!q) return true;
      return (
        row.visitorName.toLowerCase().includes(q) ||
        row.phoneNo.toLowerCase().includes(q) ||
        row.plateNo.toLowerCase().includes(q) ||
        row.companyName.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (pageSafe - 1) * PAGE_SIZE,
    pageSafe * PAGE_SIZE,
  );

  const summaryValues = summary
    ? [
        summary.onSite,
        summary.tempOut,
        summary.overstay,
        summary.departed,
        summary.departedTotal ?? summary.departed,
      ]
    : [];

  return (
    <div className="flex w-full flex-col space-y-5" aria-busy={loading}>
      {error ? (
        <p className="text-lg text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div
          className="h-14 rounded-xl border border-slate-200 bg-slate-50/80"
          aria-hidden
        />
      ) : null}

      {!loading && summary ? (
        <div>
          <h4 className={SECTION_TITLE}>統計摘要</h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200 text-left text-base">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  {SUMMARY_COLS.map((label) => (
                    <th key={label} className={CELL}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {summaryValues.map((value, index) => (
                    <td
                      key={SUMMARY_COLS[index]}
                      className={`${CELL} tabular-nums`}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="狀態篩選"
        >
          {FILTER_OPTIONS.map((opt) => {
            const selected = filter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`min-h-12 cursor-pointer rounded-xl border px-4 text-base font-semibold ${
                  selected
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 active:bg-slate-50"
                }`}
                onClick={() => {
                  setFilter(opt.value);
                  setPage(1);
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <label className="block min-w-56 flex-1 sm:max-w-xs">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            搜尋
          </span>
          <input
            type="search"
            className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="姓名／手機／車牌"
            aria-label="搜尋姓名、手機或車牌"
          />
        </label>
      </div>

      {!loading && !error && filtered.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-lg text-slate-500">尚無訪客紀錄</p>
        </div>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className="min-w-0">
          <h4 className={SECTION_TITLE}>明細</h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200 text-left text-sm sm:text-base">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  {DETAIL_COLS.map((label) => (
                    <th key={label} className={`whitespace-nowrap ${CELL}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    key={`${row.presence}-${row.recordId}`}
                    className="border-b border-slate-100"
                  >
                    <td className={CELL}>
                      {row.presence === "departed" && row.isDepartedToday
                        ? "今日離場"
                        : PRESENCE_LABEL[row.presence]}
                    </td>
                    <td className={CELL}>{cellText(row.visitorName)}</td>
                    <td className={CELL}>{cellText(row.phoneNo)}</td>
                    <td className={CELL}>{cellText(row.plateNo)}</td>
                    <td className={CELL}>{cellText(row.companyName)}</td>
                    <td className={CELL}>{cellText(row.receptionistName)}</td>
                    <td className={CELL}>{formatDateTime(row.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              第 {pageSafe} / {totalPages} 頁，共 {filtered.length} 筆
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={BTN}
                aria-label="上一頁"
                disabled={pageSafe <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一頁
              </button>
              <button
                type="button"
                className={BTN}
                aria-label="下一頁"
                disabled={pageSafe >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一頁
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const RecordsDialog = ({
  open,
  onClose,
  reloadToken = 0,
  initialFilter = "all",
}: RecordsDialogProps) => {
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
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <h2 id={titleId} className="text-2xl font-bold text-slate-900">
            訪客紀錄
          </h2>
          <button
            type="button"
            className="min-h-12 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 active:bg-slate-50"
            aria-label="關閉訪客紀錄"
            onClick={onClose}
          >
            關閉
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <RecordsPanel
            initialFilter={initialFilter}
            reloadToken={reloadToken}
          />
        </div>
      </div>
    </div>
  );
};
