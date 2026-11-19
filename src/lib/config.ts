import { LICENSE_PLATFORM_API_DEFAULT } from "@/lib/license/constants";

export const KIOSK_LISTEN_PORT_DEFAULT = 3010;

export const getKioskListenPort = (): number => {
  const n = Number(String(process.env.PORT ?? "").trim());
  if (Number.isFinite(n) && n >= 1 && n <= 65535) return Math.floor(n);
  return KIOSK_LISTEN_PORT_DEFAULT;
};

const env = (key: string): string => String(process.env[key] ?? "").trim();

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

export type LicenseConfig = {
  /** 授權平台 API Base（至 /api/license 前綴），例如 https://api.yenshow.com/api/license */
  platformApiBaseUrl: string;
  platformTimeoutMs: number;
  /** 離線授權回應檔 HMAC 驗簽金鑰（與 BA 同一套才能驗同平台檔） */
  signSecret: string;
  /** 開發／測試：略過本機授權狀態，視為 visitor 已授權 */
  openAllFeatures: boolean;
};

export type AppConfig = {
  kiosk: {
    listenPort: number;
    adminIps: string;
  };
  smtp: SmtpConfig;
  license: LicenseConfig;
};

/** `1` / `true` / `yes` → true */
const envFlagTrue = (key: string): boolean => {
  const v = env(key).toLowerCase();
  return v === "1" || v === "true" || v === "yes";
};

const parsePositiveInt = (raw: string, fallback: number): number => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
};

export const getConfig = (): AppConfig => {
  const smtpUser = env("SMTP_USER");
  const smtpPass = env("SMTP_PASS");
  const smtpFrom = env("MAIL_FROM") || smtpUser;

  return {
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
    license: {
      platformApiBaseUrl:
        env("LICENSE_PLATFORM_API_BASE_URL") || LICENSE_PLATFORM_API_DEFAULT,
      platformTimeoutMs: parsePositiveInt(
        env("LICENSE_PLATFORM_TIMEOUT_MS"),
        10_000,
      ),
      signSecret: env("LICENSE_SIGN_SECRET"),
      openAllFeatures: envFlagTrue("LICENSE_OPEN_ALL_FEATURES"),
    },
  };
};
