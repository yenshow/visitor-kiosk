import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  DEFAULT_THEME,
  normalizeTheme,
  type KioskTheme,
} from "@/lib/kiosk/theme";
import { DEFAULT_MARQUEE } from "@/lib/kiosk/ui-constants";
import { isValidEmail } from "@/lib/kiosk/visitor-fields";

export type KioskSettings = {
  marquee: string;
  showAppoint: boolean;
  theme: KioskTheme;
  /** 自訂 logo 檔名（位於 data/）；空字串表示使用預設 public logo */
  logoFileName: string;
  /** 現場預約待核准時同步通知的信箱（空＝不寄） */
  approverEmails: string[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "kiosk-settings.json");

const LOGO_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const APPROVER_EMAILS_MAX = 20;

const emptySettings = (): KioskSettings => ({
  marquee: "",
  showAppoint: true,
  theme: DEFAULT_THEME,
  logoFileName: "",
  approverEmails: [],
});

/** 去空白、驗證格式、去重（不分大小寫）、上限 APPROVER_EMAILS_MAX */
export const normalizeApproverEmails = (raw: unknown): string[] => {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\n,;]+/)
      : [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list) {
    const email = String(item ?? "").trim();
    if (!email || !isValidEmail(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(email);
    if (result.length >= APPROVER_EMAILS_MAX) break;
  }
  return result;
};

let writeChain: Promise<void> = Promise.resolve();

const readStore = async (): Promise<KioskSettings> => {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<KioskSettings>;
    return {
      marquee: typeof parsed.marquee === "string" ? parsed.marquee : "",
      showAppoint:
        typeof parsed.showAppoint === "boolean" ? parsed.showAppoint : true,
      theme: normalizeTheme(parsed.theme),
      logoFileName:
        typeof parsed.logoFileName === "string" ? parsed.logoFileName : "",
      approverEmails: normalizeApproverEmails(parsed.approverEmails),
    };
  } catch {
    return emptySettings();
  }
};

const writeStore = async (store: KioskSettings): Promise<void> => {
  writeChain = writeChain.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  });
  await writeChain;
};

const safeUnlink = async (filePath: string | null) => {
  if (!filePath) return;
  try {
    await unlink(filePath);
  } catch {
    // ignore
  }
};

export const getSettings = async (): Promise<KioskSettings> => readStore();

export const updateSettings = async (
  patch: Partial<
    Pick<KioskSettings, "marquee" | "showAppoint" | "theme" | "approverEmails">
  >,
): Promise<KioskSettings> => {
  const current = await readStore();
  const next: KioskSettings = {
    ...current,
    ...(typeof patch.marquee === "string" ? { marquee: patch.marquee } : {}),
    ...(typeof patch.showAppoint === "boolean"
      ? { showAppoint: patch.showAppoint }
      : {}),
    ...(patch.theme === "light" || patch.theme === "dark"
      ? { theme: patch.theme }
      : {}),
    ...(Array.isArray(patch.approverEmails)
      ? { approverEmails: normalizeApproverEmails(patch.approverEmails) }
      : {}),
  };
  await writeStore(next);
  return next;
};

/** 畫面用跑馬燈：本機設定 → 寫死預設 */
export const resolveMarquee = (settings: KioskSettings): string =>
  settings.marquee.trim() || DEFAULT_MARQUEE;

export const getLogoAbsolutePath = (
  logoFileName: string,
): string | null => {
  const name = String(logoFileName ?? "").trim();
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }
  return path.join(DATA_DIR, name);
};

export const getLogoContentType = (logoFileName: string): string =>
  LOGO_BY_EXT[path.extname(logoFileName).toLowerCase()] ||
  "application/octet-stream";

export const extensionForMime = (mime: string): string | null => {
  const normalized = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  return EXT_BY_MIME[normalized] ?? null;
};

export const extensionFromFileName = (name: string): string | null => {
  const match = /\.(png|jpe?g|svg|webp)$/i.exec(name);
  if (!match) return null;
  const ext = match[0].toLowerCase();
  return ext === ".jpeg" ? ".jpg" : ext;
};

export const saveCustomLogo = async (
  buffer: Buffer,
  extension: string,
): Promise<KioskSettings> => {
  const ext = extension.toLowerCase();
  if (!LOGO_BY_EXT[ext]) throw new Error("僅支援 PNG、JPG、SVG、WebP");
  if (buffer.length > LOGO_MAX_BYTES) {
    throw new Error("Logo 檔案不可超過 2MB");
  }

  const fileName = `kiosk-logo${ext}`;
  const target = path.join(DATA_DIR, fileName);
  const temp = path.join(DATA_DIR, `${fileName}.tmp`);

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(temp, buffer);
  await rename(temp, target);

  const current = await readStore();
  if (current.logoFileName && current.logoFileName !== fileName) {
    await safeUnlink(getLogoAbsolutePath(current.logoFileName));
  }

  const next: KioskSettings = { ...current, logoFileName: fileName };
  await writeStore(next);
  return next;
};

export const clearCustomLogo = async (): Promise<KioskSettings> => {
  const current = await readStore();
  await safeUnlink(getLogoAbsolutePath(current.logoFileName));
  const next: KioskSettings = { ...current, logoFileName: "" };
  await writeStore(next);
  return next;
};

/** API 回傳給前端的設定視圖 */
export const toSettingsView = (settings: KioskSettings) => ({
  marquee: settings.marquee,
  resolvedMarquee: resolveMarquee(settings),
  showAppoint: settings.showAppoint,
  theme: settings.theme,
  hasCustomLogo: Boolean(settings.logoFileName),
  logoUrl: settings.logoFileName
    ? `/api/kiosk/settings/logo?v=${encodeURIComponent(settings.logoFileName)}`
    : "/yenshow-logo.svg",
  approverEmails: settings.approverEmails,
});
