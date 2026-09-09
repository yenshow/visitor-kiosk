import {
  parseExitLanes,
  type ExitLane,
} from "@/lib/kiosk/exit-lanes";

export const YSCP_HTTPS_PORT = 443;
export const YSCP_TIMEOUT_MS = 30_000;
export const YSCP_GATE_DEDUP_MS = 5_000;
export const YSCP_REJECT_UNAUTHORIZED = false;
export const YSCP_EVENT_TOKEN_DEFAULT = "Aa83124007";
export const KIOSK_LISTEN_PORT = 3010;
export const YSCP_EVENT_WEBHOOK_PATH = "/api/yscp/events";

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

export type AppConfig = {
  yscp: {
    hostname: string;
    port: number;
    baseUrl: string;
    accessKey: string;
    secretKey: string;
    rejectUnauthorized: boolean;
    timeoutMs: number;
    eventDest: string;
    eventToken: string;
    exitLanes: ExitLane[];
    gateDedupMs: number;
  };
};

export const getConfig = (): AppConfig => {
  const parsed = parseYscpHost(env("YSCP_HOST") || "127.0.0.1");
  const port = parsed.port ?? YSCP_HTTPS_PORT;
  const hostname = parsed.hostname;

  return {
    yscp: {
      hostname,
      port,
      baseUrl: `https://${hostname}${port === 443 ? "" : `:${port}`}`,
      accessKey: env("YSCP_AK"),
      secretKey: env("YSCP_SK"),
      rejectUnauthorized: YSCP_REJECT_UNAUTHORIZED,
      timeoutMs: YSCP_TIMEOUT_MS,
      eventDest: env("YSCP_EVENT_DEST"),
      eventToken: env("YSCP_EVENT_TOKEN") || YSCP_EVENT_TOKEN_DEFAULT,
      exitLanes: parseExitLanes(env("YSCP_EXIT_LANES")),
      gateDedupMs: YSCP_GATE_DEDUP_MS,
    },
  };
};
