const toBoolean = (raw: string | undefined, fallback: boolean): boolean => {
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
};

const toPositiveInt = (
  raw: string | undefined,
  fallback: number,
): number => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

/** 允許 `192.168.2.2` 或 `192.168.2.2:443` */
export const parseHcpHost = (
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
    port: Number.isFinite(port) ? port : undefined,
  };
};

export type AppConfig = {
  hcp: {
    hostname: string;
    port: number;
    baseUrl: string;
    accessKey: string;
    secretKey: string;
    rejectUnauthorized: boolean;
    timeoutMs: number;
  };
};

export const getConfig = (): AppConfig => {
  const parsed = parseHcpHost(process.env.HCP_HOST || "127.0.0.1");
  const port = toPositiveInt(process.env.HCP_PORT, parsed.port ?? 443);
  const hostname = parsed.hostname;

  return {
    hcp: {
      hostname,
      port,
      baseUrl: `https://${hostname}${port === 443 ? "" : `:${port}`}`,
      accessKey: String(process.env.HCP_AK ?? "").trim(),
      secretKey: String(process.env.HCP_SK ?? "").trim(),
      rejectUnauthorized: toBoolean(
        process.env.HCP_REJECT_UNAUTHORIZED,
        false,
      ),
      timeoutMs: toPositiveInt(process.env.HCP_TIMEOUT_MS, 30000),
    },
  };
};
