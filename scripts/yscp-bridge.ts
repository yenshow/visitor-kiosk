/**
 * Kiosk JSON bridge for YSOP Kiosk (desktop).
 * Stdout: single JSON object. Stderr: human messages.
 *
 * Usage (from portable root or repo root):
 *   node tools/yscp-bridge.cjs --root <dir> <command> [...]
 *   npx tsx scripts/yscp-bridge.ts --root <dir> <command> [...]
 *
 * Commands:
 *   status | save-service
 *   license-activate | license-offline-request | license-offline-import
 */
import { existsSync } from "fs";
import path from "path";
import { getConfig, getKioskListenPort } from "../src/lib/config";
import {
  activateLicenseByKey,
  buildOfflineRequestBase64,
  importOfflineLicensePayload,
} from "../src/lib/license/activate-service";
import { LicensePlatformError } from "../src/lib/license/platform";
import {
  getLicenseState,
  toLicenseSummary,
} from "../src/lib/license/store";
import {
  loadDotEnv,
  readUtf8,
  removeEnvLine,
  upsertEnvLine,
  writeUtf8,
} from "./env-file";

type Json = Record<string, unknown>;

const emit = (obj: Json) => {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
};

const fail = (message: string, code = 1): never => {
  emit({ ok: false, error: message });
  process.exit(code);
};

const parseArgs = (argv: string[]) => {
  const args = argv.slice(2);
  let root = "";
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--root") {
      root = String(args[++i] ?? "").trim();
      continue;
    }
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith("--")) flags[key] = true;
      else {
        flags[key] = next;
        i += 1;
      }
      continue;
    }
    positional.push(token);
  }
  return { root, command: positional[0] || "status", flags };
};

const resolveHere = (): string => {
  const dirname = (globalThis as { __dirname?: string }).__dirname;
  if (dirname) return dirname;
  return process.cwd();
};

const resolveRoot = (raw: string): string => {
  if (raw) return path.resolve(raw);
  const here = resolveHere();
  if (path.basename(here) === "scripts") return path.resolve(here, "..");
  if (path.basename(here) === "tools") return path.resolve(here, "..");
  return process.cwd();
};

const resolveEnvPath = (root: string): string => {
  const portable = path.join(root, "app", ".env");
  if (existsSync(portable) || existsSync(path.join(root, "app", "server.js"))) {
    return portable;
  }
  return path.join(root, ".env");
};

const parseListenPort = (raw: string): number => {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    fail("服務埠須為 1–65535");
  }
  return Math.floor(n);
};

const main = async () => {
  const { root: rootArg, command, flags } = parseArgs(process.argv);
  const root = resolveRoot(rootArg);
  const envPath = resolveEnvPath(root);
  if (!existsSync(path.dirname(envPath))) {
    fail(`找不到環境目錄：${path.dirname(envPath)}`);
  }
  loadDotEnv(envPath, { override: true });

  if (command === "status") {
    const cfg = getConfig();
    const license = toLicenseSummary(await getLicenseState());
    emit({
      ok: true,
      licensed: license.licensed,
      licenseKey: license.licenseKey,
      serialNumber: license.serialNumber,
      activationMethod: license.activationMethod,
      listenPort: cfg.kiosk.listenPort,
      adminIps: cfg.kiosk.adminIps,
    });
    return;
  }

  if (command === "save-service") {
    const adminIps = String(flags["admin-ips"] ?? flags.adminIps ?? "").trim();
    const portFlag = String(flags.port ?? "").trim();
    const listenPort = portFlag
      ? parseListenPort(portFlag)
      : getKioskListenPort();

    if (!existsSync(envPath)) writeUtf8(envPath, "");
    upsertEnvLine(envPath, "KIOSK_ADMIN_IPS", adminIps);
    upsertEnvLine(envPath, "PORT", String(listenPort));
    upsertEnvLine(envPath, "HOSTNAME", process.env.HOSTNAME || "0.0.0.0");
    removeEnvLine(envPath, "YSCP_HOST");
    removeEnvLine(envPath, "YSCP_AK");
    removeEnvLine(envPath, "YSCP_SK");
    removeEnvLine(envPath, "YSCP_EVENT_DEST");
    removeEnvLine(envPath, "YSCP_EVENT_TOKEN");
    removeEnvLine(envPath, "YSCP_EXIT_LANES");
    removeEnvLine(envPath, "YSCP_SOURCE_IP");
    removeEnvLine(envPath, "YSCP_TLS_INSECURE");
    removeEnvLine(envPath, "YSCP_EXIT_GATE_MINUTES");
    emit({
      ok: true,
      envPath,
      listenPort,
      adminIps,
    });
    return;
  }

  if (command === "license-activate") {
    const key = String(flags.key ?? flags.licenseKey ?? "").trim();
    if (!key) fail("請提供 --key <License Key>");
    try {
      const state = await activateLicenseByKey(key);
      emit({ ok: true, ...toLicenseSummary(state) });
    } catch (error) {
      if (error instanceof LicensePlatformError) {
        fail(error.message);
      }
      fail(error instanceof Error ? error.message : "授權啟用失敗");
    }
    return;
  }

  if (command === "license-offline-request") {
    const key = String(flags.key ?? flags.licenseKey ?? "").trim();
    if (!key) fail("請提供 --key <License Key>");
    try {
      const requestFileBase64 = buildOfflineRequestBase64(key);
      emit({ ok: true, requestFileBase64 });
    } catch (error) {
      fail(error instanceof Error ? error.message : "產生請求檔失敗");
    }
    return;
  }

  if (command === "license-offline-import") {
    const filePath = String(flags.file ?? "").trim();
    const rawJson = String(flags.json ?? "").trim();
    let payload: unknown;
    try {
      if (filePath) {
        payload = JSON.parse(readUtf8(filePath));
      } else if (rawJson) {
        payload = JSON.parse(rawJson);
      } else {
        fail("請提供 --file <回應檔> 或 --json <payload>");
      }
    } catch {
      fail("離線授權檔不是有效 JSON");
    }
    try {
      const state = await importOfflineLicensePayload(payload);
      emit({ ok: true, ...toLicenseSummary(state) });
    } catch (error) {
      fail(error instanceof Error ? error.message : "匯入失敗");
    }
    return;
  }

  fail(`未知命令: ${command}`);
};

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
