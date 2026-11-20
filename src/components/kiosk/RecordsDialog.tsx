"use client";

import { useEffect, useMemo, useState } from "react";
import { KioskDialog } from "@/components/kiosk/KioskDialog";
import { taipeiDateKeyFromIso, toTaipeiDateKey } from "@/lib/kiosk/api-helpers";
import type { AppointmentRecordRow, KioskRecordsPayload, VisitorRecordRow } from "@/lib/kiosk/records";
import type { RecordsFilter } from "@/lib/kiosk/ui-constants";

type Row = VisitorRecordRow | AppointmentRecordRow;
type View = "visits" | "appointments";
type DialogProps = {
  open: boolean;
  onClose: () => void;
};

const PAGE_SIZE = 10;
const STATUS = {
  on_site: { label: "目前在場", tone: "bg-emerald-100 text-emerald-900" },
  temp_out: { label: "臨時外出", tone: "bg-amber-100 text-amber-900" },
  overstay: { label: "逾期在場", tone: "bg-red-100 text-red-900" },
  departed: { label: "已離場", tone: "bg-slate-100 text-slate-700" },
};
const FILTERS: { value: RecordsFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "on_site", label: STATUS.on_site.label },
  { value: "temp_out", label: STATUS.temp_out.label },
  { value: "overstay", label: STATUS.overstay.label },
  { value: "departed_today", label: "今日離場" },
  { value: "departed", label: "所有離場" },
];
const EVENT_LABEL = { checkin: "報到", temp_out: "臨時外出", return: "返回", departed: "離場" };
const FIELD = "mt-1.5 block min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-base font-normal outline-none placeholder:text-slate-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:px-3";
const BUTTON = "min-h-11 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-base font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45";
const TIME = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const formatTime = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? TIME.format(timestamp) : value;
};
const isAppointment = (row: Row): row is AppointmentRecordRow => "status" in row;
const eventsFor = (row: VisitorRecordRow) =>
  row.events.map(({ type, at }) => `${EVENT_LABEL[type]} ${formatTime(at)}`);

const csvCell = (value: string) => {
  // Quoted cells still need formula protection in spreadsheet applications.
  const safe = /^\s*[=+@\-＝＋＠－]|^[\t\r\n]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
};

const downloadCsv = (view: View, rows: Row[]) => {
  const common = ["預約碼", "姓名", "手機", "公司", "被訪人", "狀態"];
  const header = view === "appointments"
    ? [...common, "預約開始（台灣）", "預約結束（台灣）"]
    : [...common, "車牌", "報到（台灣）", "臨時外出（台灣）", "離場（台灣）", "進出歷程"];
  const values = rows.map((row) => {
    const { appointCode, visitorName, phoneNo, companyName, receptionistName } = row;
    const fields = [appointCode, visitorName, phoneNo, companyName, receptionistName];
    return isAppointment(row)
      ? [...fields, row.status, formatTime(row.startAt), formatTime(row.endAt)]
      : [...fields, STATUS[row.presence].label, row.plateNo, formatTime(row.checkinAt),
          formatTime(row.tempOutAt), formatTime(row.departedAt), eventsFor(row).join("\n")];
  });
  const csv = [header, ...values].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${view === "visits" ? "訪客紀錄" : "預約紀錄"}-${toTaipeiDateKey()}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const RecordDetails = ({ row }: { row: Row }) => {
  const fields = [["手機", row.phoneNo], ["被訪人", row.receptionistName]];
  if (!isAppointment(row)) {
    fields.push(["車牌", row.plateNo], ["臨時外出", formatTime(row.tempOutAt)]);
  }
  const events = isAppointment(row) ? [] : eventsFor(row);
  return (
    <div className="space-y-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-base">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-slate-600">{label}</dt>
            <dd className="mt-1 break-words font-medium">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      {events.length > 0 && (
        <ul aria-label="進出歷程" className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-3">
          {events.map((event, index) => <li key={index}>{event}</li>)}
        </ul>
      )}
    </div>
  );
};

const RecordCard = ({
  row, relatedId, expanded, onToggle, onOpenRelated,
}: {
  row: Row;
  relatedId?: string;
  expanded: boolean;
  onToggle: () => void;
  onOpenRelated: (view: View, recordId: string) => void;
}) => {
  const appointment = isAppointment(row);
  const status = appointment ? { label: row.status, tone: "bg-blue-50 text-blue-900" } : STATUS[row.presence];
  const times = appointment
    ? [["開始", row.startAt], ["結束", row.endAt]]
    : [["報到", row.checkinAt], ["離場", row.departedAt]];

  return (
    <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 break-words">
            <h3 className="text-xl leading-tight font-semibold">{row.visitorName || "—"}</h3>
            {row.companyName && <p className="mt-0.5 text-sm text-slate-600">{row.companyName}</p>}
          </div>
          <span className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold ${status.tone}`}>
            {status.label}
          </span>
        </div>
        <div className="mt-3 grid items-start gap-3 md:grid-cols-[minmax(6rem,.6fr)_minmax(0,2fr)_auto]">
          <div>
            <span className="me-2 text-sm text-slate-600 md:block">預約碼</span>
            {relatedId && row.appointCode ? (
              <button
                type="button"
                className="cursor-pointer text-base font-semibold tabular-nums text-blue-800 underline underline-offset-3"
                aria-label={`查詢 ${row.appointCode} 的${appointment ? "訪客" : "預約"}紀錄`}
                onClick={() => onOpenRelated(appointment ? "visits" : "appointments", relatedId)}
              >
                {row.appointCode}
              </button>
            ) : <span className="text-base font-semibold tabular-nums">{row.appointCode || "—"}</span>}
          </div>
          <dl aria-label="時間（台灣）" className="grid gap-2 tabular-nums sm:grid-cols-2">
            {times.map(([label, at]) => (
              <div key={label} className="min-w-0">
                <dt className="text-sm text-slate-600">{label}</dt>
                <dd className="mt-0.5 break-words text-base font-medium">{at ? <time dateTime={at}>{formatTime(at)}</time> : "—"}</dd>
              </div>
            ))}
          </dl>
          <button type="button" aria-expanded={expanded} className={`${BUTTON} justify-self-start self-end`} onClick={onToggle}>
            {expanded ? "收合明細" : "明細"}
          </button>
        </div>
      </div>
      {expanded && <RecordDetails row={row} />}
    </li>
  );
};

const RecordsPanel = () => {
  const [data, setData] = useState<KioskRecordsPayload | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("visits");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filter, setFilter] = useState<RecordsFilter>("all");
  const [linkedId, setLinkedId] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/kiosk/records", { signal: controller.signal });
        const result = (await response.json()) as { data?: KioskRecordsPayload; msg?: string };
        if (!response.ok || !result.data) throw new Error(result.msg || "載入紀錄失敗");
        if (!controller.signal.aborted) setData(result.data);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error && error.name !== "SyntaxError"
          ? error.message : "載入紀錄失敗");
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const selectView = (next: View, related = "") => {
    setView(next);
    setLinkedId(related);
    setSearch("");
    setExpandedId("");
    setPage(1);
    if (related) {
      setFrom("");
      setTo("");
      setFilter("all");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFrom("");
    setTo("");
    setFilter("all");
    setLinkedId("");
    setExpandedId("");
    setPage(1);
  };

  const invalidDates = Boolean(from && to && from > to);
  const filtered = useMemo(() => {
    if (invalidDates) return [];
    const keyword = search.trim().toLowerCase();
    const matchesDate = (start: string, end = start) => {
      const first = taipeiDateKeyFromIso(start);
      const last = taipeiDateKeyFromIso(end) || first;
      return Boolean(first && (!from || last >= from) && (!to || first <= to));
    };
    const records: Row[] = (view === "visits" ? data?.rows : data?.appointments) ?? [];
    return records.filter((row) => {
      if (linkedId && row.recordId !== linkedId) return false;
      const appointment = isAppointment(row);
      if (!appointment && filter !== "all") {
        if (filter === "departed_today" ? !row.isDepartedToday : filter !== row.presence) return false;
      }
      if (from || to) {
        const match = appointment
          ? matchesDate(row.startAt, row.endAt)
          : [row.checkinAt, row.tempOutAt, row.departedAt, ...row.events.map(({ at }) => at)]
            .some((at) => matchesDate(at));
        if (!match) return false;
      }
      return !keyword || [
        row.appointCode, row.visitorName, row.phoneNo, row.receptionistName,
        row.companyName, appointment ? "" : row.plateNo,
      ].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [data, filter, from, invalidDates, linkedId, search, to, view]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const appointmentIds = useMemo(
    () => new Set(data?.appointments.map(({ recordId }) => recordId)),
    [data],
  );
  const summary = data?.summary;
  const stats = summary && [
    ["目前在場", summary.onSite], ["臨時外出", summary.tempOut], ["逾期在場", summary.overstay],
    ["今日離場", summary.departed], [summary.resetAt ? "本期離場" : "累計離場", summary.departedTotal],
  ];

  const hasFilters = Boolean(linkedId || search.trim() || from || to || (view === "visits" && filter !== "all"));

  return (
    <div className="space-y-4 text-slate-900 scheme-light" aria-busy={!data && !error}>
      <div className="border-b border-slate-200 bg-white pb-3 lg:sticky lg:top-0 lg:z-10">
        <div className="inline-flex rounded-2xl bg-slate-100 p-1" role="group" aria-label="紀錄類型">
          {(["visits", "appointments"] as const).map((option) => (
            <button key={option} type="button" aria-pressed={view === option}
              className={`min-h-11 cursor-pointer rounded-xl px-3 text-base font-semibold sm:px-5 ${view === option ? "bg-blue-800 text-white shadow-sm" : "text-slate-700 hover:bg-white"}`}
              onClick={() => { if (option !== view) selectView(option); }}>
              {option === "visits" ? "訪客紀錄" : "預約紀錄"}
            </button>
          ))}
        </div>
      </div>

      {view === "visits" && stats && (
        <div>
          <dl aria-label="訪客統計" className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-5">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <dt className="text-sm font-medium text-slate-700">{label}</dt>
                <dd className="mt-1 text-2xl leading-none font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {summary?.resetAt && <p className="mt-2 text-sm text-slate-600">上次重置 {formatTime(summary.resetAt)}</p>}
        </div>
      )}

      <div
        role="group"
        aria-label="篩選紀錄"
        className={`grid grid-cols-2 gap-3 ${view === "visits" ? "md:grid-cols-[minmax(0,1fr)_10rem_10rem_8rem]" : "md:grid-cols-[minmax(0,1fr)_10rem_10rem]"}`}
      >
        <label className="col-span-2 min-w-0 text-sm font-medium md:col-span-1">
          搜尋
          <input type="search" className={FIELD} value={search}
            placeholder="姓名／預約碼／手機"
            onChange={(event) => { setSearch(event.target.value); setLinkedId(""); setPage(1); }} />
        </label>
        <label className="min-w-0 text-sm font-medium">
          開始日期
          <input type="date" className={FIELD} value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
        </label>
        <label className="min-w-0 text-sm font-medium">
          結束日期
          <input type="date" className={FIELD} value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
        </label>
        {view === "visits" && (
          <label className="col-span-2 min-w-0 text-sm font-medium md:col-span-1">
            狀態
            <select className={FIELD} value={filter} onChange={(event) => { setFilter(event.target.value as RecordsFilter); setPage(1); }}>
              {FILTERS.map(({ label, value }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        )}
      </div>
      {invalidDates && <p role="alert" className="text-sm text-red-800">結束日期須晚於或等於開始日期。</p>}

      <section aria-label="查詢結果" className="min-w-0 space-y-3 border-t border-slate-200 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {data && <p className="text-base font-semibold tabular-nums" aria-live="polite">{filtered.length} 筆紀錄</p>}
            {hasFilters && (
              <button type="button" className={BUTTON} onClick={clearFilters}>
                清除篩選
              </button>
            )}
          </div>
          <button type="button" className={BUTTON} disabled={!filtered.length} onClick={() => downloadCsv(view, filtered)}>
            匯出 CSV
          </button>
        </div>
        {error && <p role="alert" className="text-base text-red-800">{error}</p>}
        {!data && !error && <p role="status" className="py-6 text-base text-slate-600">載入紀錄中…</p>}
        {data && !invalidDates && filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 py-8 text-center text-base text-slate-700">查無符合條件的紀錄</p>
        )}

        {shown.length > 0 && (
          <ul className="space-y-3">
            {shown.map((row) => (
              <RecordCard
                key={row.recordId}
                row={row}
                relatedId={isAppointment(row) ? row.visitRecordId : appointmentIds.has(row.appointmentId) ? row.appointmentId : undefined}
                expanded={expandedId === row.recordId}
                onToggle={() => setExpandedId((id) => id === row.recordId ? "" : row.recordId)}
                onOpenRelated={selectView}
              />
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button type="button" className={BUTTON} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>上一頁</button>
            <span className="text-base tabular-nums">{currentPage} / {pages}</span>
            <button type="button" className={BUTTON} disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>下一頁</button>
          </div>
        )}
      </section>
    </div>
  );
};

export const RecordsDialog = ({ open, onClose }: DialogProps) => (
  <KioskDialog open={open} onClose={onClose} title="訪客與預約紀錄" closeLabel="關閉訪客與預約紀錄" maxWidthClass="max-w-6xl">
    <RecordsPanel />
  </KioskDialog>
);
