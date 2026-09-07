"use client";

import { useMemo, useState } from "react";
import { FlowCard } from "@/components/kiosk/FlowCard";
import { IdleCountdown } from "@/components/kiosk/IdleCountdown";
import { NumericKeypad } from "@/components/kiosk/NumericKeypad";
import { formatDateTimeRange } from "@/lib/kiosk/format";

type Presence = "on_site" | "temp_out";
type CheckoutMode = "temp" | "return" | "final";

type CheckoutRecordView = {
  token: string;
  visitorName: string;
  phoneNo: string;
  companyName: string;
  receptionistName: string;
  plateNo?: string;
  presence: Presence;
  visitStartTime: string;
  visitEndTime: string;
  visitingTime?: string;
};

type CheckoutFlowProps = {
  idleSeconds: number;
  onHome: () => void;
};

const DONE_TITLE: Record<CheckoutMode, string> = {
  temp: "已登記臨時外出",
  return: "已確認返回",
  final: "正式簽退成功",
};

export const CheckoutFlow = ({ idleSeconds, onHome }: CheckoutFlowProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<CheckoutRecordView[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [acting, setActing] = useState(false);
  const [doneMode, setDoneMode] = useState<CheckoutMode | null>(null);
  const [doneMessage, setDoneMessage] = useState("");

  const canQuery = code.trim().length > 0;
  const selected = useMemo(
    () => records.filter((item) => selectedTokens.includes(item.token)),
    [records, selectedTokens],
  );
  const allTempOut =
    selected.length > 0 &&
    selected.every((item) => item.presence === "temp_out");
  const allOnSite =
    selected.length > 0 &&
    selected.every((item) => item.presence === "on_site");

  const handleResetQuery = () => {
    setError("");
    setRecords([]);
    setSelectedTokens([]);
  };

  const handleLookup = async (query: string) => {
    setLoading(true);
    setError("");
    setRecords([]);
    setSelectedTokens([]);
    try {
      const res = await fetch("/api/kiosk/checkout/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = (await res.json()) as {
        msg?: string;
        data?: { records?: CheckoutRecordView[] };
      };
      if (!res.ok) {
        setError(json.msg || "查詢失敗");
        return;
      }
      const list = (json.data?.records ?? []).map((item) => ({
        ...item,
        presence:
          item.presence === "temp_out"
            ? ("temp_out" as const)
            : ("on_site" as const),
      }));
      if (list.length === 0) {
        setError("查無在廠簽到記錄，請確認已報到或洽接待人員");
        return;
      }
      setRecords(list);
      setSelectedTokens(list.length === 1 ? [list[0].token] : []);
    } catch {
      setError("查詢失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (token: string) => {
    setSelectedTokens((prev) =>
      prev.includes(token)
        ? prev.filter((item) => item !== token)
        : [...prev, token],
    );
  };

  const handleAction = async (mode: CheckoutMode) => {
    if (selected.length === 0) {
      setError("請選擇至少一位訪客");
      return;
    }
    if (!allOnSite && !allTempOut) {
      setError("請分開處理「在場」與「臨時外出」的訪客");
      return;
    }

    setActing(true);
    setError("");
    try {
      let message = "";
      for (const record of selected) {
        const res = await fetch("/api/kiosk/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: record.token, mode }),
        });
        const json = (await res.json()) as {
          msg?: string;
          data?: { message?: string };
        };
        if (!res.ok) {
          setError(json.msg || "操作失敗");
          return;
        }
        message = json.data?.message || message;
      }
      setDoneMessage(message);
      setDoneMode(mode);
    } catch {
      setError("操作失敗");
    } finally {
      setActing(false);
    }
  };

  if (doneMode) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-3xl bg-white p-10 shadow-xl">
        <h2 className="text-3xl font-bold text-emerald-700">
          {DONE_TITLE[doneMode]}
        </h2>
        <p className="mt-3 text-center text-lg text-slate-600">{doneMessage}</p>
        <button
          type="button"
          className="mt-8 min-h-16 rounded-xl bg-slate-800 px-8 text-xl font-semibold text-white active:bg-slate-700"
          aria-label="返回首頁"
          onClick={onHome}
        >
          返回首頁
        </button>
        <IdleCountdown seconds={idleSeconds} onComplete={onHome} />
      </div>
    );
  }

  if (error && records.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-3xl bg-white p-10 shadow-xl">
        <h2 className="text-3xl font-bold text-slate-900">無法簽退</h2>
        <p className="mt-4 text-center text-xl text-slate-700" role="alert">
          {error}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="min-h-16 rounded-xl border border-slate-300 px-6 text-lg font-semibold text-slate-700 active:bg-slate-50"
            aria-label="再試一次"
            onClick={handleResetQuery}
          >
            再試一次
          </button>
          <button
            type="button"
            className="min-h-16 rounded-xl border border-slate-300 px-6 text-lg font-semibold text-slate-700 active:bg-slate-50"
            aria-label="返回首頁"
            onClick={onHome}
          >
            返回首頁
          </button>
        </div>
        <IdleCountdown seconds={idleSeconds} onComplete={onHome} />
      </div>
    );
  }

  const actionDisabled = acting || selected.length === 0;

  return (
    <FlowCard title="訪客簽退" onBack={onHome}>
      {records.length === 0 ? (
        <>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-600">
              預約密碼或手機號碼
            </span>
            <input
              className="min-h-16 w-full rounded-xl border border-slate-300 px-4 text-center text-3xl tracking-[0.35em] text-slate-900 placeholder:text-slate-400"
              value={code}
              readOnly
              inputMode="none"
              placeholder="請用下方鍵盤輸入"
              aria-label="預約密碼或手機號碼"
            />
          </label>

          <NumericKeypad
            disabled={loading}
            onDigit={(digit) =>
              setCode((prev) => `${prev}${digit}`.slice(0, 16))
            }
            onBackspace={() => setCode((prev) => prev.slice(0, -1))}
            onClear={() => setCode("")}
          />

          <button
            type="button"
            className="mt-6 min-h-16 w-full rounded-2xl bg-amber-600 text-xl font-bold text-white active:bg-amber-700 disabled:bg-slate-300"
            aria-label="查詢在廠記錄"
            disabled={!canQuery || loading}
            onClick={() => void handleLookup(code.trim())}
          >
            {loading ? "查詢中…" : "查詢"}
          </button>
        </>
      ) : (
        <>
          <p className="mb-3 text-lg text-slate-600">
            {records.length > 1
              ? "找到多位在廠訪客（共乘請勾選要處理的人）"
              : "請確認訪客資料後選擇操作"}
          </p>

          <ul className="space-y-3" role="list">
            {records.map((item) => {
              const checked = selectedTokens.includes(item.token);
              return (
                <li key={item.token}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={`選擇訪客 ${item.visitorName}`}
                    className={`min-h-20 w-full rounded-xl border px-4 py-4 text-left transition active:scale-[0.99] ${
                      checked
                        ? "border-amber-500 bg-amber-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                    onClick={() => handleToggle(item.token)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          {item.visitorName}
                        </div>
                        <div className="mt-1 text-base text-slate-600">
                          電話：{item.phoneNo || "—"}
                        </div>
                        {item.plateNo ? (
                          <div className="mt-1 text-base text-slate-600">
                            車牌：{item.plateNo}
                          </div>
                        ) : null}
                        {item.receptionistName ? (
                          <div className="mt-1 text-base text-slate-600">
                            被訪人：{item.receptionistName}
                          </div>
                        ) : null}
                        <div className="mt-1 text-sm text-slate-500">
                          {item.visitStartTime || item.visitEndTime
                            ? formatDateTimeRange(
                                item.visitStartTime,
                                item.visitEndTime,
                              )
                            : item.visitingTime || "—"}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                          item.presence === "temp_out"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {item.presence === "temp_out" ? "臨時外出" : "在場"}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {error ? (
            <p className="mt-4 text-lg text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              className="min-h-14 w-full rounded-xl border border-slate-300 text-lg font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50"
              aria-label="重新查詢"
              disabled={acting}
              onClick={handleResetQuery}
            >
              重新查詢
            </button>

            {allOnSite || allTempOut ? (
              <div className="flex gap-3">
                {allOnSite ? (
                  <button
                    type="button"
                    className="min-h-16 flex-1 rounded-xl border-2 border-orange-500 bg-white text-xl font-bold text-orange-700 active:bg-orange-50 disabled:bg-slate-100 disabled:text-slate-400"
                    aria-label="臨時外出"
                    disabled={actionDisabled}
                    onClick={() => void handleAction("temp")}
                  >
                    {acting ? "處理中…" : "臨時外出"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="min-h-16 flex-1 rounded-xl border-2 border-emerald-600 bg-white text-xl font-bold text-emerald-700 active:bg-emerald-50 disabled:bg-slate-100 disabled:text-slate-400"
                    aria-label="確認返回"
                    disabled={actionDisabled}
                    onClick={() => void handleAction("return")}
                  >
                    {acting ? "處理中…" : "確認返回"}
                  </button>
                )}
                <button
                  type="button"
                  className="min-h-16 flex-1 rounded-xl bg-amber-600 text-xl font-bold text-white active:bg-amber-700 disabled:bg-slate-300"
                  aria-label="正式簽退"
                  disabled={actionDisabled}
                  onClick={() => void handleAction("final")}
                >
                  {acting ? "處理中…" : "正式簽退"}
                </button>
              </div>
            ) : selected.length > 0 ? (
              <p className="text-center text-base text-amber-700" role="status">
                請分開處理「在場」與「臨時外出」的訪客
              </p>
            ) : null}
          </div>
        </>
      )}
    </FlowCard>
  );
};
