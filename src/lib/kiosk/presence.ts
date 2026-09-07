import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { toTaipeiIso } from "@/lib/kiosk/api-helpers";
import { normalizePlateNo } from "@/lib/kiosk/plate";

export type PresenceEntry = {
  recordId: string;
  visitorName: string;
  plateNo: string;
  at: string;
};

export type DepartedEntry = PresenceEntry & {
  date: string;
};

type PresenceStore = {
  tempOut: PresenceEntry[];
  departedToday: DepartedEntry[];
};

const STORE_PATH = path.join(process.cwd(), "data", "kiosk-presence.json");

const emptyStore = (): PresenceStore => ({
  tempOut: [],
  departedToday: [],
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

let writeChain: Promise<void> = Promise.resolve();

const readStore = async (): Promise<PresenceStore> => {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as PresenceStore;
    return {
      tempOut: Array.isArray(parsed.tempOut) ? parsed.tempOut : [],
      departedToday: Array.isArray(parsed.departedToday)
        ? parsed.departedToday
        : [],
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

/** 與 YSCP 在廠清單對帳：已不在廠者清掉 TEMP_OUT */
export const getPresenceStore = async (
  onSiteRecordIds?: Set<string>,
): Promise<PresenceStore> => {
  const store = pruneDepartedToToday(await readStore());
  if (!onSiteRecordIds) return store;

  const next: PresenceStore = {
    ...store,
    tempOut: store.tempOut.filter((item) =>
      onSiteRecordIds.has(item.recordId),
    ),
  };
  if (
    next.tempOut.length !== store.tempOut.length ||
    next.departedToday.length !== store.departedToday.length
  ) {
    await writeStore(next);
  }
  return next;
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
    visitorName: String(entry.visitorName ?? "").trim() || "—",
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
  await writeStore({
    tempOut: store.tempOut.filter((item) => item.recordId !== recordId),
    departedToday: [
      ...store.departedToday.filter((item) => item.recordId !== recordId),
      {
        recordId,
        visitorName: String(entry.visitorName ?? "").trim() || "—",
        plateNo: normalizePlateNo(entry.plateNo),
        at: toTaipeiIso(new Date()),
        date: taipeiDate(),
      },
    ],
  });
};
