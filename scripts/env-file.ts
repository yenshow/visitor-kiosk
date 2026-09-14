import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import os from "os";

/** Node UTF-8 讀寫，避免 Windows PowerShell 系統碼頁弄亂中文 */
export const readUtf8 = (filePath: string): string =>
  readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");

export const writeUtf8 = (filePath: string, text: string) => {
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, text.replace(/^\uFEFF/, ""), { encoding: "utf8" });
  renameSync(tmp, filePath);
};

export const loadDotEnv = (
  filePath: string,
  { override = false } = {},
) => {
  if (!existsSync(filePath)) return;
  for (const raw of readUtf8(filePath).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (override || !process.env[key]) process.env[key] = value;
  }
};

export const upsertEnvLine = (
  envPath: string,
  key: string,
  value: string,
) => {
  const line = `${key}=${value}`;
  let text = existsSync(envPath) ? readUtf8(envPath) : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  text = re.test(text)
    ? text.replace(re, line)
    : `${text.replace(/\s*$/, "")}\n${line}\n`;
  writeUtf8(envPath, text);
  process.env[key] = value;
};

export const listLanIps = (): string[] => {
  const ips: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      const family = String(addr.family);
      if (family !== "IPv4" && family !== "4") continue;
      if (addr.internal) continue;
      ips.push(addr.address);
    }
  }
  return ips;
};
