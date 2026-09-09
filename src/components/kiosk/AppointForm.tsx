"use client";

import { useState } from "react";
import { FlowCard } from "@/components/kiosk/FlowCard";
import { IdleCountdown } from "@/components/kiosk/IdleCountdown";
import { HostPicker, type HostPerson } from "@/components/kiosk/HostPicker";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import { isValidEmail } from "@/lib/kiosk/visitor-fields";
import { VISIT_REASON_OPTIONS } from "@/lib/kiosk/visit-reason";

type AppointFormProps = {
  idleSeconds: number;
  onHome: () => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** 現場日 YYYY-MM-DD（以裝置本地日為準；機台應設台北時區） */
const todayDateKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const todayLabel = () => {
  const d = new Date();
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
};

const defaultTimes = () => ({ start: "09:00", end: "18:00" });

const FIELD_CLASS =
  "min-h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

/** 當日 HH:mm → ISO 8601 +08:00（僅限當日、不可跨日） */
const toTaipeiIsoFromTodayTime = (time: string): string => {
  const trimmed = String(time ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return "";
  return `${todayDateKey()}T${trimmed}:00+08:00`;
};

export const AppointForm = ({ idleSeconds, onHome }: AppointFormProps) => {
  const [familyName, setFamilyName] = useState("");
  const [givenName, setGivenName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [reasonType, setReasonType] = useState(0);
  const [startAt, setStartAt] = useState(() => defaultTimes().start);
  const [endAt, setEndAt] = useState(() => defaultTimes().end);
  const [selectedHost, setSelectedHost] = useState<HostPerson | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [waitingMessage, setWaitingMessage] = useState("");

  const phoneDigits = phone.replace(/\D/g, "");
  const emailTrimmed = email.trim();
  const familyNameTrimmed = familyName.trim();
  const givenNameTrimmed = givenName.trim();
  const canSubmit = Boolean(
    (familyNameTrimmed || givenNameTrimmed) &&
    isValidEmail(emailTrimmed) &&
    phoneDigits.length >= 8 &&
    phoneDigits.length <= 15 &&
    selectedHost &&
    startAt &&
    endAt &&
    startAt < endAt,
  );

  const handleSubmit = async () => {
    if (!canSubmit || !selectedHost) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/kiosk/appoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receptionistId: selectedHost.personId,
          appointStartTime: toTaipeiIsoFromTodayTime(startAt),
          appointEndTime: toTaipeiIsoFromTodayTime(endAt),
          visitReasonType: reasonType,
          visitorFamilyName: familyNameTrimmed,
          visitorGivenName: givenNameTrimmed,
          companyName: company.trim(),
          phoneNo: phoneDigits,
          email: emailTrimmed,
          gender: 0,
          plateNo: normalizePlateNo(plateNo) || undefined,
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            姓
          </span>
          <input
            className={FIELD_CLASS}
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            autoComplete="family-name"
            enterKeyHint="next"
            aria-label="訪客姓"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            名
          </span>
          <input
            className={FIELD_CLASS}
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
            autoComplete="given-name"
            enterKeyHint="next"
            aria-label="訪客名"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            Email <span className="text-red-600">*</span>
          </span>
          <input
            type="email"
            className={FIELD_CLASS}
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
            className={FIELD_CLASS}
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
            className={FIELD_CLASS}
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value.replace(/[^\d+\-\s]/g, ""))
            }
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            maxLength={20}
            placeholder="0912345678"
            aria-label="手機號碼"
            aria-required="true"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            車牌
          </span>
          <input
            className={`${FIELD_CLASS} uppercase tracking-wide`}
            value={plateNo}
            onChange={(e) =>
              setPlateNo(
                e.target.value.replace(/[^a-zA-Z0-9\-]/g, "").toUpperCase(),
              )
            }
            autoComplete="off"
            enterKeyHint="next"
            maxLength={12}
            placeholder="ABC1234"
            aria-label="車牌號碼"
          />
        </label>
        <div className="block sm:col-span-2">
          <HostPicker
            selectedHost={selectedHost}
            onSelect={setSelectedHost}
            onError={setError}
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
                  className={`min-h-12 rounded-xl border px-3 text-lg font-semibold active:scale-[0.98] ${
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
            開始時間
          </span>
          <input
            type="time"
            className={`${FIELD_CLASS} text-lg`}
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            aria-label="開始時間（僅限當日）"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">
            結束時間
          </span>
          <input
            type="time"
            className={`${FIELD_CLASS} text-lg`}
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            aria-label="結束時間（僅限當日）"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-3 text-lg text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className={`mt-4 min-h-14 w-full rounded-2xl text-xl font-bold ${
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
