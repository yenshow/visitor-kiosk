import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import os from "os";

/** Node UTF-8 讀寫，避免 Windows PowerShell 系統碼頁弄亂中文 */
export const readUtf8 = (filePath: string): string =>
  readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");

const writeUtf8 = (filePath: string, text: string) => {
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

export const updateEnvFile = (
  envPath: string,
  changes: Record<string, string | null>,
) => {
  const previous = existsSync(envPath) ? readUtf8(envPath) : "";
  const lines = previous.split(/\r?\n/).filter((line) => {
    const key = /^\s*([\w]+)\s*=/.exec(line)?.[1];
    return !key || !Object.hasOwn(changes, key);
  });
  const updated = Object.entries(changes).flatMap(([key, value]) =>
    value === null ? [] : [`${key}=${value}`],
  );
  const newline = previous.includes("\r\n") ? "\r\n" : "\n";
  const body = lines.join(newline).trimEnd();
  writeUtf8(envPath, [...(body ? [body] : []), ...updated, ""].join(newline));
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
