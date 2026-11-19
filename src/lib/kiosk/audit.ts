import { appendFile, mkdir, rename, stat } from "fs/promises";
import path from "path";
import { toTaipeiIso } from "@/lib/kiosk/api-helpers";

const MAX_BYTES = 2 * 1024 * 1024;

/** 與 kiosk-presence.json 同目錄（cwd/data） */
const DATA_DIR = path.join(process.cwd(), "data");
const AUDIT_PATH = path.join(DATA_DIR, "audit.log");

export type AuditResult = "ok" | "deny" | "error";

export type AuditEntry = {
  action: string;
  result: AuditResult;
  ip?: string;
  detail?: string;
};

const rotateIfNeeded = async (filePath: string) => {
  try {
    const info = await stat(filePath);
    if (info.size < MAX_BYTES) return;
    await rename(filePath, `${filePath}.1`);
  } catch {
    // 不存在或無法 rotate
  }
};

/** JSON Lines；不含個資／金鑰；與訪客紀錄同放 data/ */
export const writeAudit = async (entry: AuditEntry): Promise<void> => {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await rotateIfNeeded(AUDIT_PATH);
    const line = JSON.stringify({
      at: toTaipeiIso(new Date()),
      action: entry.action,
      result: entry.result,
      ...(entry.ip ? { ip: entry.ip } : {}),
      ...(entry.detail
        ? { detail: String(entry.detail).slice(0, 200) }
        : {}),
    });
    await appendFile(AUDIT_PATH, `${line}\n`, "utf8");
  } catch (error) {
    console.error(
      "[audit] 寫入失敗",
      error instanceof Error ? error.message : error,
    );
  }
};
