/** 由 tools/with-client-ip.cjs 注入的連線 IP */
const REAL_IP_HEADER = "x-real-ip";

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost", "0:0:0:0:0:0:0:1"]);

const normalizeIp = (raw: string): string => {
  let ip = String(raw ?? "").trim().toLowerCase();
  if (!ip) return "";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
  return ip;
};

export const isLoopbackIp = (ip: string): boolean => {
  const n = normalizeIp(ip);
  if (!n) return false;
  if (LOOPBACK.has(n)) return true;
  return n.startsWith("127.");
};

export const parseAdminIps = (raw?: string): string[] => {
  const text = String(raw ?? process.env.KIOSK_ADMIN_IPS ?? "");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[\s,;]+/)) {
    const ip = normalizeIp(part);
    if (!ip || seen.has(ip)) continue;
    seen.add(ip);
    out.push(ip);
  }
  return out;
};

/**
 * 客戶端 IP：with-client-ip 注入的 x-real-ip → x-forwarded-for → 可選 fallback
 * （Next proxy 的 request.ip／開發時連線位址）
 */
export const getClientIp = (
  headers: Headers,
  fallbackIp?: string | null,
): string => {
  const real = normalizeIp(headers.get(REAL_IP_HEADER) ?? "");
  if (real) return real;

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = normalizeIp(xff.split(",")[0] ?? "");
    if (first) return first;
  }

  return normalizeIp(fallbackIp ?? "");
};

/** Host 為本機且尚無注入 IP（本機 dev）時視為 loopback */
export const isLocalHostHeader = (hostHeader: string | null): boolean => {
  const host = (hostHeader || "").split(":")[0].toLowerCase();
  return (
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "[::1]" ||
    host === "::1"
  );
};
