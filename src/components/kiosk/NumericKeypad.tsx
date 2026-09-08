"use client";

type NumericKeypadProps = {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  disabled?: boolean;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "清空", "0", "⌫"] as const;

export const NumericKeypad = ({
  onDigit,
  onBackspace,
  onClear,
  disabled = false,
}: NumericKeypadProps) => {
  const handlePress = (key: (typeof KEYS)[number]) => {
    if (disabled) return;
    if (key === "清空") {
      onClear();
      return;
    }
    if (key === "⌫") {
      onBackspace();
      return;
    }
    onDigit(key);
  };

  return (
    <div
      className="mt-4 grid grid-cols-3 gap-3"
      role="group"
      aria-label="數字鍵盤"
    >
      {KEYS.map((key) => {
        const isAction = key === "清空" || key === "⌫";
        return (
          <button
            key={key}
            type="button"
            className={`min-h-16 rounded-2xl text-2xl font-semibold active:scale-[0.98] disabled:opacity-40 ${
              isAction
                ? "border border-slate-300 bg-slate-100 text-slate-700"
                : "border border-slate-200 bg-white text-slate-900 shadow-sm"
            }`}
            aria-label={
              key === "清空" ? "清空" : key === "⌫" ? "刪除一字" : `輸入 ${key}`
            }
            disabled={disabled}
            onClick={() => handlePress(key)}
          >
            {key}
          </button>
        );
      })}
    </div>
  );
};

type CodeQueryFormProps = {
  code: string;
  loading: boolean;
  submitLabel: string;
  submitClassName: string;
  ariaLabel: string;
  onCodeChange: (next: string) => void;
  onSubmit: () => void;
};

export const CodeQueryForm = ({
  code,
  loading,
  submitLabel,
  submitClassName,
  ariaLabel,
  onCodeChange,
  onSubmit,
}: CodeQueryFormProps) => (
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
      onDigit={(digit) => onCodeChange(`${code}${digit}`.slice(0, 16))}
      onBackspace={() => onCodeChange(code.slice(0, -1))}
      onClear={() => onCodeChange("")}
    />

    <button
      type="button"
      className={`mt-6 min-h-16 w-full rounded-2xl text-xl font-bold text-white disabled:bg-slate-300 ${submitClassName}`}
      aria-label={ariaLabel}
      disabled={code.trim().length === 0 || loading}
      onClick={onSubmit}
    >
      {loading ? "查詢中…" : submitLabel}
    </button>
  </>
);
