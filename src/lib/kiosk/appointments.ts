import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getAppointQueryRangeTaipei } from "@/lib/kiosk/api-helpers";
import { getHost } from "@/lib/kiosk/directory";
import { normalizePhoneDigits, normalizePlateNo } from "@/lib/kiosk/normalize";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";
import type { AppointmentItem, VisitorInfo } from "@/lib/kiosk/visitor";

export type AppointmentStore = {
  appointments: AppointmentItem[];
};

const STORE_PATH = path.join(process.cwd(), "data", "kiosk-appointments.json");

const emptyStore = (): AppointmentStore => ({ appointments: [] });

let writeChain: Promise<void> = Promise.resolve();

const writeStore = async (store: AppointmentStore): Promise<void> => {
  writeChain = writeChain.then(async () => {
    await mkdir(path.dirname(STORE_PATH), { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  });
  await writeChain;
};

const readStore = async (): Promise<AppointmentStore> => {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppointmentStore>;
    const list = Array.isArray(parsed.appointments) ? parsed.appointments : [];
    return {
      appointments: list.filter(
        (item): item is AppointmentItem =>
          Boolean(item && String(item.appointID ?? "").trim()),
      ),
    };
  } catch {
    return emptyStore();
  }
};

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

const usedCodes = (store: AppointmentStore): Set<string> =>
  new Set(
    store.appointments
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
  const store = await readStore();
  const appointCode = newAppointCode(usedCodes(store));
  const visitorId = randomUUID();
  const appointID = randomUUID();
  const plateNo = normalizePlateNo(input.visitorInfo.plateNo);
  const item: AppointmentItem = {
    appointID,
    appointCode,
    appointStartTime: input.appointStartTime,
    appointEndTime: input.appointEndTime,
    appointStatus: "0",
    receptionistId: host.personId,
    receptionistName:
      String(input.receptionistName ?? "").trim() || host.personName,
    visitReasonType: input.visitReasonType,
    visitReasonDetail: input.visitReasonDetail ?? "",
    visitorInfo: {
      visitorId,
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

  await writeStore({ appointments: [...store.appointments, item] });
  return item;
};

export const findAppointmentsByQuery = async (input: {
  appointCode?: string;
  phoneNo?: string;
}): Promise<AppointmentItem[]> => {
  const appointCode = String(input.appointCode ?? "").trim();
  const phoneNo = normalizePhoneDigits(input.phoneNo ?? "");
  if (!appointCode && !phoneNo) return [];

  const range = getAppointQueryRangeTaipei();
  const store = await readStore();
  return store.appointments.filter(
    (item) =>
      inQueryWindow(item, range) &&
      matchesAppointmentQuery(item, { appointCode, phoneNo }),
  );
};

export const getAppointmentById = async (
  appointID: string,
): Promise<AppointmentItem | null> => {
  const id = String(appointID ?? "").trim();
  if (!id) return null;
  const store = await readStore();
  return store.appointments.find((item) => item.appointID === id) ?? null;
};

const patchAppointment = async (
  appointID: string,
  status: string,
): Promise<void> => {
  const id = String(appointID ?? "").trim();
  if (!id) return;
  const store = await readStore();
  const next = store.appointments.map((item) =>
    item.appointID === id ? { ...item, appointStatus: status } : item,
  );
  await writeStore({ appointments: next });
};

export const markAppointmentCheckedIn = async (
  appointID: string,
): Promise<void> => {
  const item = await getAppointmentById(appointID);
  if (!item) throw new Error("找不到預約，請重新查詢");
  const status = String(item.appointStatus ?? "0");
  if (status === "3") throw new Error("此預約已報到");
  if (status === "4") throw new Error("此預約已結束，請重新預約");
  await patchAppointment(appointID, "3");
};

export const markAppointmentCheckedOut = async (
  appointID: string,
): Promise<void> => {
  const id = String(appointID ?? "").trim();
  if (!id) return;
  const item = await getAppointmentById(id);
  if (!item) return;
  await patchAppointment(id, "4");
};
