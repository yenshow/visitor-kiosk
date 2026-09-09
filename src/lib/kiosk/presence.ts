import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { toTaipeiIso } from "@/lib/kiosk/api-helpers";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import { normalizePhoneDigits } from "@/lib/kiosk/phone";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";

export type PresenceEntry = {
  recordId: string;
  visitorName: string;
  plateNo: string;
  at: string;
};

/** 正式簽退累積紀錄（跨日保留至手動重置） */
export type DepartedEntry = {
  recordId: string;
  visitorName: string;
  phoneNo: string;
  plateNo: string;
  companyName: string;
  receptionistName: string;
  at: string;
};

/** 報到當下快取（在廠 API 常缺車牌／被訪人） */
export type VisitorMetaEntry = {
  recordId: string;
  visitorId?: string;
  visitorName: string;
  phoneNo?: string;
  plateNo: string;
  companyName: string;
  receptionistName: string;
  at: string;
};

type PresenceStore = {
  tempOut: PresenceEntry[];
  departed: DepartedEntry[];
  visitorMeta: VisitorMetaEntry[];
};

/** 舊檔相容：曾用 departedToday；欄位可能缺 phone／公司等 */
type PresenceStoreFile = Partial<{
  tempOut: PresenceEntry[];
  departed: Array<Partial<DepartedEntry> & { recordId?: string }>;
  departedToday: Array<Partial<DepartedEntry> & { recordId?: string }>;
  visitorMeta: VisitorMetaEntry[];
}>;

const STORE_PATH = path.join(process.cwd(), "data", "kiosk-presence.json");

const emptyStore = (): PresenceStore => ({
  tempOut: [],
  departed: [],
  visitorMeta: [],
});

const cleanName = (value?: string) =>
  displayVisitorName(undefined, undefined, value);

const toDepartedEntry = (
  item: Partial<DepartedEntry> & { recordId?: string },
): DepartedEntry | null => {
  const recordId = String(item.recordId ?? "").trim();
  if (!recordId) return null;
  return {
    recordId,
    visitorName: cleanName(item.visitorName) || "—",
    phoneNo: normalizePhoneDigits(item.phoneNo ?? ""),
    plateNo: normalizePlateNo(item.plateNo),
    companyName: String(item.companyName ?? "").trim(),
    receptionistName: String(item.receptionistName ?? "").trim(),
    at: String(item.at ?? "").trim() || toTaipeiIso(new Date()),
  };
};

let writeChain: Promise<void> = Promise.resolve();

const readStore = async (): Promise<PresenceStore> => {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as PresenceStoreFile;
    const rawDeparted = Array.isArray(parsed.departed)
      ? parsed.departed
      : Array.isArray(parsed.departedToday)
        ? parsed.departedToday
        : [];
    return {
      tempOut: Array.isArray(parsed.tempOut) ? parsed.tempOut : [],
      departed: rawDeparted
        .map((item) => toDepartedEntry(item))
        .filter((item): item is DepartedEntry => Boolean(item)),
      visitorMeta: Array.isArray(parsed.visitorMeta) ? parsed.visitorMeta : [],
    };
  } catch {
    return emptyStore();
  }
};

const writeStore = async (store: PresenceStore): Promise<void> => {
  writeChain = writeChain.then(async () => {
    await mkdir(path.dirname(STORE_PATH), { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  });
  await writeChain;
};

/** 與 YSCP 在廠清單對帳：已不在廠者清掉 TEMP_OUT／過期 meta（不刪 departed） */
export const getPresenceStore = async (
  onSiteRecordIds?: Set<string>,
): Promise<PresenceStore> => {
  const store = await readStore();
  if (!onSiteRecordIds) return store;

  const keepMetaIds = new Set([
    ...onSiteRecordIds,
    ...store.tempOut.map((item) => item.recordId),
  ]);

  const next: PresenceStore = {
    ...store,
    tempOut: store.tempOut.filter((item) =>
      onSiteRecordIds.has(item.recordId),
    ),
    visitorMeta: store.visitorMeta.filter((item) =>
      keepMetaIds.has(item.recordId),
    ),
  };
  if (
    next.tempOut.length !== store.tempOut.length ||
    next.visitorMeta.length !== store.visitorMeta.length
  ) {
    await writeStore(next);
  }
  return next;
};

export const upsertVisitorMeta = async (entry: {
  recordId: string;
  visitorId?: string;
  visitorName?: string;
  phoneNo?: string;
  plateNo?: string;
  companyName?: string;
  receptionistName?: string;
}): Promise<void> => {
  const recordId = String(entry.recordId ?? "").trim();
  if (!recordId) return;

  const store = await readStore();
  const nextMeta = store.visitorMeta.filter((item) => item.recordId !== recordId);
  nextMeta.push({
    recordId,
    visitorId: String(entry.visitorId ?? "").trim() || undefined,
    visitorName: cleanName(entry.visitorName) || "—",
    phoneNo: normalizePhoneDigits(entry.phoneNo ?? "") || undefined,
    plateNo: normalizePlateNo(entry.plateNo),
    companyName: String(entry.companyName ?? "").trim(),
    receptionistName: String(entry.receptionistName ?? "").trim(),
    at: toTaipeiIso(new Date()),
  });
  await writeStore({ ...store, visitorMeta: nextMeta });
};

export const markTempOut = async (entry: {
  recordId: string;
  visitorName?: string;
  plateNo?: string;
}): Promise<void> => {
  const recordId = String(entry.recordId ?? "").trim();
  if (!recordId) throw new Error("缺少簽到記錄 ID");

  const store = await readStore();
  const meta = store.visitorMeta.find((item) => item.recordId === recordId);
  const next = store.tempOut.filter((item) => item.recordId !== recordId);
  next.push({
    recordId,
    visitorName: cleanName(entry.visitorName || meta?.visitorName) || "—",
    plateNo:
      normalizePlateNo(entry.plateNo) ||
      normalizePlateNo(meta?.plateNo) ||
      "",
    at: toTaipeiIso(new Date()),
  });
  await writeStore({ ...store, tempOut: next });
};

export const clearTempOut = async (recordId: string): Promise<void> => {
  const id = String(recordId ?? "").trim();
  if (!id) return;
  const store = await readStore();
  const tempOut = store.tempOut.filter((item) => item.recordId !== id);
  if (tempOut.length === store.tempOut.length) return;
  await writeStore({ ...store, tempOut });
};

export const markDeparted = async (entry: {
  recordId: string;
  visitorName?: string;
  phoneNo?: string;
  plateNo?: string;
  companyName?: string;
  receptionistName?: string;
}): Promise<void> => {
  const recordId = String(entry.recordId ?? "").trim();
  if (!recordId) throw new Error("缺少簽到記錄 ID");

  const store = await readStore();
  const meta = store.visitorMeta.find((item) => item.recordId === recordId);
  const departedEntry = toDepartedEntry({
    recordId,
    visitorName: entry.visitorName || meta?.visitorName,
    phoneNo: entry.phoneNo || meta?.phoneNo,
    plateNo: entry.plateNo || meta?.plateNo,
    companyName: entry.companyName || meta?.companyName,
    receptionistName: entry.receptionistName || meta?.receptionistName,
    at: toTaipeiIso(new Date()),
  });
  if (!departedEntry) throw new Error("缺少簽到記錄 ID");

  await writeStore({
    tempOut: store.tempOut.filter((item) => item.recordId !== recordId),
    visitorMeta: store.visitorMeta.filter((item) => item.recordId !== recordId),
    departed: [
      ...store.departed.filter((item) => item.recordId !== recordId),
      departedEntry,
    ],
  });
};

/** 清空本機三類統計相關資料（不影響 YSCP 在廠） */
export const resetPresenceStats = async (): Promise<void> => {
  await writeStore(emptyStore());
};
