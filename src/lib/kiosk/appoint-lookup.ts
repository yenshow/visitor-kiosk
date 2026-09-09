import {
  listAppointments,
  type AppointmentItem,
} from "@/lib/yscp/visitor-api";
import { getAppointQueryRangeTaipei } from "@/lib/kiosk/api-helpers";
import { normalizePhoneDigits } from "@/lib/kiosk/phone";
import { normalizePlateNo } from "@/lib/kiosk/plate";

const mergeByAppointId = (lists: AppointmentItem[][]): AppointmentItem[] => {
  const map = new Map<string, AppointmentItem>();
  for (const list of lists) {
    for (const item of list) {
      const id = String(item.appointID ?? "").trim();
      if (id) map.set(id, item);
    }
  }
  return [...map.values()];
};

/** 是否為待報到（YSCP：0＝待簽到） */
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

export const matchesAppointmentQuery = (
  item: AppointmentItem,
  input: { appointCode?: string; phoneNo?: string },
): boolean => {
  const code = String(item.appointCode ?? "").trim();
  const id = String(item.appointID ?? "").trim();
  const itemPhone = normalizePhoneDigits(item.visitorInfo?.phoneNo ?? "");
  const appointCode = String(input.appointCode ?? "").trim();
  const phoneNo = normalizePhoneDigits(input.phoneNo ?? "");

  if (phoneNo && itemPhone === phoneNo) return true;
  if (!appointCode) return false;
  if (code === appointCode || id === appointCode) return true;
  return appointCode.length >= 3 && id.endsWith(appointCode);
};

/** 以預約號碼／密碼或手機查 YSCP；精準查無結果時改清單後端比對 */
export const findAppointmentsByQuery = async (input: {
  appointCode?: string;
  phoneNo?: string;
}): Promise<AppointmentItem[]> => {
  const appointCode = String(input.appointCode ?? "").trim();
  const phoneNo = normalizePhoneDigits(input.phoneNo ?? "");
  if (!appointCode && !phoneNo) return [];

  const range = getAppointQueryRangeTaipei();
  const query = { appointCode, phoneNo };
  const lists: AppointmentItem[][] = [];

  if (appointCode) {
    lists.push(
      (await listAppointments({ appointCode, ...range, pageSize: 100 })).list ??
        [],
    );
  }
  if (phoneNo) {
    lists.push(
      (await listAppointments({ phoneNo, ...range, pageSize: 100 })).list ?? [],
    );
  }

  const precise = mergeByAppointId(lists).filter((item) =>
    matchesAppointmentQuery(item, query),
  );
  if (precise.length > 0) return precise;

  return mergeByAppointId([
    (await listAppointments({ ...range, pageSize: 200 })).list ?? [],
  ]).filter((item) => matchesAppointmentQuery(item, query));
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
