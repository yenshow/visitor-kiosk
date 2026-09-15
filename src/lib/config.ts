import {
  parseExitLanes,
  type ExitLane,
} from "@/lib/kiosk/exit-lanes";
import { EXIT_GATE_MINUTES_DEFAULT } from "@/lib/kiosk/ui-constants";

export const YSCP_HTTPS_PORT = 443;
export const YSCP_TIMEOUT_MS = 30_000;
export const YSCP_GATE_DEDUP_MS = 5_000;
/** 開閘後維持繼電器致能再送關閉（API 無自動脈衝） */
export const YSCP_RELAY_HOLD_MS = 2_000;
export const KIOSK_LISTEN_PORT_DEFAULT = 3010;
export const YSCP_EVENT_WEBHOOK_PATH = "/api/yscp/events";
/** 區網推送用 HTTP：YSCP 對 kiosk 自簽 HTTPS 常 SSL Handshake Failure */
export const YSCP_EVENT_DEST_SCHEME = "http";

export const getKioskListenPort = (): number => {
  const n = Number(String(process.env.PORT ?? "").trim());
  if (Number.isFinite(n) && n >= 1 && n <= 65535) return Math.floor(n);
  return KIOSK_LISTEN_PORT_DEFAULT;
};

export const buildYscpEventDest = (host: string, port?: number): string => {
  const listenPort = port ?? getKioskListenPort();
  return `${YSCP_EVENT_DEST_SCHEME}://${host}:${listenPort}${YSCP_EVENT_WEBHOOK_PATH}`;
};

const env = (key: string): string => String(process.env[key] ?? "").trim();

/** 允許 `192.168.2.2` 或 `192.168.2.2:443` */
const parseYscpHost = (
  raw: string,
): { hostname: string; port?: number } => {
  const cleaned = String(raw ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0];

  if (!cleaned) return { hostname: "127.0.0.1" };

  const [hostname, portPart] = cleaned.split(":");
  const port = portPart ? Number(portPart) : undefined;
  return {
    hostname: hostname || "127.0.0.1",
    port: Number.isFinite(port) && port && port > 0 ? port : undefined,
  };
};

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/** 防火牆來源＝YSCP_HOST 的 IPv4（可含 :埠） */
export const extractYscpHostIpv4 = (raw: string): string => {
  const { hostname } = parseYscpHost(raw);
  if (!IPV4_RE.test(hostname)) return "";
  const parts = hostname.split(".").map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return "";
  return hostname;
};

export const SMTP_HOST_DEFAULT = "smtp.office365.com";
export const SMTP_PORT_DEFAULT = 587;

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  /** 帳密齊備才可寄信 */
  configured: boolean;
};

export type AppConfig = {
  yscp: {
    hostname: string;
    port: number;
    baseUrl: string;
    accessKey: string;
    secretKey: string;
    /** 內網 YSCP 常為自簽；固定略過憑證驗證 */
    rejectUnauthorized: boolean;
    timeoutMs: number;
    eventDest: string;
    eventToken: string;
    exitLanes: ExitLane[];
    gateDedupMs: number;
    /** 離場開閘時限（分鐘） */
    exitGateMinutes: number;
    /** 防火牆用：取自 YSCP_HOST 的 IPv4 */
    firewallSourceIp: string;
  };
  kiosk: {
    listenPort: number;
    adminIps: string;
  };
  smtp: SmtpConfig;
};

const parsePositiveInt = (raw: string, fallback: number): number => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
};

export const getConfig = (): AppConfig => {
  const parsed = parseYscpHost(env("YSCP_HOST") || "127.0.0.1");
  const port = parsed.port ?? YSCP_HTTPS_PORT;
  const hostname = parsed.hostname;

  const smtpUser = env("SMTP_USER");
  const smtpPass = env("SMTP_PASS");
  const smtpFrom = env("MAIL_FROM") || smtpUser;

  return {
    yscp: {
      hostname,
      port,
      baseUrl: `https://${hostname}${port === 443 ? "" : `:${port}`}`,
      accessKey: env("YSCP_AK"),
      secretKey: env("YSCP_SK"),
      rejectUnauthorized: false,
      timeoutMs: YSCP_TIMEOUT_MS,
      eventDest: env("YSCP_EVENT_DEST"),
      eventToken: env("YSCP_EVENT_TOKEN"),
      exitLanes: parseExitLanes(env("YSCP_EXIT_LANES")),
      gateDedupMs: YSCP_GATE_DEDUP_MS,
      exitGateMinutes: parsePositiveInt(
        env("YSCP_EXIT_GATE_MINUTES"),
        EXIT_GATE_MINUTES_DEFAULT,
      ),
      firewallSourceIp: extractYscpHostIpv4(env("YSCP_HOST") || hostname),
    },
    kiosk: {
      listenPort: getKioskListenPort(),
      adminIps: env("KIOSK_ADMIN_IPS"),
    },
    smtp: {
      host: env("SMTP_HOST") || SMTP_HOST_DEFAULT,
      port: parsePositiveInt(env("SMTP_PORT"), SMTP_PORT_DEFAULT),
      user: smtpUser,
      pass: smtpPass,
      from: smtpFrom,
      configured: Boolean(smtpUser && smtpPass),
    },
  };
};
