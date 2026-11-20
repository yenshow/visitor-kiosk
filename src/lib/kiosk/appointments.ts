import { randomUUID } from "crypto";
import { getAppointQueryRangeTaipei } from "@/lib/kiosk/api-helpers";
import { readDataFile, readKioskData, updateKioskData } from "@/lib/kiosk/data-store";
import { loadLegacyVisits } from "@/lib/kiosk/presence";
import { getHost } from "@/lib/kiosk/directory";
import { normalizePhoneDigits, normalizePlateNo } from "@/lib/kiosk/normalize";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";
import type { AppointmentItem, VisitorInfo } from "@/lib/kiosk/visitor";

const loadLegacyAppointments = async (): Promise<AppointmentItem[]> => {
  const data = (await readDataFile("kiosk-appointments.json")) as
    | { appointments?: AppointmentItem[] }
    | undefined;
  if (!data) return [];
  if (
    !Array.isArray(data.appointments) ||
    !data.appointments.every((item) => typeof item?.appointID === "string" && item.appointID.trim())
  ) {
    throw new Error("預約資料格式錯誤：kiosk-appointments.json");
  }
  return data.appointments;
};

export const loadLegacyKioskData = async () => {
  const [appointments, visits] = await Promise.all([
    loadLegacyAppointments(),
    loadLegacyVisits(),
  ]);
  return { appointments, visits };
};

export const listAppointments = async (): Promise<AppointmentItem[]> =>
  (await readKioskData())?.appointments ?? await loadLegacyAppointments();

const inQueryWindow = (
  item: AppointmentItem,
  range: { appointStartTime: string; appointEndTime: string },
): boolean => {
  const start = String(item.appointStartTime ?? "").trim();
  const end = String(item.appointEndTime ?? "").trim();
  if (!start && !end) return true;
  if (end && end < range.appointStartTime) return false;
  if (start && start > range.appointEndTime) return false;
  return true;
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
  return code === appointCode || id === appointCode;
};

const usedCodes = (appointments: AppointmentItem[]): Set<string> =>
  new Set(
    appointments
      .map((item) => String(item.appointCode ?? "").trim())
      .filter(Boolean),
  );

const newAppointCode = (used: Set<string>): string => {
  for (let i = 0; i < 80; i += 1) {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    if (!used.has(code)) return code;
  }
  throw new Error("無法產生預約碼，請稍後再試");
};

export const createLocalAppointment = async (input: {
  receptionistId: string;
  receptionistName?: string;
  appointStartTime: string;
  appointEndTime: string;
  visitReasonType: number;
  visitReasonDetail?: string;
  visitorInfo: Pick<
    VisitorInfo,
    | "visitorFamilyName"
    | "visitorGivenName"
    | "companyName"
    | "phoneNo"
    | "email"
    | "gender"
    | "plateNo"
  >;
}): Promise<AppointmentItem> => {
  const host = await getHost(input.receptionistId);
  if (!host) throw new Error("找不到被訪人，請至設定頁確認人員目錄");

  const family = String(input.visitorInfo.visitorFamilyName ?? "").trim();
  const given = String(input.visitorInfo.visitorGivenName ?? "").trim();
  const visitorName = displayVisitorName(family, given);
  const plateNo = normalizePlateNo(input.visitorInfo.plateNo);
  return updateKioskData(loadLegacyKioskData, (data) => {
    const item: AppointmentItem = {
      appointID: randomUUID(),
      appointCode: newAppointCode(usedCodes(data.appointments)),
      appointStartTime: input.appointStartTime,
      appointEndTime: input.appointEndTime,
      appointStatus: "0",
      receptionistId: host.personId,
      receptionistName:
        String(input.receptionistName ?? "").trim() || host.personName,
      visitReasonType: input.visitReasonType,
      visitReasonDetail: input.visitReasonDetail ?? "",
      visitorInfo: {
        visitorId: randomUUID(),
        visitorFamilyName: family,
        visitorGivenName: given,
        visitorName,
        gender: input.visitorInfo.gender ?? 0,
        companyName: String(input.visitorInfo.companyName ?? "").trim(),
        phoneNo: normalizePhoneDigits(input.visitorInfo.phoneNo ?? ""),
        email: String(input.visitorInfo.email ?? "").trim(),
        ...(plateNo ? { plateNo } : {}),
      },
    };
    data.appointments.push(item);
    return item;
  });
};

export const findAppointmentsByQuery = async (input: {
  appointCode?: string;
  phoneNo?: string;
}): Promise<AppointmentItem[]> => {
  const appointCode = String(input.appointCode ?? "").trim();
  const phoneNo = normalizePhoneDigits(input.phoneNo ?? "");
  if (!appointCode && !phoneNo) return [];

  const range = getAppointQueryRangeTaipei();
  const appointments = await listAppointments();
  return appointments.filter(
    (item) =>
      inQueryWindow(item, range) &&
      matchesAppointmentQuery(item, { appointCode, phoneNo }),
  );
};
