/**
 * YSCP JSON bridge for YSOP Kiosk (desktop).
 * Stdout: single JSON object. Stderr: human messages.
 *
 * Usage (from portable root or repo root):
 *   node tools/yscp-bridge.cjs --root <dir> <command> [...]
 *   npx tsx scripts/yscp-bridge.ts --root <dir> <command> [...]
 *
 * Commands:
 *   status | lan-ips | save-connection | cameras | relays | save-lanes
 *   subscribe | open
 */
import { randomBytes } from "crypto";
import { existsSync } from "fs";
import path from "path";
import {
  buildYscpEventDest,
  extractYscpHostIpv4,
  getConfig,
  getKioskListenPort,
} from "../src/lib/config";
import type { ExitLane } from "../src/lib/kiosk/exit-lanes";
import { ensureEventSubscription } from "../src/lib/yscp/event-api";
import {
  isLikelyLprCamera,
  listAlarmOutputs,
  listCameras,
  pulseAlarmOutput,
} from "../src/lib/yscp/exit-gate";
import {
  listLanIps,
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

const newEventToken = () => randomBytes(24).toString("hex");

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
    const hasCredentials = Boolean(cfg.yscp.accessKey && cfg.yscp.secretKey);
    emit({
      ok: true,
      hasCredentials,
      host: cfg.yscp.hostname,
      port: cfg.yscp.port,
      listenPort: cfg.kiosk.listenPort,
      accessKey: cfg.yscp.accessKey,
      secretKey: cfg.yscp.secretKey,
      eventDest: cfg.yscp.eventDest,
      eventToken: cfg.yscp.eventToken,
      firewallSourceIp: cfg.yscp.firewallSourceIp,
      adminIps: cfg.kiosk.adminIps,
      exitLaneCount: cfg.yscp.exitLanes.length,
      exitLanes: cfg.yscp.exitLanes,
    });
    return;
  }

  if (command === "lan-ips") {
    const ips = listLanIps();
    const listenPort = getKioskListenPort();
    emit({
      ok: true,
      ips,
      listenPort,
      dests: ips.map((ip) => buildYscpEventDest(ip, listenPort)),
      currentDest: process.env.YSCP_EVENT_DEST ?? "",
    });
    return;
  }

  if (command === "save-connection") {
    const host = String(flags.host ?? "").trim();
    const ak = String(flags.ak ?? "").trim();
    const sk = String(flags.sk ?? "").trim();
    const eventDest = String(flags["event-dest"] ?? flags.eventDest ?? "").trim();
    const adminIps = String(flags["admin-ips"] ?? flags.adminIps ?? "").trim();
    const firewallSourceIp = extractYscpHostIpv4(host);

    const portFlag = String(flags.port ?? "").trim();
    const listenPort = portFlag
      ? parseListenPort(portFlag)
      : getKioskListenPort();

    let token = String(flags.token ?? process.env.YSCP_EVENT_TOKEN ?? "").trim();
    if (!token) token = newEventToken();

    if (!host) fail("HOST 必填");
    if (!ak || !sk) fail("請填入 YSCP_AK／YSCP_SK");
    if (!eventDest) fail("缺少 event-dest（YSCP_EVENT_DEST）");
    if (!firewallSourceIp) {
      fail("YSCP_HOST 須為 IPv4（防火牆來源＝HOST）");
    }

    if (!existsSync(envPath)) writeUtf8(envPath, "");
    upsertEnvLine(envPath, "YSCP_HOST", host);
    upsertEnvLine(envPath, "YSCP_AK", ak);
    upsertEnvLine(envPath, "YSCP_SK", sk);
    upsertEnvLine(envPath, "YSCP_EVENT_DEST", eventDest);
    upsertEnvLine(envPath, "YSCP_EVENT_TOKEN", token);
    upsertEnvLine(envPath, "KIOSK_ADMIN_IPS", adminIps);
    upsertEnvLine(envPath, "PORT", String(listenPort));
    upsertEnvLine(envPath, "HOSTNAME", process.env.HOSTNAME || "0.0.0.0");
    removeEnvLine(envPath, "YSCP_SOURCE_IP");
    removeEnvLine(envPath, "YSCP_TLS_INSECURE");
    emit({
      ok: true,
      envPath,
      host,
      eventDest,
      listenPort,
      firewallSourceIp,
      adminIps,
    });
    return;
  }

  if (command === "cameras") {
    const { accessKey, secretKey } = getConfig().yscp;
    if (!accessKey || !secretKey) fail("尚未設定 YSCP_AK / YSCP_SK");
    const cams = await listCameras();
    emit({
      ok: true,
      cameras: cams.map((c) => ({
        cameraIndexCode: c.cameraIndexCode,
        cameraName: c.cameraName,
        encodeDevIndexCode: c.encodeDevIndexCode,
        likelyLpr: isLikelyLprCamera(c),
        status: c.status ?? null,
      })),
    });
    return;
  }

  if (command === "relays") {
    const dev = String(flags.dev ?? "").trim();
    if (!dev) fail("請提供 --dev <encodeDevIndexCode>");
    const { accessKey, secretKey } = getConfig().yscp;
    if (!accessKey || !secretKey) fail("尚未設定 YSCP_AK / YSCP_SK");
    const relays = await listAlarmOutputs(dev);
    emit({
      ok: true,
      relays: relays.map((r) => ({
        alarmOutputIndexCode: r.alarmOutputIndexCode,
        alarmOutputName: r.alarmOutputName,
        devIndexCode: r.devIndexCode,
      })),
    });
    return;
  }

  if (command === "save-lanes") {
    const raw = String(flags.json ?? flags.lanes ?? "").trim();
    if (!raw) fail("請提供 --json <ExitLane[]>");
    let lanes: ExitLane[];
    try {
      lanes = JSON.parse(raw) as ExitLane[];
    } catch {
      fail("lanes JSON 無法解析");
      return;
    }
    if (!Array.isArray(lanes) || lanes.length === 0) fail("至少一組出口車道");
    for (const lane of lanes) {
      if (!lane?.cameraIndexCode || !lane?.alarmOutputIndexCode) {
        fail("每組車道需 cameraIndexCode 與 alarmOutputIndexCode");
      }
    }
    if (!existsSync(envPath)) writeUtf8(envPath, "");
    upsertEnvLine(envPath, "YSCP_EXIT_LANES", JSON.stringify(lanes));
    emit({ ok: true, exitLanes: lanes });
    return;
  }

  if (command === "subscribe") {
    const { accessKey, secretKey } = getConfig().yscp;
    if (!accessKey || !secretKey) fail("尚未設定 YSCP_AK / YSCP_SK");
    const result = await ensureEventSubscription();
    if (result.skipped) fail(result.reason || "無法訂閱");
    emit({
      ok: true,
      eventDest: result.eventDest,
      data: result.data ?? null,
    });
    return;
  }

  if (command === "open") {
    const relay = String(flags.relay ?? "").trim();
    if (!relay) fail("請提供 --relay <alarmOutputIndexCode>");
    if (flags.yes !== true) fail("開閘測試需加上 --yes");
    const { holdMs } = await pulseAlarmOutput({ alarmOutputIndexCode: relay });
    emit({ ok: true, relay, holdMs });
    return;
  }

  fail(`未知命令: ${command}`);
};

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
