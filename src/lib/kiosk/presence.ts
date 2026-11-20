import {
  taipeiDateKeyFromIso,
  toTaipeiDateKey,
} from "@/lib/kiosk/api-helpers";
import { readDataFile, readKioskData } from "@/lib/kiosk/data-store";
import { normalizePhoneDigits, normalizePlateNo } from "@/lib/kiosk/normalize";
import type { FlatRegisterRecord } from "@/lib/kiosk/register-record";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";

export type VisitStatus = "on_site" | "temp_out" | "departed";

export type VisitEvent = {
  type: "checkin" | "temp_out" | "return" | "departed";
  at: string;
};

export type VisitorVisit = {
  recordId: string;
  status: VisitStatus;
  visitorId?: string;
  appointId?: string;
  visitorName: string;
  phoneNo: string;
  plateNo: string;
  companyName: string;
  receptionistName: string;
  /** 來訪事由代碼；施工＝4，跨日返回須知影片用 */
  visitReasonType?: number;
  /** 來訪截止（通常＝預約結束時間） */
  visitEndTime?: string;
  checkinAt: string;
  tempOutAt?: string;
  departedAt?: string;
  events?: VisitEvent[];
};

export type VisitStore = {
  visits: VisitorVisit[];
  statsBaseline?: { at: string; departedToday: number; departedTotal: number };
};

export type VisitFieldsInput = {
  recordId: string;
  visitorId?: string;
  appointId?: string;
  visitorName?: string;
  phoneNo?: string;
  plateNo?: string;
  companyName?: string;
  receptionistName?: string;
  visitReasonType?: number;
  visitEndTime?: string;
};

/** 舊檔相容欄位（遷移後不再寫出） */
type LegacyStoreFile = Partial<{
  visits: Array<Partial<VisitorVisit> & { recordId?: string }>;
  tempOut: Array<Partial<VisitFieldsInput> & { at?: string }>;
  departed: Array<Partial<VisitFieldsInput> & { at?: string }>;
  departedToday: Array<Partial<VisitFieldsInput> & { at?: string }>;
  visitorMeta: Array<Partial<VisitFieldsInput> & { at?: string }>;
}>;

const cleanName = (value?: string) =>
  displayVisitorName(undefined, undefined, value);

export const mergeVisitFields = (
  entry: VisitFieldsInput,
  prev?: VisitorVisit,
): Omit<
  VisitorVisit,
  "status" | "checkinAt" | "tempOutAt" | "departedAt" | "events"
> => {
  const reasonRaw = Number(entry.visitReasonType);
  return {
    recordId: entry.recordId,
    visitorId:
      String(entry.visitorId ?? "").trim() || prev?.visitorId || undefined,
    visitorName: cleanName(entry.visitorName) || prev?.visitorName || "—",
    phoneNo: normalizePhoneDigits(entry.phoneNo ?? "") || prev?.phoneNo || "",
    plateNo: normalizePlateNo(entry.plateNo) || prev?.plateNo || "",
    companyName:
      String(entry.companyName ?? "").trim() || prev?.companyName || "",
    receptionistName:
      String(entry.receptionistName ?? "").trim() ||
      prev?.receptionistName ||
      "",
    visitReasonType: Number.isFinite(reasonRaw)
      ? reasonRaw
      : prev?.visitReasonType,
    visitEndTime:
      String(entry.visitEndTime ?? "").trim() || prev?.visitEndTime || undefined,
    appointId:
      String(entry.appointId ?? "").trim() || prev?.appointId || undefined,
  };
};

const normalizeVisit = (
  item: Partial<VisitorVisit> & { recordId?: string },
): VisitorVisit | null => {
  const recordId = String(item.recordId ?? "").trim();
  if (!recordId) return null;
  const status: VisitStatus =
    item.status === "temp_out" || item.status === "departed"
      ? item.status
      : "on_site";
  const fields = mergeVisitFields({ ...item, recordId });
  return {
    ...fields,
    status,
    checkinAt: String(item.checkinAt ?? "").trim(),
    tempOutAt: String(item.tempOutAt ?? "").trim() || undefined,
    departedAt: String(item.departedAt ?? "").trim() || undefined,
  };
};

const migrateLegacyToVisits = (parsed: LegacyStoreFile): VisitorVisit[] => {
  const byId = new Map<string, VisitorVisit>();

  const upsert = (visit: VisitorVisit) => {
    const prev = byId.get(visit.recordId);
    if (!prev) {
      byId.set(visit.recordId, visit);
      return;
    }
    byId.set(visit.recordId, {
      ...mergeVisitFields(visit, prev),
      status:
        visit.status === "departed" || prev.status === "departed"
          ? "departed"
          : visit.status === "temp_out" || prev.status === "temp_out"
            ? "temp_out"
            : "on_site",
      checkinAt: prev.checkinAt || visit.checkinAt,
      tempOutAt: visit.tempOutAt || prev.tempOutAt,
      departedAt: visit.departedAt || prev.departedAt,
    });
  };

  for (const meta of parsed.visitorMeta ?? []) {
    const recordId = String(meta.recordId ?? "").trim();
    if (!recordId) continue;
    const at = String(meta.at ?? "").trim();
    upsert({
      ...mergeVisitFields({ ...meta, recordId }),
      status: "on_site",
      checkinAt: at,
    });
  }

  for (const temp of parsed.tempOut ?? []) {
    const recordId = String(temp.recordId ?? "").trim();
    if (!recordId) continue;
    const at = String(temp.at ?? "").trim();
    upsert({
      ...mergeVisitFields({ ...temp, recordId }),
      status: "temp_out",
      checkinAt: "",
      tempOutAt: at || undefined,
    });
  }

  const rawDeparted = Array.isArray(parsed.departed)
    ? parsed.departed
    : Array.isArray(parsed.departedToday)
      ? parsed.departedToday
      : [];

  for (const dep of rawDeparted) {
    const recordId = String(dep.recordId ?? "").trim();
    if (!recordId) continue;
    const at = String(dep.at ?? "").trim();
    upsert({
      ...mergeVisitFields({ ...dep, recordId }),
      status: "departed",
      checkinAt: "",
      departedAt: at || undefined,
    });
  }

  return [...byId.values()];
};

export const loadLegacyVisits = async (): Promise<VisitorVisit[]> => {
  const parsed = (await readDataFile("kiosk-presence.json")) as
    | LegacyStoreFile
    | undefined;
  if (!parsed) return [];
  if (Array.isArray(parsed.visits)) {
    return parsed.visits.map((item) => {
      const visit = item && normalizeVisit(item);
      if (!visit) throw new Error("訪客紀錄格式錯誤：kiosk-presence.json");
      return visit;
    });
  }

  const legacyKeys = ["visitorMeta", "tempOut", "departed", "departedToday"] as const;
  const hasLegacyFields = legacyKeys.some((key) => key in parsed);
  if (
    "visits" in parsed ||
    (!hasLegacyFields && Object.keys(parsed).length > 0) ||
    legacyKeys.some((key) => key in parsed && !Array.isArray(parsed[key]))
  ) {
    throw new Error("訪客紀錄格式錯誤：kiosk-presence.json");
  }
  return migrateLegacyToVisits(parsed);
};

export const isDepartedToday = (
  visit: Pick<VisitorVisit, "status" | "departedAt">,
  today = toTaipeiDateKey(),
): boolean => {
  if (visit.status !== "departed") return false;
  const day = taipeiDateKeyFromIso(String(visit.departedAt ?? ""));
  return Boolean(day && day === today);
};

export const getVisitStore = async (): Promise<VisitStore> =>
  (await readKioskData()) ?? { visits: await loadLegacyVisits() };

/** 本機 visit → 在場列（統計／查詢） */
export const visitToRegisterRecord = (
  visit: VisitorVisit,
): FlatRegisterRecord => ({
  recordId: visit.recordId,
  visitorId: visit.visitorId ?? "",
  visitorName: visit.visitorName,
  phoneNo: visit.phoneNo,
  companyName: visit.companyName,
  receptionistName: visit.receptionistName,
  plateNo: visit.plateNo,
  visitStartTime: visit.checkinAt,
  visitEndTime: String(visit.visitEndTime ?? "").trim(),
  registerTime: visit.checkinAt,
});
