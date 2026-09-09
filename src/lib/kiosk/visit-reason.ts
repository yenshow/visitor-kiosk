/** YSCP visitReasonType → Kiosk 顯示名稱 */
export const VISIT_REASON_OPTIONS = [
  { value: 0, label: "商務" },
  { value: 1, label: "培訓" },
  { value: 2, label: "來訪" },
  { value: 3, label: "會議" },
  { value: 4, label: "施工" },
] as const;

const LABEL_BY_TYPE: Record<number, string> = Object.fromEntries(
  VISIT_REASON_OPTIONS.map((o) => [o.value, o.label]),
);

export const visitReasonLabel = (
  type?: number | string | null,
  detail?: string | null,
  fallbackName?: string | null,
): string => {
  const n = Number(type);
  if (Number.isFinite(n) && LABEL_BY_TYPE[n]) return LABEL_BY_TYPE[n];
  return (
    String(fallbackName ?? "").trim() ||
    String(detail ?? "").trim() ||
    "—"
  );
};
