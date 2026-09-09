import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  taipeiDateKeyFromIso,
  toTaipeiDateKey,
  toTaipeiIso,
} from "@/lib/kiosk/api-helpers";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import { normalizePhoneDigits } from "@/lib/kiosk/phone";
import type { FlatRegisterRecord } from "@/lib/kiosk/register-record";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";

export type VisitStatus = "on_site" | "temp_out" | "departed";

export type VisitorVisit = {
  recordId: string;
  status: VisitStatus;
  visitorId?: string;
  visitorName: string;
  phoneNo: string;
  plateNo: string;
  companyName: string;
  receptionistName: string;
  /** YSCP 來訪事由代碼；施工＝4，跨日返回須知影片用 */
  visitReasonType?: number;
  checkinAt: string;
  tempOutAt?: string;
  departedAt?: string;
};

export type VisitStore = {
  visits: VisitorVisit[];
};

type VisitFieldsInput = {
  recordId: string;
  visitorId?: string;
  visitorName?: string;
  phoneNo?: string;
  plateNo?: string;
  companyName?: string;
  receptionistName?: string;
  visitReasonType?: number;
};

/** 舊檔相容欄位（遷移後不再寫出） */
type LegacyStoreFile = Partial<{
  visits: Array<Partial<VisitorVisit> & { recordId?: string }>;
  tempOut: Array<Partial<VisitFieldsInput> & { at?: string }>;
  departed: Array<Partial<VisitFieldsInput> & { at?: string }>;
  departedToday: Array<Partial<VisitFieldsInput> & { at?: string }>;
  visitorMeta: Array<Partial<VisitFieldsInput> & { at?: string }>;
}>;

const STORE_PATH = path.join(process.cwd(), "data", "kiosk-presence.json");

const emptyStore = (): VisitStore => ({ visits: [] });

const cleanName = (value?: string) =>
  displayVisitorName(undefined, undefined, value);

const nowIso = () => toTaipeiIso(new Date());

const mergeFields = (
  entry: VisitFieldsInput,
  prev?: VisitorVisit,
): Omit<
  VisitorVisit,
  "status" | "checkinAt" | "tempOutAt" | "departedAt"
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
  return {
    ...mergeFields({ recordId, ...item }),
    status,
    checkinAt: String(item.checkinAt ?? "").trim() || nowIso(),
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
      ...mergeFields(visit, prev),
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
    const at = String(meta.at ?? "").trim() || nowIso();
    upsert({
      ...mergeFields({ recordId, ...meta }),
      status: "on_site",
      checkinAt: at,
    });
  }

  for (const temp of parsed.tempOut ?? []) {
    const recordId = String(temp.recordId ?? "").trim();
    if (!recordId) continue;
    const at = String(temp.at ?? "").trim() || nowIso();
    upsert({
      ...mergeFields({ recordId, ...temp }),
      status: "temp_out",
      checkinAt: at,
      tempOutAt: at,
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
    const at = String(dep.at ?? "").trim() || nowIso();
    upsert({
      ...mergeFields({ recordId, ...dep }),
      status: "departed",
      checkinAt: at,
      departedAt: at,
    });
  }

  return [...byId.values()];
};

let writeChain: Promise<void> = Promise.resolve();

const writeStore = async (store: VisitStore): Promise<void> => {
  writeChain = writeChain.then(async () => {
    await mkdir(path.dirname(STORE_PATH), { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  });
  await writeChain;
};

const readStore = async (): Promise<VisitStore> => {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as LegacyStoreFile;

    if (Array.isArray(parsed.visits)) {
      return {
        visits: parsed.visits
          .map((item) => normalizeVisit(item))
          .filter((item): item is VisitorVisit => Boolean(item)),
      };
    }

    const migrated = migrateLegacyToVisits(parsed);
    const store = { visits: migrated };
    await writeStore(store);
    return store;
  } catch {
    return emptyStore();
  }
};

const replaceVisit = (
  visits: VisitorVisit[],
  next: VisitorVisit,
): VisitorVisit[] => [
  ...visits.filter((item) => item.recordId !== next.recordId),
  next,
];

const updateVisit = async (
  recordId: string,
  build: (prev: VisitorVisit | undefined) => VisitorVisit,
): Promise<void> => {
  const id = String(recordId ?? "").trim();
  if (!id) throw new Error("缺少簽到記錄 ID");
  const store = await readStore();
  const prev = store.visits.find((item) => item.recordId === id);
  await writeStore({ visits: replaceVisit(store.visits, build(prev)) });
};

export const isDepartedToday = (
  visit: Pick<VisitorVisit, "status" | "departedAt">,
  today = toTaipeiDateKey(),
): boolean => {
  if (visit.status !== "departed") return false;
  const day = taipeiDateKeyFromIso(String(visit.departedAt ?? ""));
  return Boolean(day && day === today);
};

export type ExitCandidate = {
  reason: "temp_out" | "departed";
  plateNo: string;
  at: string;
};

export const exitCandidates = (visits: VisitorVisit[]): ExitCandidate[] => {
  const out: ExitCandidate[] = [];
  for (const visit of visits) {
    if (visit.status === "temp_out" && visit.tempOutAt) {
      out.push({
        reason: "temp_out",
        plateNo: visit.plateNo,
        at: visit.tempOutAt,
      });
      continue;
    }
    if (visit.status === "departed" && visit.departedAt) {
      out.push({
        reason: "departed",
        plateNo: visit.plateNo,
        at: visit.departedAt,
      });
    }
  }
  return out;
};

/**
 * 讀取本機 visits。
 * 正式離場只經 markDeparted；不依 YSCP 在廠清單自動改狀態（避免同步延遲誤標）。
 */
export const getVisitStore = async (): Promise<VisitStore> => readStore();

/** 本機 visit → 在廠列（YSCP 清單缺漏時補齊統計／查詢） */
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
  visitEndTime: "",
  registerTime: visit.checkinAt,
});

export const upsertVisitOnCheckin = async (
  entry: VisitFieldsInput,
): Promise<void> => {
  const recordId = String(entry.recordId ?? "").trim();
  if (!recordId) return;

  const store = await readStore();
  const prev = store.visits.find((item) => item.recordId === recordId);
  await writeStore({
    visits: replaceVisit(store.visits, {
      ...mergeFields({ ...entry, recordId }, prev),
      status: "on_site",
      checkinAt: prev?.checkinAt || nowIso(),
      tempOutAt: undefined,
      departedAt: undefined,
    }),
  });
};

export const markTempOut = async (entry: VisitFieldsInput): Promise<void> => {
  const at = nowIso();
  await updateVisit(entry.recordId, (prev) => ({
    ...mergeFields(entry, prev),
    status: "temp_out",
    checkinAt: prev?.checkinAt || at,
    tempOutAt: at,
    departedAt: undefined,
  }));
};

export const clearTempOut = async (recordId: string): Promise<void> => {
  const id = String(recordId ?? "").trim();
  if (!id) return;
  const store = await readStore();
  const prev = store.visits.find((item) => item.recordId === id);
  if (!prev || prev.status !== "temp_out") return;
  await writeStore({
    visits: replaceVisit(store.visits, {
      ...prev,
      status: "on_site",
      tempOutAt: undefined,
    }),
  });
};

export const markDeparted = async (entry: VisitFieldsInput): Promise<void> => {
  const at = nowIso();
  await updateVisit(entry.recordId, (prev) => ({
    ...mergeFields(entry, prev),
    status: "departed",
    checkinAt: prev?.checkinAt || at,
    tempOutAt: undefined,
    departedAt: at,
  }));
};

/** 清所有離場；臨時外出改回在場；保留在場完整欄位 */
export const resetPresenceStats = async (): Promise<void> => {
  const store = await readStore();
  await writeStore({
    visits: store.visits
      .filter((item) => item.status !== "departed")
      .map((item) =>
        item.status === "temp_out"
          ? { ...item, status: "on_site" as const, tempOutAt: undefined }
          : item,
      ),
  });
};
