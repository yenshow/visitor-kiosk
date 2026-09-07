"use client";

import { useMemo, useState } from "react";
import { FlowCard } from "@/components/kiosk/FlowCard";
import { IdleCountdown } from "@/components/kiosk/IdleCountdown";
import { NumericKeypad } from "@/components/kiosk/NumericKeypad";
import { formatDateTimeRange } from "@/lib/kiosk/format";

type CheckoutRecordView = {
  token: string;
  visitorName: string;
  phoneNo: string;
  companyName: string;
  receptionistName: string;
  visitStartTime: string;
  visitEndTime: string;
  visitingTime?: string;
};

type CheckoutFlowProps = {
  idleSeconds: number;
  onHome: () => void;
};

export const CheckoutFlow = ({ idleSeconds, onHome }: CheckoutFlowProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<CheckoutRecordView | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [done, setDone] = useState(false);

  const canQuery = useMemo(() => code.trim().length > 0, [code]);

  const handleLookup = async (query: string) => {
    setLoading(true);
    setError("");
    setSelected(null);
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
      const list = json.data?.records ?? [];
      if (list.length === 0) {
        setError("查無在廠簽到記錄，請確認已報到或洽接待人員");
        return;
      }
      setSelected(list[0]);
    } catch {
      setError("查詢失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (record: CheckoutRecordView) => {
    setCheckingOut(true);
    setError("");
    try {
      const res = await fetch("/api/kiosk/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: record.token }),
      });
      const json = (await res.json()) as { msg?: string };
      if (!res.ok) {
        setError(json.msg || "簽退失敗");
        return;
      }
      setDone(true);
    } catch {
      setError("簽退失敗");
    } finally {
      setCheckingOut(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-3xl bg-white p-10 shadow-xl">
        <h2 className="text-3xl font-bold text-emerald-700">簽退成功</h2>
        <p className="mt-3 text-center text-lg text-slate-600">
          通行權限已撤銷，感謝您的來訪
        </p>
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

  if (error && !selected) {
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
            onClick={() => {
              setError("");
              setSelected(null);
            }}
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

  return (
    <FlowCard title="訪客簽退" onBack={onHome}>
      {!selected ? (
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
            {loading ? "查詢中…" : "查詢並簽退"}
          </button>
        </>
      ) : (
        <>
          <div className="space-y-4 rounded-2xl bg-slate-50 p-6 text-xl text-slate-800">
            <p>
              <span className="text-slate-500">訪客：</span>
              {selected.visitorName}
            </p>
            {selected.phoneNo ? (
              <p>
                <span className="text-slate-500">電話：</span>
                {selected.phoneNo}
              </p>
            ) : null}
            {selected.companyName ? (
              <p>
                <span className="text-slate-500">公司：</span>
                {selected.companyName}
              </p>
            ) : null}
            {selected.receptionistName ? (
              <p>
                <span className="text-slate-500">被訪人：</span>
                {selected.receptionistName}
              </p>
            ) : null}
            <p>
              <span className="text-slate-500">來訪時間：</span>
              {selected.visitStartTime || selected.visitEndTime
                ? formatDateTimeRange(
                    selected.visitStartTime,
                    selected.visitEndTime,
                  )
                : selected.visitingTime || "—"}
            </p>
          </div>

          {error ? (
            <p className="mt-4 text-lg text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              className="min-h-16 flex-1 rounded-xl border border-slate-300 text-xl font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50"
              aria-label="重新查詢"
              disabled={checkingOut}
              onClick={() => {
                setSelected(null);
                setError("");
              }}
            >
              重新查詢
            </button>
            <button
              type="button"
              className="min-h-16 flex-1 rounded-xl bg-amber-600 text-xl font-bold text-white active:bg-amber-700 disabled:bg-slate-300"
              aria-label="確認簽退"
              disabled={checkingOut}
              onClick={() => void handleCheckout(selected)}
            >
              {checkingOut ? "簽退中…" : "確認簽退"}
            </button>
          </div>
        </>
      )}
    </FlowCard>
  );
};
