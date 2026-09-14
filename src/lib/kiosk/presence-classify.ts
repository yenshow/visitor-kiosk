import type { VisitorVisit } from "@/lib/kiosk/presence";
import type { FlatRegisterRecord } from "@/lib/kiosk/register-record";

export type ActivePresenceBucket = "on_site" | "temp_out" | "overstay";

export const isVisitPastEnd = (
  visitEndTime: string,
  nowMs = Date.now(),
): boolean => {
  const endMs = Date.parse(String(visitEndTime ?? "").trim());
  if (!Number.isFinite(endMs)) return false;
  return endMs < nowMs;
};

export const effectiveVisitEndTime = (
  flat: Pick<FlatRegisterRecord, "visitEndTime">,
  visit?: VisitorVisit,
): string =>
  String(visit?.visitEndTime ?? "").trim() ||
  String(flat.visitEndTime ?? "").trim();

/** 在場／外出／逾期分類（不含 departed） */
export const classifyActivePresence = (input: {
  visit?: VisitorVisit;
  flat: FlatRegisterRecord;
  /** 是否出現在本次 YSCP 在廠查詢結果 */
  inYscpRegisterList: boolean;
}): ActivePresenceBucket | null => {
  const status = input.visit?.status;
  if (status === "departed") return null;

  const endTime = effectiveVisitEndTime(input.flat, input.visit);
  if (isVisitPastEnd(endTime)) return "overstay";

  // 僅本機殘留、又無可靠截止時間 → 視為殭屍在場
  const localActive =
    !input.inYscpRegisterList &&
    (status === "on_site" || status === "temp_out");
  if (localActive && !Number.isFinite(Date.parse(endTime))) {
    return "overstay";
  }

  if (status === "temp_out") return "temp_out";
  return "on_site";
};
