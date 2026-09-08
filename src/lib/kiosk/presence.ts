import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { toTaipeiIso } from "@/lib/kiosk/api-helpers";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";

export type PresenceEntry = {
  recordId: string;
  visitorName: string;
  plateNo: string;
  at: string;
};

export type DepartedEntry = PresenceEntry & {
  date: string;
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
  departedToday: DepartedEntry[];
  visitorMeta: VisitorMetaEntry[];
};

const STORE_PATH = path.join(process.cwd(), "data", "kiosk-presence.json");

const emptyStore = (): PresenceStore => ({
  tempOut: [],
  departedToday: [],
  visitorMeta: [],
});

const taipeiDate = (date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const cleanName = (value?: string) =>
  displayVisitorName(undefined, undefined, value);

let writeChain: Promise<void> = Promise.resolve();

const readStore = async (): Promise<PresenceStore> => {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<PresenceStore>;
    return {
      tempOut: Array.isArray(parsed.tempOut) ? parsed.tempOut : [],
      departedToday: Array.isArray(parsed.departedToday)
        ? parsed.departedToday
        : [],
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

const pruneDepartedToToday = (store: PresenceStore): PresenceStore => {
  const today = taipeiDate();
  return {
    ...store,
    departedToday: store.departedToday.filter((item) => item.date === today),
  };
};

/** 與 YSCP 在廠清單對帳：已不在廠者清掉 TEMP_OUT／過期 meta */
export const getPresenceStore = async (
  onSiteRecordIds?: Set<string>,
): Promise<PresenceStore> => {
  const store = pruneDepartedToToday(await readStore());
  if (!onSiteRecordIds) return store;

  const keepMetaIds = new Set([
    ...onSiteRecordIds,
    ...store.departedToday.map((item) => item.recordId),
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
    next.departedToday.length !== store.departedToday.length ||
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

  const store = pruneDepartedToToday(await readStore());
  const nextMeta = store.visitorMeta.filter((item) => item.recordId !== recordId);
  nextMeta.push({
    recordId,
    visitorId: String(entry.visitorId ?? "").trim() || undefined,
    visitorName: cleanName(entry.visitorName) || "—",
    phoneNo: String(entry.phoneNo ?? "").trim() || undefined,
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

  const store = pruneDepartedToToday(await readStore());
  const next = store.tempOut.filter((item) => item.recordId !== recordId);
  next.push({
    recordId,
    visitorName: cleanName(entry.visitorName) || "—",
    plateNo: normalizePlateNo(entry.plateNo),
    at: toTaipeiIso(new Date()),
  });
  await writeStore({ ...store, tempOut: next });
};

export const clearTempOut = async (recordId: string): Promise<void> => {
  const id = String(recordId ?? "").trim();
  if (!id) return;
  const store = pruneDepartedToToday(await readStore());
  const tempOut = store.tempOut.filter((item) => item.recordId !== id);
  if (tempOut.length === store.tempOut.length) return;
  await writeStore({ ...store, tempOut });
};

export const markDeparted = async (entry: {
  recordId: string;
  visitorName?: string;
  plateNo?: string;
}): Promise<void> => {
  const recordId = String(entry.recordId ?? "").trim();
  if (!recordId) throw new Error("缺少簽到記錄 ID");

  const store = pruneDepartedToToday(await readStore());
  const meta = store.visitorMeta.find((item) => item.recordId === recordId);
  await writeStore({
    tempOut: store.tempOut.filter((item) => item.recordId !== recordId),
    visitorMeta: store.visitorMeta.filter((item) => item.recordId !== recordId),
    departedToday: [
      ...store.departedToday.filter((item) => item.recordId !== recordId),
      {
        recordId,
        visitorName: cleanName(entry.visitorName || meta?.visitorName) || "—",
        plateNo:
          normalizePlateNo(entry.plateNo) ||
          normalizePlateNo(meta?.plateNo) ||
          "",
        at: toTaipeiIso(new Date()),
        date: taipeiDate(),
      },
    ],
  });
};
