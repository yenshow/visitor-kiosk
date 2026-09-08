import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { toTaipeiIso } from "@/lib/kiosk/api-helpers";
import { normalizePhoneDigits } from "@/lib/kiosk/phone";
import { normalizePlateNo } from "@/lib/kiosk/plate";

export type PlateCacheEntry = {
  plateNo: string;
  visitorId?: string;
  phoneNo?: string;
  appointId?: string;
  recordId?: string;
  at: string;
};

type PlateStore = {
  entries: PlateCacheEntry[];
};

const STORE_PATH = path.join(process.cwd(), "data", "kiosk-plates.json");
const MAX_ENTRIES = 500;

let writeChain: Promise<void> = Promise.resolve();

const emptyStore = (): PlateStore => ({ entries: [] });

const readStore = async (): Promise<PlateStore> => {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<PlateStore>;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return emptyStore();
  }
};

const writeStore = async (store: PlateStore): Promise<void> => {
  writeChain = writeChain.then(async () => {
    await mkdir(path.dirname(STORE_PATH), { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  });
  await writeChain;
};

/** 記住曾見過的車牌（預約／報到查詢／簽到）；YSCP 列表常回空 plateNo */
export const rememberPlate = async (input: {
  plateNo?: string | null;
  visitorId?: string | null;
  phoneNo?: string | null;
  appointId?: string | null;
  recordId?: string | null;
}): Promise<void> => {
  const plateNo = normalizePlateNo(input.plateNo);
  if (!plateNo) return;

  const visitorId = String(input.visitorId ?? "").trim();
  const phoneNo = normalizePhoneDigits(input.phoneNo ?? "");
  const appointId = String(input.appointId ?? "").trim();
  const recordId = String(input.recordId ?? "").trim();
  if (!visitorId && !phoneNo && !appointId && !recordId) return;

  const store = await readStore();
  const next = store.entries.filter((item) => {
    if (recordId && item.recordId === recordId) return false;
    if (appointId && item.appointId === appointId) return false;
    if (visitorId && item.visitorId === visitorId) return false;
    if (phoneNo && normalizePhoneDigits(item.phoneNo ?? "") === phoneNo) return false;
    return true;
  });

  next.unshift({
    plateNo,
    visitorId: visitorId || undefined,
    phoneNo: phoneNo || undefined,
    appointId: appointId || undefined,
    recordId: recordId || undefined,
    at: toTaipeiIso(new Date()),
  });

  await writeStore({ entries: next.slice(0, MAX_ENTRIES) });
};

export const lookupCachedPlate = async (keys: {
  visitorId?: string | null;
  phoneNo?: string | null;
  appointId?: string | null;
  recordId?: string | null;
}): Promise<string> => {
  const visitorId = String(keys.visitorId ?? "").trim();
  const phoneNo = normalizePhoneDigits(keys.phoneNo ?? "");
  const appointId = String(keys.appointId ?? "").trim();
  const recordId = String(keys.recordId ?? "").trim();
  if (!visitorId && !phoneNo && !appointId && !recordId) return "";

  const store = await readStore();
  for (const item of store.entries) {
    if (recordId && item.recordId === recordId) return item.plateNo;
  }
  for (const item of store.entries) {
    if (appointId && item.appointId === appointId) return item.plateNo;
  }
  for (const item of store.entries) {
    if (visitorId && item.visitorId === visitorId) return item.plateNo;
  }
  for (const item of store.entries) {
    if (phoneNo && normalizePhoneDigits(item.phoneNo ?? "") === phoneNo) {
      return item.plateNo;
    }
  }
  return "";
};

export const buildPlateCacheIndex = async () => {
  const store = await readStore();
  const byVisitorId = new Map<string, string>();
  const byPhone = new Map<string, string>();
  const byRecordId = new Map<string, string>();

  // 較新的在前；先寫入者優先保留
  for (const item of store.entries) {
    if (item.recordId && !byRecordId.has(item.recordId)) {
      byRecordId.set(item.recordId, item.plateNo);
    }
    if (item.visitorId && !byVisitorId.has(item.visitorId)) {
      byVisitorId.set(item.visitorId, item.plateNo);
    }
    const phone = normalizePhoneDigits(item.phoneNo ?? "");
    if (phone && !byPhone.has(phone)) {
      byPhone.set(phone, item.plateNo);
    }
  }

  return { byVisitorId, byPhone, byRecordId };
};
