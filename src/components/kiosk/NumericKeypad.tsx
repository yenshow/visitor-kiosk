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
