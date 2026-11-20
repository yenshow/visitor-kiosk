import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { VisitStore } from "@/lib/kiosk/presence";
import type { AppointmentItem } from "@/lib/kiosk/visitor";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "kiosk-data.json");
const INITIALIZED_PATH = path.join(DATA_DIR, ".kiosk-data-initialized");

type KioskData = VisitStore & {
  version: 1;
  appointments: AppointmentItem[];
};

export const readDataFile = async (fileName: string): Promise<unknown> => {
  let raw: string;
  try {
    raw = await readFile(path.join(DATA_DIR, fileName), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Invalid data object");
    }
    return value;
  } catch {
    throw new Error(`資料檔無法讀取：${fileName}`);
  }
};

export const readKioskData = async (): Promise<KioskData | undefined> => {
  let raw = await readDataFile("kiosk-data.json");
  if (raw === undefined) {
    const initialized = await stat(INITIALIZED_PATH).then(
      () => true,
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return false;
        throw error;
      },
    );
    if (!initialized) return undefined;
    raw = await readDataFile("kiosk-data.json");
    if (raw === undefined) throw new Error("訪客主檔遺失，請從備份還原");
  }

  const data = raw as Partial<KioskData>;
  if (
    data.version !== 1 ||
    !Array.isArray(data.appointments) ||
    !data.appointments.every((item) => typeof item?.appointID === "string" && item.appointID.trim()) ||
    !Array.isArray(data.visits) ||
    !data.visits.every((item) => typeof item?.recordId === "string" && item.recordId.trim())
  ) {
    throw new Error("訪客資料格式錯誤：kiosk-data.json");
  }
  const { statsBaseline } = data;
  if (statsBaseline !== undefined && (
    !statsBaseline ||
    typeof statsBaseline.at !== "string" ||
    !Number.isFinite(Date.parse(statsBaseline.at)) ||
    !Number.isSafeInteger(statsBaseline.departedToday) ||
    !Number.isSafeInteger(statsBaseline.departedTotal) ||
    statsBaseline.departedToday < 0 ||
    statsBaseline.departedToday > statsBaseline.departedTotal
  )) {
    throw new Error("訪客統計基準格式錯誤：kiosk-data.json");
  }
  return { version: data.version, appointments: data.appointments, visits: data.visits, statsBaseline };
};

const writeKioskData = async (data: KioskData, initialize: boolean): Promise<void> => {
  await mkdir(DATA_DIR, { recursive: true });
  const temp = path.join(DATA_DIR, `.kiosk-data-${randomUUID()}.tmp`);
  const file = await open(temp, "wx", 0o600);
  try {
    try {
      await file.writeFile(JSON.stringify(data, null, 2), "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    if (initialize) {
      await (await open(INITIALIZED_PATH, "wx", 0o600)).close();
    }
    try {
      await rename(temp, STORE_PATH);
    } catch (error) {
      if (initialize) await rm(INITIALIZED_PATH, { force: true });
      throw error;
    }
  } finally {
    await rm(temp, { force: true }).catch(() => {});
  }
};

// The Windows launcher runs a single Node server. Share the queue across Next route bundles.
const state = globalThis as typeof globalThis & {
  kioskDataWrites?: Promise<void>;
};

export const updateKioskData = <T>(
  loadLegacyData: () => Promise<Omit<KioskData, "version">>,
  update: (data: KioskData) => T,
): Promise<T> => {
  const operation = (state.kioskDataWrites ?? Promise.resolve()).then(async () => {
    const current = await readKioskData();
    const data = current ?? { version: 1, ...await loadLegacyData() };
    const result = update(data);
    await writeKioskData(data, current === undefined);
    return result;
  });
  state.kioskDataWrites = operation.then(() => {}, () => {});
  return operation;
};
