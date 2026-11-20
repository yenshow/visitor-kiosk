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
 */
import { existsSync } from "fs";
import path from "path";
import { getConfig, getKioskListenPort } from "../src/lib/config";
import {
  loadDotEnv,
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
    emit({
      ok: true,
      listenPort: cfg.kiosk.listenPort,
      adminIps: cfg.kiosk.adminIps,
      allowPublicBooking: envFlagTrue("KIOSK_ALLOW_PUBLIC_BOOKING"),
    });
    return;
  }

  if (command === "save-service") {
    const adminIps = String(flags["admin-ips"] ?? flags.adminIps ?? "").trim();
    const portFlag = String(flags.port ?? "").trim();
    const listenPort = portFlag
      ? parseListenPort(portFlag)
      : getKioskListenPort();
    const allowPublic =
      flags["allow-public"] === true ||
      flags["allow-public"] === "1" ||
      flags["allow-public"] === "true" ||
      flags.allowPublic === true ||
      flags.allowPublic === "1" ||
      flags.allowPublic === "true";

    if (!existsSync(envPath)) writeUtf8(envPath, "");
    upsertEnvLine(envPath, "KIOSK_ADMIN_IPS", adminIps);
    upsertEnvLine(envPath, "PORT", String(listenPort));
    upsertEnvLine(envPath, "HOSTNAME", process.env.HOSTNAME || "0.0.0.0");
    upsertEnvLine(
      envPath,
      "KIOSK_ALLOW_PUBLIC_BOOKING",
      allowPublic ? "1" : "0",
    );
    // 清掉舊版殘留鍵（YSCP／授權）
    for (const key of [
      "YSCP_HOST",
      "YSCP_AK",
      "YSCP_SK",
      "YSCP_EVENT_DEST",
      "YSCP_EVENT_TOKEN",
      "YSCP_EXIT_LANES",
      "YSCP_SOURCE_IP",
      "YSCP_TLS_INSECURE",
      "YSCP_EXIT_GATE_MINUTES",
      "LICENSE_PLATFORM_API_BASE_URL",
      "LICENSE_SIGN_SECRET",
      "LICENSE_OPEN_ALL_FEATURES",
      "LICENSE_PLATFORM_TIMEOUT_MS",
    ]) {
      removeEnvLine(envPath, key);
    }
    emit({
      ok: true,
      envPath,
      listenPort,
      adminIps,
      allowPublicBooking: allowPublic,
    });
    return;
  }

  fail(`未知命令: ${command}`);
};

const envFlagTrue = (key: string): boolean => {
  const v = String(process.env[key] ?? "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes";
};

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
