import { existsSync } from "fs";
import { randomUUID } from "crypto";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import path from "path";
import { getConfig } from "@/lib/config";
import {
  KIOSK_FEATURE_KEYS,
  VISITOR_FEATURE_KEY,
} from "@/lib/license/constants";

export type KioskLicenseState = {
  features: string[];
  serialNumber: string | null;
  licenseKey: string | null;
  activationMethod: string | null;
  deviceFingerprint: string | null;
  updatedAt: string | null;
};

/** Next cwd=app/；yscp-bridge cwd=安裝根 → 統一寫入 app/data */
const resolveDataDir = (): string => {
  const cwd = process.cwd();
  if (existsSync(path.join(cwd, "app", "server.js"))) {
    return path.join(cwd, "app", "data");
  }
  return path.join(cwd, "data");
};

const getStorePath = (): string =>
  path.join(resolveDataDir(), "kiosk-license.json");

const ALLOWED = new Set<string>(KIOSK_FEATURE_KEYS);

const emptyState = (): KioskLicenseState => ({
  features: [],
  serialNumber: null,
  licenseKey: null,
  activationMethod: null,
  deviceFingerprint: null,
  updatedAt: null,
});

const parseString = (value: unknown): string | null => {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
};

const filterFeatures = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const key = item.trim();
    if (!ALLOWED.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
};

const mergeFeatureLists = (a: string[], b: string[]): string[] =>
  filterFeatures([...a, ...b]);

const readStore = async (): Promise<KioskLicenseState> => {
  try {
    const raw = await readFile(getStorePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<KioskLicenseState>;
    return {
      features: filterFeatures(parsed.features),
      serialNumber: parseString(parsed.serialNumber),
      licenseKey: parseString(parsed.licenseKey),
      activationMethod: parseString(parsed.activationMethod),
      deviceFingerprint: parseString(parsed.deviceFingerprint),
      updatedAt: parseString(parsed.updatedAt),
    };
  } catch {
    return emptyState();
  }
};

const writeStore = async (state: KioskLicenseState): Promise<void> => {
  const storePath = getStorePath();
  const temporary = `${storePath}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(storePath), { recursive: true });
  try {
    await writeFile(temporary, JSON.stringify(state, null, 2), "utf8");
    await rename(temporary, storePath);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
};

export const getLicenseState = async (opts?: {
  /** 讀本機檔（略過 open_all 合成；啟用／副 LK 合併用） */
  real?: boolean;
}): Promise<KioskLicenseState> => {
  if (!opts?.real && getConfig().license.openAllFeatures) {
    return {
      ...emptyState(),
      features: [VISITOR_FEATURE_KEY],
      activationMethod: "open_all",
    };
  }

  return readStore();
};

export type SetLicenseStateOpts = {
  features?: string[];
  mergeFeatures?: boolean;
  serialNumber?: string | null;
  licenseKey?: string | null;
  /** 副 LK：保留既有主 LK */
  preserveMainLicenseKey?: boolean;
  deviceFingerprint?: string | null;
  activationMethod?: string | null;
};

export const setLicenseState = async (
  opts: SetLicenseStateOpts = {},
): Promise<KioskLicenseState> => {
  // 寫入一律以本機檔為準（略過 open_all 合成狀態）
  const base = await readStore();

  let nextFeatures = base.features;
  if (opts.features !== undefined) {
    nextFeatures = opts.mergeFeatures
      ? mergeFeatureLists(base.features, opts.features)
      : filterFeatures(opts.features);
  }

  const next: KioskLicenseState = {
    features: nextFeatures,
    serialNumber:
      opts.serialNumber !== undefined
        ? parseString(opts.serialNumber)
        : base.serialNumber,
    licenseKey: opts.preserveMainLicenseKey
      ? base.licenseKey
      : opts.licenseKey !== undefined
        ? parseString(opts.licenseKey)
        : base.licenseKey,
    activationMethod:
      opts.activationMethod !== undefined
        ? parseString(opts.activationMethod)
        : base.activationMethod,
    deviceFingerprint:
      opts.deviceFingerprint !== undefined
        ? parseString(opts.deviceFingerprint)
        : base.deviceFingerprint,
    updatedAt: new Date().toISOString(),
  };

  await writeStore(next);
  return next;
};

export const isVisitorLicensed = async (): Promise<boolean> => {
  const state = await getLicenseState();
  return state.features.includes(VISITOR_FEATURE_KEY);
};

/** bridge／status 用精簡欄位 */
export const toLicenseSummary = (state: KioskLicenseState) => ({
  licensed: state.features.includes(VISITOR_FEATURE_KEY),
  serialNumber: state.serialNumber,
  activationMethod: state.activationMethod,
});
