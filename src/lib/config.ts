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

export type AppConfig = {
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
  };
};
