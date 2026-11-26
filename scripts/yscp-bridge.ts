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
import { parseAdminIps } from "../src/lib/kiosk/access";
import {
  activateLicenseByKey,
  buildOfflineRequestBase64,
  importOfflineLicensePayload,
} from "../src/lib/license/activate-service";
import { getLicenseState, toLicenseSummary } from "../src/lib/license/store";
import {
  loadDotEnv,
  readUtf8,
  updateEnvFile,
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
      if (next === undefined || next.startsWith("--")) flags[key] = true;
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

const parsePublicBookingUrl = (raw: string | boolean): string => {
  if (typeof raw !== "string") return fail("請提供外部預約網址或留空");
  const value = raw.trim();
  if (!value) return "";
  const error = "請輸入完整的 HTTP 或 HTTPS 外部預約網址";
  if (!/^https?:\/\/[^/]/i.test(value) || /[\s\\]/.test(value)) {
    return fail(error);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(error);
  }
  return url.username || url.password ? fail(error) : url.href;
};

const main = async () => {
  const { root: rootArg, command, flags } = parseArgs(process.argv);
  const root = resolveRoot(rootArg);
  const envPath = resolveEnvPath(root);
  if (!existsSync(path.dirname(envPath))) {
    fail(`找不到環境目錄：${path.dirname(envPath)}`);
  }
  loadDotEnv(envPath, { override: true });
  const responseFile = typeof flags.file === "string" ? path.resolve(flags.file) : "";
  process.chdir(root);

  if (command === "status") {
    const cfg = getConfig();
    emit({
      ok: true,
      ...toLicenseSummary(await getLicenseState()),
      listenPort: cfg.kiosk.listenPort,
      adminIps: cfg.kiosk.adminIps,
      publicBookingUrl: process.env.KIOSK_PUBLIC_BOOKING_URL?.trim() ?? "",
    });
    return;
  }

  if (command === "save-service") {
    const adminIps = parseAdminIps(String(flags["admin-ips"] ?? flags.adminIps ?? "")).join(",");
    const portFlag = String(flags.port ?? "").trim();
    const listenPort = portFlag
      ? parseListenPort(portFlag)
      : getKioskListenPort();
    const publicBookingUrl = flags["public-booking-url"] === undefined
      ? undefined
      : parsePublicBookingUrl(flags["public-booking-url"]);

    updateEnvFile(envPath, {
      KIOSK_ADMIN_IPS: adminIps,
      PORT: String(listenPort),
      HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
      ...(publicBookingUrl === undefined ? {} : { KIOSK_PUBLIC_BOOKING_URL: publicBookingUrl || null }),
      KIOSK_ALLOW_PUBLIC_BOOKING: null,
      YSCP_HOST: null,
      YSCP_AK: null,
      YSCP_SK: null,
      YSCP_EVENT_DEST: null,
      YSCP_EVENT_TOKEN: null,
      YSCP_EXIT_LANES: null,
      YSCP_SOURCE_IP: null,
      YSCP_TLS_INSECURE: null,
      YSCP_EXIT_GATE_MINUTES: null,
    });
    emit({
      ok: true,
      envPath,
      listenPort,
      adminIps,
      publicBookingUrl: publicBookingUrl ?? process.env.KIOSK_PUBLIC_BOOKING_URL?.trim() ?? "",
    });
    return;
  }

  if (command === "license-activate" || command === "license-offline-request") {
    const key = flags.key ?? flags.licenseKey;
    if (typeof key !== "string" || !key.trim()) {
      return fail("請提供 --key <License Key>");
    }
    if (command === "license-activate") {
      emit({ ok: true, ...toLicenseSummary(await activateLicenseByKey(key)) });
    } else {
      emit({ ok: true, requestFileBase64: buildOfflineRequestBase64(key) });
    }
    return;
  }

  if (command === "license-offline-import") {
    const rawJson = typeof flags.json === "string" ? flags.json : "";
    if (!responseFile && !rawJson) return fail("請提供 --file <回應檔> 或 --json <payload>");
    const raw = responseFile ? readUtf8(responseFile) : rawJson;
    let payload: unknown;
    try {
      payload = JSON.parse(raw.replace(/^\uFEFF/, ""));
    } catch {
      return fail("離線授權檔不是有效 JSON");
    }
    emit({ ok: true, ...toLicenseSummary(await importOfflineLicensePayload(payload)) });
    return;
  }

  fail(`未知命令: ${command}`);
};

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
