"use client";

import { useMemo, useState } from "react";
import { FlowCard, FlowResult } from "@/components/kiosk/FlowCard";
import { CodeQueryForm } from "@/components/kiosk/NumericKeypad";
import { VisitorNoticeDialog } from "@/components/kiosk/VisitorNoticeDialog";
import { VisitorSelectList } from "@/components/kiosk/VisitorSelectCard";
import {
  taipeiDateKeyFromIso,
  toTaipeiDateKey,
} from "@/lib/kiosk/api-helpers";
import { formatDateTimeRange } from "@/lib/kiosk/format";
import { isConstructionVisit } from "@/lib/kiosk/visit-reason";
import {
  postCheckoutModes,
  toggleSelectedToken,
  type OnSiteRecordView,
} from "@/lib/kiosk/visitor-query";

type AppointmentView = {
  token: string;
  appointStartTime: string;
  appointEndTime: string;
  receptionistName: string;
  visitorName: string;
  phoneNo?: string;
  companyName: string;
  plateNo?: string;
  visitReason?: string;
  visitReasonType?: number;
};

type CheckinFlowProps = {
  idleSeconds: number;
  onHome: () => void;
  onGoAppoint?: () => void;
};

type DoneMode = "checkin" | "return";

/** 臨時外出非當日（跨日）返回須再同意須知；缺時間則保守要求同意 */
const needsOvernightNotice = (records: OnSiteRecordView[]): boolean => {
  const today = toTaipeiDateKey();
  return records.some((item) => {
    const at = String(item.tempOutAt ?? "").trim();
    if (!at) return true;
    const day = taipeiDateKeyFromIso(at);
    return !day || day !== today;
  });
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
  const [tempOutRecords, setTempOutRecords] = useState<OnSiteRecordView[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeKind, setNoticeKind] = useState<"checkin" | "return">("checkin");
  const [acting, setActing] = useState(false);
  const [doneMode, setDoneMode] = useState<DoneMode | null>(null);
  const [doneMessage, setDoneMessage] = useState("");

  const selectedTempOut = useMemo(
    () => tempOutRecords.filter((item) => selectedTokens.includes(item.token)),
    [tempOutRecords, selectedTokens],
  );
  const returnNeedsNotice = useMemo(
    () => needsOvernightNotice(selectedTempOut),
    [selectedTempOut],
  );

  const handleResetQuery = () => {
    setError("");
    setAppointments([]);
    setSelected(null);
    setTempOutRecords([]);
    setSelectedTokens([]);
    setNoticeOpen(false);
  };

  const handleVerify = async () => {
    setLoading(true);
    setError("");
    setAppointments([]);
    setSelected(null);
    setTempOutRecords([]);
    setSelectedTokens([]);
    try {
      const res = await fetch("/api/kiosk/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: code.trim() }),
      });
      const json = (await res.json()) as {
        msg?: string;
        data?: {
          appointments?: AppointmentView[];
          tempOutRecords?: OnSiteRecordView[];
        };
      };
      if (!res.ok) {
        setError(json.msg || "查詢失敗");
        return;
      }
      const returning = json.data?.tempOutRecords ?? [];
      if (returning.length > 0) {
        setTempOutRecords(returning);
        setSelectedTokens(returning.length === 1 ? [returning[0].token] : []);
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

  const handleReturn = async () => {
    if (selectedTempOut.length === 0) {
      setError("請選擇至少一位訪客");
      return;
    }

    setActing(true);
    setError("");
    try {
      const result = await postCheckoutModes(
        selectedTempOut.map((item) => item.token),
        "return",
      );
      setNoticeOpen(false);
      setDoneMessage(result.message || "已確認返回，狀態恢復為在場。");
      setDoneMode("return");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
      setNoticeOpen(false);
    } finally {
      setActing(false);
    }
  };

  const handleReturnClick = () => {
    if (selectedTempOut.length === 0) {
      setError("請選擇至少一位訪客");
      return;
    }
    if (returnNeedsNotice) {
      setNoticeKind("return");
      setNoticeOpen(true);
      return;
    }
    void handleReturn();
  };

  const handleCheckin = async () => {
    if (!selected) return;
    setActing(true);
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
      setDoneMode("checkin");
    } catch {
      setError("報到失敗");
      setNoticeOpen(false);
    } finally {
      setActing(false);
    }
  };

  if (doneMode) {
    return (
      <FlowResult title={doneMode === "return" ? "已確認返回" : "報到成功"} idleSeconds={idleSeconds} onHome={onHome}>
        {doneMode === "return" ? (
          <p className="text-lg text-slate-600">{doneMessage}</p>
        ) : (
          <>
            <p className="text-xl leading-8">請稍候，內部人員將前來帶領您入內。</p>
            <p className="mt-2 text-base text-slate-500">感謝您的耐心等候</p>
          </>
        )}
      </FlowResult>
    );
  }

  if (error && appointments.length === 0 && !selected && tempOutRecords.length === 0) {
    const isNotFound = error.includes("查無");
    return (
      <FlowResult
        title="無法報到"
        tone="error"
        idleSeconds={idleSeconds}
        onHome={onHome}
        onRetry={handleResetQuery}
        extraActions={
          isNotFound && onGoAppoint ? (
            <button
              type="button"
              className="min-h-16 rounded-xl bg-blue-600 px-6 text-lg font-semibold text-white active:bg-blue-700"
              aria-label="改走訪客預約"
              onClick={onGoAppoint}
            >
              訪客預約
            </button>
          ) : null
        }
      >
        <p className="text-xl" role="alert">
          {error}
        </p>
      </FlowResult>
    );
  }

  if (tempOutRecords.length > 0) {
    return (
      <FlowCard title="訪客報到" onBack={onHome}>
        <p className="mb-3 text-lg text-slate-600">
          {tempOutRecords.length > 1
            ? "找到多位臨時外出訪客（共乘請勾選要返回的人）"
            : "您目前為臨時外出，請確認資料後返回"}
        </p>
        {returnNeedsNotice && selectedTempOut.length > 0 ? (
          <p className="mb-3 text-base text-amber-800" role="status">
            跨日返回須再次閱讀並同意訪客須知
          </p>
        ) : null}

        <VisitorSelectList
          items={tempOutRecords}
          selectedTokens={selectedTokens}
          onToggle={(token) =>
            setSelectedTokens((prev) => toggleSelectedToken(prev, token))
          }
        />

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
          <button
            type="button"
            className="min-h-16 w-full rounded-xl border-2 border-emerald-600 bg-white text-xl font-bold text-emerald-700 active:bg-emerald-50 disabled:bg-slate-100 disabled:text-slate-400"
            aria-label={returnNeedsNotice ? "確認返回並同意須知" : "確認返回"}
            disabled={acting || selectedTempOut.length === 0}
            onClick={handleReturnClick}
          >
            {acting
              ? "處理中…"
              : returnNeedsNotice
                ? "確認返回（需同意須知）"
                : "確認返回"}
          </button>
        </div>

        {noticeOpen && noticeKind === "return" ? (
          <VisitorNoticeDialog
            confirmLabel="同意並確認返回"
            loading={acting}
            showVideo={selectedTempOut.some((item) =>
              isConstructionVisit(item.visitReasonType, item.visitReason),
            )}
            onCancel={() => setNoticeOpen(false)}
            onConfirm={() => void handleReturn()}
          />
        ) : null}
      </FlowCard>
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
                    {item.plateNo ? (
                      <div className="mt-1 text-base text-slate-600">
                        車牌：{item.plateNo}
                      </div>
                    ) : null}
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
              onClick={handleResetQuery}
            >
              重新輸入
            </button>
          </>
        ) : (
          <CodeQueryForm
            code={code}
            loading={loading}
            submitLabel="查詢預約"
            submitClassName="bg-blue-600 active:bg-blue-700"
            ariaLabel="查詢預約"
            onCodeChange={setCode}
            onSubmit={() => void handleVerify()}
          />
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
            {selected.plateNo ? (
              <p>
                <span className="text-slate-500">車牌：</span>
                {selected.plateNo}
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
              onClick={handleResetQuery}
            >
              重新查詢
            </button>
            <button
              type="button"
              className="min-h-16 flex-1 rounded-xl bg-blue-600 text-xl font-bold text-white active:bg-blue-700"
              aria-label="確認報到"
              onClick={() => {
                setNoticeKind("checkin");
                setNoticeOpen(true);
              }}
            >
              確認報到
            </button>
          </div>
        </>
      )}

      {noticeOpen && noticeKind === "checkin" ? (
        <VisitorNoticeDialog
          confirmLabel="同意並報到"
          loading={acting}
          showVideo={isConstructionVisit(
            selected?.visitReasonType,
            selected?.visitReason,
          )}
          onCancel={() => setNoticeOpen(false)}
          onConfirm={() => void handleCheckin()}
        />
      ) : null}
    </FlowCard>
  );
};
