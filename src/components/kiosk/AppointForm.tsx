"use client";

import { useCallback, useMemo, useState } from "react";
import { FlowCard } from "@/components/kiosk/FlowCard";
import { IdleCountdown } from "@/components/kiosk/IdleCountdown";
import {
  HostPicker,
  type HostPerson,
} from "@/components/kiosk/HostPicker";
import { isValidEmail } from "@/lib/kiosk/visitor-fields";
import { VISIT_REASON_OPTIONS } from "@/lib/kiosk/visit-reason";

type AppointFormProps = {
  idleSeconds: number;
  onHome: () => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

const toLocalDateTimeValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const defaultDateTimes = () => {
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  const end = new Date();
  end.setHours(18, 0, 0, 0);
  return {
    start: toLocalDateTimeValue(start),
    end: toLocalDateTimeValue(end),
  };
};

/** datetime-local（假設現場為台北時區）→ ISO 8601 +08:00 */
const toTaipeiIsoFromLocal = (value: string): string => {
  if (!value) return "";
  const normalized = value.length === 16 ? `${value}:00` : value;
  return `${normalized}+08:00`;
};

export const AppointForm = ({ idleSeconds, onHome }: AppointFormProps) => {
  const defaults = useMemo(() => defaultDateTimes(), []);
  const [visitorName, setVisitorName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [reasonType, setReasonType] = useState(0);
  const [startAt, setStartAt] = useState(defaults.start);
  const [endAt, setEndAt] = useState(defaults.end);
  const [selectedHost, setSelectedHost] = useState<HostPerson | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [waitingMessage, setWaitingMessage] = useState("");

  const handleHostError = useCallback((message: string) => {
    setError(message);
  }, []);

  const handleSelectHost = useCallback((host: HostPerson | null) => {
    setSelectedHost(host);
  }, []);

  const phoneDigits = phone.replace(/\D/g, "");
  const emailTrimmed = email.trim();
  const canSubmit = Boolean(
    visitorName.trim() &&
      isValidEmail(emailTrimmed) &&
      phoneDigits.length >= 8 &&
      selectedHost &&
      startAt &&
      endAt &&
      startAt < endAt,
  );

  const handleSubmit = async () => {
    if (!selectedHost) return;
    if (!canSubmit) {
      if (!isValidEmail(emailTrimmed)) {
        setError("請填寫正確的 Email");
        return;
      }
      setError(
        startAt && endAt && startAt >= endAt
          ? "結束時間須晚於開始時間"
          : "請完整填寫預約資料",
      );
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/kiosk/appoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receptionistId: selectedHost.personId,
          appointStartTime: toTaipeiIsoFromLocal(startAt),
          appointEndTime: toTaipeiIsoFromLocal(endAt),
          visitReasonType: reasonType,
          visitorName: visitorName.trim(),
          companyName: company.trim(),
          phoneNo: phoneDigits,
          email: emailTrimmed,
          gender: 0,
        }),
      });
      const json = (await res.json()) as {
        msg?: string;
        data?: { waitingMessage?: string };
      };
      if (!res.ok) {
        setError(json.msg || "送出預約失敗");
        return;
      }
      setWaitingMessage(
        json.data?.waitingMessage ||
          "預約已送出，請等待內部確認。確認完成後將由系統提供預約密碼，再使用訪客報到。",
      );
    } catch {
      setError("送出預約失敗");
    } finally {
      setSubmitting(false);
    }
  };

  if (waitingMessage) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-3xl bg-white p-10 shadow-xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
          審核中
        </p>
        <h2 className="text-3xl font-bold text-slate-900">等待內部確認</h2>
        <p className="mt-4 text-center text-xl leading-8 text-slate-700">
          {waitingMessage}
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

  return (
    <FlowCard title="訪客預約" onBack={onHome}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            姓名 <span className="text-red-600">*</span>
          </span>
          <input
            className="min-h-16 w-full rounded-xl border border-slate-300 px-4 text-xl"
            value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)}
            autoComplete="name"
            enterKeyHint="next"
            aria-label="訪客姓名"
            aria-required="true"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            Email <span className="text-red-600">*</span>
          </span>
          <input
            type="email"
            className="min-h-16 w-full rounded-xl border border-slate-300 px-4 text-xl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            enterKeyHint="next"
            inputMode="email"
            placeholder="name@example.com"
            aria-label="Email"
            aria-required="true"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            公司
          </span>
          <input
            className="min-h-16 w-full rounded-xl border border-slate-300 px-4 text-xl"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
            enterKeyHint="next"
            aria-label="公司名稱"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            手機號碼 <span className="text-red-600">*</span>
          </span>
          <input
            className="min-h-16 w-full rounded-xl border border-slate-300 px-4 text-xl"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+\-\s]/g, ""))}
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            maxLength={20}
            placeholder="0912-345-678"
            aria-label="手機號碼"
            aria-required="true"
          />
        </label>
        <div className="block sm:col-span-2">
          <HostPicker
            selectedHost={selectedHost}
            onSelect={handleSelectHost}
            onError={handleHostError}
          />
        </div>
        <div className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-medium text-slate-600">
            來訪事由
          </span>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-5"
            role="radiogroup"
            aria-label="來訪事由"
          >
            {VISIT_REASON_OPTIONS.map((opt) => {
              const selected = reasonType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`min-h-14 rounded-xl border px-3 text-lg font-semibold active:scale-[0.98] ${
                    selected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 bg-white text-slate-800"
                  }`}
                  onClick={() => setReasonType(opt.value)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            開始（日期時間）
          </span>
          <input
            type="datetime-local"
            className="min-h-16 w-full rounded-xl border border-slate-300 px-4 text-lg"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            aria-label="開始日期時間"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            結束（日期時間）
          </span>
          <input
            type="datetime-local"
            className="min-h-16 w-full rounded-xl border border-slate-300 px-4 text-lg"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            aria-label="結束日期時間"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 text-lg text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className={`mt-6 min-h-16 w-full rounded-2xl text-xl font-bold ${
          !canSubmit || submitting
            ? "cursor-not-allowed bg-slate-300 text-slate-500"
            : "bg-blue-600 text-white active:bg-blue-700"
        }`}
        aria-label="送出預約"
        disabled={!canSubmit || submitting}
        onClick={() => void handleSubmit()}
      >
        {submitting ? "送出中…" : "送出預約"}
      </button>
    </FlowCard>
  );
};
