"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { KioskStatsView } from "@/components/kiosk/HomeActionCards";
import { formatDateTime } from "@/lib/kiosk/format";
import type { RecordsFilter } from "@/lib/kiosk/ui-constants";

type VisitorRecordRow = {
  recordId: string;
  presence: "on_site" | "temp_out" | "departed";
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
  initialFilter?: RecordsFilter;
  onClose: () => void;
};

const PAGE_SIZE = 10;

const PRESENCE_LABEL: Record<VisitorRecordRow["presence"], string> = {
  on_site: "目前在場",
  temp_out: "臨時外出",
  departed: "已離場",
};

const FILTER_OPTIONS: { value: RecordsFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "on_site", label: "目前在場" },
  { value: "temp_out", label: "臨時外出" },
  { value: "departed_today", label: "今日離場" },
  { value: "departed", label: "所有離場" },
];

const matchesFilter = (
  row: VisitorRecordRow,
  filter: RecordsFilter,
): boolean => {
  if (filter === "all") return true;
  if (filter === "on_site") return row.presence === "on_site";
  if (filter === "temp_out") return row.presence === "temp_out";
  if (filter === "departed_today") {
    return row.presence === "departed" && Boolean(row.isDepartedToday);
  }
  if (filter === "departed") return row.presence === "departed";
  return true;
};

export const RecordsDialog = ({
  open,
  initialFilter = "all",
  onClose,
}: RecordsDialogProps) => {
  const titleId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<KioskStatsView | null>(null);
  const [rows, setRows] = useState<VisitorRecordRow[]>([]);
  const [filter, setFilter] = useState<RecordsFilter>(initialFilter);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filterSearchKey = `${filter}\0${search}`;
  const [trackedFilterSearch, setTrackedFilterSearch] =
    useState(filterSearchKey);

  if (filterSearchKey !== trackedFilterSearch) {
    setTrackedFilterSearch(filterSearchKey);
    setPage(1);
  }

  useEffect(() => {
    if (!open) return;
    setFilter(initialFilter);
  }, [open, initialFilter]);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white text-slate-900 shadow-2xl scheme-light"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h2 id={titleId} className="text-2xl font-bold">
            訪客紀錄
          </h2>
          <button
            type="button"
            className="min-h-12 rounded-xl border border-slate-300 px-4 text-lg font-semibold text-slate-700 active:bg-slate-50"
            aria-label="關閉訪客紀錄"
            onClick={onClose}
          >
            關閉
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {loading ? (
            <p className="text-lg text-slate-500">載入中…</p>
          ) : null}
          {error ? (
            <p className="text-lg text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {summary ? (
            <div>
              <h3 className="mb-3 w-fit border-b-2 border-slate-400 pb-1 text-lg font-semibold text-slate-800">
                統計摘要
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-left text-base">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="border border-slate-200 px-3 py-2">
                        目前在場
                      </th>
                      <th className="border border-slate-200 px-3 py-2">
                        臨時外出
                      </th>
                      <th className="border border-slate-200 px-3 py-2">
                        今日離場
                      </th>
                      <th className="border border-slate-200 px-3 py-2">
                        所有離場
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-200 px-3 py-2 tabular-nums">
                        {summary.onSite}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 tabular-nums">
                        {summary.tempOut}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 tabular-nums">
                        {summary.departed}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 tabular-nums">
                        {summary.departedTotal ?? summary.departed}
                      </td>
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
                    className={`min-h-12 rounded-xl border px-4 text-base font-semibold ${
                      selected
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-slate-700 active:bg-slate-50"
                    }`}
                    onClick={() => setFilter(opt.value)}
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="姓名／手機／車牌"
                aria-label="搜尋姓名、手機或車牌"
              />
            </label>
          </div>

          {!loading && !error && filtered.length === 0 ? (
            <div className="flex min-h-45 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-lg text-slate-500">尚無訪客紀錄</p>
            </div>
          ) : null}

          {filtered.length > 0 ? (
            <div>
              <h3 className="mb-3 w-fit border-b-2 border-slate-400 pb-1 text-lg font-semibold text-slate-800">
                明細
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-left text-sm sm:text-base">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                        狀態
                      </th>
                      <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                        姓名
                      </th>
                      <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                        手機
                      </th>
                      <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                        車牌
                      </th>
                      <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                        公司
                      </th>
                      <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                        被訪人
                      </th>
                      <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                        時間
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr key={`${row.presence}-${row.recordId}`} className="border-b border-slate-100">
                        <td className="border border-slate-200 px-3 py-2">
                          {row.presence === "departed" && row.isDepartedToday
                            ? "今日離場"
                            : PRESENCE_LABEL[row.presence]}
                        </td>
                        <td className="border border-slate-200 px-3 py-2">
                          {row.visitorName || "—"}
                        </td>
                        <td className="border border-slate-200 px-3 py-2">
                          {row.phoneNo || "—"}
                        </td>
                        <td className="border border-slate-200 px-3 py-2">
                          {row.plateNo || "—"}
                        </td>
                        <td className="border border-slate-200 px-3 py-2">
                          {row.companyName || "—"}
                        </td>
                        <td className="border border-slate-200 px-3 py-2">
                          {row.receptionistName || "—"}
                        </td>
                        <td className="border border-slate-200 px-3 py-2">
                          {formatDateTime(row.at)}
                        </td>
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
                    className="min-h-11 rounded-lg border border-slate-300 px-4 text-base font-semibold text-slate-700 active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="上一頁"
                    disabled={pageSafe <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    上一頁
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border border-slate-300 px-4 text-base font-semibold text-slate-700 active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="下一頁"
                    disabled={pageSafe >= totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                  >
                    下一頁
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
