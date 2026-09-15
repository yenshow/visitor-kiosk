import { appendFile, mkdir, rename, stat } from "fs/promises";
import path from "path";
import { toTaipeiIso } from "@/lib/kiosk/api-helpers";

const MAX_BYTES = 2 * 1024 * 1024;

export type AuditResult = "ok" | "deny" | "error";

export type AuditEntry = {
  action: string;
  result: AuditResult;
  ip?: string;
  detail?: string;
};

/** portable：cwd=app → ../runtime；本機 dev：cwd=專案根 → ./runtime */
const resolveAuditPath = async (): Promise<string> => {
  const portable = path.join(process.cwd(), "..", "runtime");
  const local = path.join(process.cwd(), "runtime");
  try {
    await mkdir(portable, { recursive: true });
    return path.join(portable, "audit.log");
  } catch {
    await mkdir(local, { recursive: true });
    return path.join(local, "audit.log");
  }
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

/** JSON Lines；不含個資／金鑰 */
export const writeAudit = async (entry: AuditEntry): Promise<void> => {
  try {
    const filePath = await resolveAuditPath();
    await rotateIfNeeded(filePath);
    const line = JSON.stringify({
      at: toTaipeiIso(new Date()),
      action: entry.action,
      result: entry.result,
      ...(entry.ip ? { ip: entry.ip } : {}),
      ...(entry.detail
        ? { detail: String(entry.detail).slice(0, 200) }
        : {}),
    });
    await appendFile(filePath, `${line}\n`, "utf8");
  } catch (error) {
    console.error(
      "[audit] 寫入失敗",
      error instanceof Error ? error.message : error,
    );
  }
};
