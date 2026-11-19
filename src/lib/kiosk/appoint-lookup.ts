import {
  findAppointmentsByQuery,
  matchesAppointmentQuery,
} from "@/lib/kiosk/appointments";
import { normalizePhoneDigits, normalizePlateNo } from "@/lib/kiosk/normalize";
import type { AppointmentItem } from "@/lib/kiosk/visitor";

export { findAppointmentsByQuery, matchesAppointmentQuery };

/** 是否為待報到（0＝已核准待簽到） */
export const isPendingCheckin = (status: unknown): boolean =>
  String(status ?? "0") === "0";

export const appointmentStatusMessage = (status: unknown): string => {
  const s = String(status ?? "");
  if (s === "1") return "預約審核中，請等待內部確認後再報到";
  if (s === "2") return "預約未通過審核，請重新預約或洽接待人員";
  if (s === "3" || s === "4") {
    return "此預約已報到或已結束，如需再次來訪請重新預約";
  }
  return "預約尚未核准或已使用，請等待內部確認或重新預約";
};

/** 查詢階段正規化欄位（不寫本機；寫入僅在報到成功） */
export const withCompleteVisitorInfo = (
  item: AppointmentItem,
  fallbackPhone = "",
): AppointmentItem => {
  const info = item.visitorInfo ?? {};
  return {
    ...item,
    visitorInfo: {
      ...info,
      phoneNo:
        normalizePhoneDigits(info.phoneNo ?? "") ||
        normalizePhoneDigits(fallbackPhone) ||
        "",
      companyName: String(info.companyName ?? "").trim(),
      plateNo: normalizePlateNo(info.plateNo),
    },
  };
};
