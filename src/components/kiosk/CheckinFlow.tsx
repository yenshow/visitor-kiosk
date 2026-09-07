"use client";

import { useMemo, useState } from "react";
import { FlowCard } from "@/components/kiosk/FlowCard";
import { IdleCountdown } from "@/components/kiosk/IdleCountdown";
import { NumericKeypad } from "@/components/kiosk/NumericKeypad";
import { VisitorNoticeDialog } from "@/components/kiosk/VisitorNoticeDialog";
import { formatDateTimeRange } from "@/lib/kiosk/format";

type AppointmentView = {
  token: string;
  appointStartTime: string;
  appointEndTime: string;
  receptionistName: string;
  visitorName: string;
  phoneNo?: string;
  companyName: string;
  visitReason?: string;
};

type CheckinFlowProps = {
  idleSeconds: number;
  onHome: () => void;
  onGoAppoint: () => void;
};

export const CheckinFlow = ({
  idleSeconds,
  onHome,
  onGoAppoint,
}: CheckinFlowProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [appointments, setAppointments] = useState<AppointmentView[]>([]);
  const [selected, setSelected] = useState<AppointmentView | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [done, setDone] = useState(false);

  const canQuery = useMemo(() => code.trim().length > 0, [code]);

  const handleVerify = async () => {
    setLoading(true);
    setError("");
    setAppointments([]);
    setSelected(null);
    try {
      const res = await fetch("/api/kiosk/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: code.trim() }),
      });
      const json = (await res.json()) as {
        msg?: string;
        data?: { appointments?: AppointmentView[] };
      };
      if (!res.ok) {
        setError(json.msg || "查詢失敗");
        return;
      }
      const list = json.data?.appointments ?? [];
      setAppointments(list);
      if (list.length === 1) setSelected(list[0]);
    } catch {
      setError("查詢失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!selected) return;
    setCheckingIn(true);
    setError("");
    try {
      const res = await fetch("/api/kiosk/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptedNotice: true,
          token: selected.token,
        }),
      });
      const json = (await res.json()) as { msg?: string };
      if (!res.ok) {
        setError(json.msg || "報到失敗");
        setNoticeOpen(false);
        return;
      }
      setNoticeOpen(false);
      setDone(true);
    } catch {
      setError("報到失敗");
      setNoticeOpen(false);
    } finally {
      setCheckingIn(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-3xl bg-white p-10 shadow-xl">
        <h2 className="text-3xl font-bold text-emerald-700">報到成功</h2>
        <p className="mt-6 text-center text-xl leading-8 text-slate-700">
          請稍候，內部人員將前來帶領您入內。
        </p>
        <p className="mt-2 text-center text-base text-slate-500">
          感謝您的耐心等候
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

  if (error && appointments.length === 0 && !selected) {
    const isNotFound = error.includes("查無");
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-3xl bg-white p-10 shadow-xl">
        <h2 className="text-3xl font-bold text-slate-900">無法報到</h2>
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
              setAppointments([]);
              setSelected(null);
            }}
          >
            再試一次
          </button>
          {isNotFound ? (
            <button
              type="button"
              className="min-h-16 rounded-xl bg-blue-600 px-6 text-lg font-semibold text-white active:bg-blue-700"
              aria-label="改走訪客預約"
              onClick={onGoAppoint}
            >
              訪客預約
            </button>
          ) : null}
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
    <FlowCard title="訪客報到" onBack={onHome}>
      {!selected ? (
        appointments.length > 1 ? (
          <>
            <p className="mb-4 text-lg text-slate-600">
              找到多筆預約，請點選一筆繼續
            </p>
            <ul className="space-y-3">
              {appointments.map((item) => (
                <li key={item.token}>
                  <button
                    type="button"
                    className="min-h-20 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-slate-900 transition active:bg-slate-100"
                    aria-label={`選擇預約 ${item.visitorName}`}
                    onClick={() => setSelected(item)}
                  >
                    <div className="text-xl font-semibold">{item.visitorName}</div>
                    <div className="mt-1 text-base text-slate-600">
                      電話：{item.phoneNo || "—"}
                    </div>
                    <div className="mt-1 text-base text-slate-600">
                      事由：{item.visitReason || "—"}
                    </div>
                    <div className="mt-1 text-base text-slate-600">
                      被訪人：{item.receptionistName}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {formatDateTimeRange(
                        item.appointStartTime,
                        item.appointEndTime,
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-6 min-h-14 w-full rounded-xl border border-slate-300 text-lg font-semibold text-slate-700 active:bg-slate-50"
              aria-label="重新輸入"
              onClick={() => {
                setAppointments([]);
                setError("");
              }}
            >
              重新輸入
            </button>
          </>
        ) : (
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
              className="mt-6 min-h-16 w-full rounded-2xl bg-blue-600 text-xl font-bold text-white active:bg-blue-700 disabled:bg-slate-300"
              aria-label="查詢預約"
              disabled={!canQuery || loading}
              onClick={() => void handleVerify()}
            >
              {loading ? "查詢中…" : "查詢預約"}
            </button>
          </>
        )
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
            {selected.visitReason ? (
              <p>
                <span className="text-slate-500">事由：</span>
                {selected.visitReason}
              </p>
            ) : null}
            {selected.receptionistName ? (
              <p>
                <span className="text-slate-500">被訪人：</span>
                {selected.receptionistName}
              </p>
            ) : null}
            <p>
              <span className="text-slate-500">時段：</span>
              {formatDateTimeRange(
                selected.appointStartTime,
                selected.appointEndTime,
              )}
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
              className="min-h-16 flex-1 rounded-xl border border-slate-300 text-xl font-semibold text-slate-700 active:bg-slate-50"
              aria-label="重新查詢"
              onClick={() => {
                setSelected(null);
                setAppointments([]);
                setError("");
              }}
            >
              重新查詢
            </button>
            <button
              type="button"
              className="min-h-16 flex-1 rounded-xl bg-blue-600 text-xl font-bold text-white active:bg-blue-700"
              aria-label="確認報到"
              onClick={() => setNoticeOpen(true)}
            >
              確認報到
            </button>
          </div>
        </>
      )}

      <VisitorNoticeDialog
        open={noticeOpen}
        confirmLabel="同意並報到"
        loading={checkingIn}
        onCancel={() => setNoticeOpen(false)}
        onConfirm={() => void handleCheckin()}
      />
    </FlowCard>
  );
};
