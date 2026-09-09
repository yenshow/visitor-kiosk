"use client";

import { useMemo, useState } from "react";
import { FlowCard, FlowResult } from "@/components/kiosk/FlowCard";
import { CodeQueryForm } from "@/components/kiosk/NumericKeypad";
import { VisitorSelectList } from "@/components/kiosk/VisitorSelectCard";
import {
  postCheckoutModes,
  toggleSelectedToken,
  type OnSiteRecordView,
} from "@/lib/kiosk/visitor-query";

type CheckoutMode = "temp" | "final";

type CheckoutFlowProps = {
  idleSeconds: number;
  onHome: () => void;
};

const DONE_TITLE: Record<CheckoutMode, string> = {
  temp: "已登記臨時外出",
  final: "正式簽退成功",
};

export const CheckoutFlow = ({ idleSeconds, onHome }: CheckoutFlowProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<OnSiteRecordView[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [acting, setActing] = useState(false);
  const [doneMode, setDoneMode] = useState<CheckoutMode | null>(null);
  const [doneMessage, setDoneMessage] = useState("");

  const selected = useMemo(
    () => records.filter((item) => selectedTokens.includes(item.token)),
    [records, selectedTokens],
  );
  const allOnSite =
    selected.length > 0 &&
    selected.every((item) => item.presence === "on_site");
  const hasTempOut = records.some((item) => item.presence === "temp_out");

  const handleResetQuery = () => {
    setError("");
    setRecords([]);
    setSelectedTokens([]);
  };

  const handleLookup = async () => {
    setLoading(true);
    setError("");
    setRecords([]);
    setSelectedTokens([]);
    try {
      const res = await fetch("/api/kiosk/checkout/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: code.trim() }),
      });
      const json = (await res.json()) as {
        msg?: string;
        data?: { records?: OnSiteRecordView[] };
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
      setRecords(list);
      setSelectedTokens(list.length === 1 ? [list[0].token] : []);
    } catch {
      setError("查詢失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (mode: CheckoutMode) => {
    if (selected.length === 0) {
      setError("請選擇至少一位訪客");
      return;
    }

    setActing(true);
    setError("");
    try {
      const result = await postCheckoutModes(
        selected.map((item) => item.token),
        mode,
      );
      setDoneMessage(result.message);
      setDoneMode(mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setActing(false);
    }
  };

  if (doneMode) {
    return (
      <FlowResult title={DONE_TITLE[doneMode]} idleSeconds={idleSeconds} onHome={onHome}>
        <p className="text-lg text-slate-600">{doneMessage}</p>
      </FlowResult>
    );
  }

  if (error && records.length === 0) {
    return (
      <FlowResult
        title="無法簽退"
        tone="error"
        idleSeconds={idleSeconds}
        onHome={onHome}
        onRetry={handleResetQuery}
      >
        <p className="text-xl" role="alert">
          {error}
        </p>
      </FlowResult>
    );
  }

  const actionDisabled = acting || selected.length === 0;

  return (
    <FlowCard title="訪客簽退" onBack={onHome}>
      {records.length === 0 ? (
        <CodeQueryForm
          code={code}
          loading={loading}
          submitLabel="查詢"
          submitClassName="bg-amber-600 active:bg-amber-700"
          ariaLabel="查詢在廠記錄"
          onCodeChange={setCode}
          onSubmit={() => void handleLookup()}
        />
      ) : (
        <>
          <p className="mb-3 text-lg text-slate-600">
            {records.length > 1
              ? "找到多位在廠訪客（共乘請勾選要處理的人）"
              : "請確認訪客資料後選擇操作"}
          </p>

          <VisitorSelectList
            items={records}
            selectedTokens={selectedTokens}
            onToggle={(token) =>
              setSelectedTokens((prev) => toggleSelectedToken(prev, token))
            }
          />

          {error ? (
            <p className="mt-4 text-lg text-red-600" role="alert">
              {error}
            </p>
          ) : hasTempOut ? (
            <p className="mt-4 text-center text-base text-slate-500" role="status">
              臨時外出返回請至「訪客報到」
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
              ) : null}
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
          </div>
        </>
      )}
    </FlowCard>
  );
};
