const taipeiParts = (
  date: Date,
  options: Intl.DateTimeFormatOptions,
): Record<string, string> => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    ...options,
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
};

export const toTaipeiIso = (date: Date): string => {
  const p = taipeiParts(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+08:00`;
};

/** 台北日 YYYY-MM-DD */
export const toTaipeiDateKey = (date = new Date()): string => {
  const p = taipeiParts(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return `${p.year}-${p.month}-${p.day}`;
};

/** 從 ISO／可解析字串取台北日；無效則空字串 */
export const taipeiDateKeyFromIso = (value: string): string => {
  const ms = Date.parse(String(value ?? "").trim());
  if (!Number.isFinite(ms)) return "";
  return toTaipeiDateKey(new Date(ms));
};

export const isSameTaipeiDate = (a: string, b: string): boolean => {
  const da = taipeiDateKeyFromIso(a);
  const db = taipeiDateKeyFromIso(b);
  return Boolean(da && db && da === db);
};

/**
 * 報到查預約時段：前 30 日～後 30 日。
 * YSCP appointmentlist 必填時段；提早預約只要「來訪日」落在此窗口即可查到。
 */
export const getAppointQueryRangeTaipei = (): {
  appointStartTime: string;
  appointEndTime: string;
} => {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const startP = taipeiParts(start, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const endP = taipeiParts(end, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return {
    appointStartTime: `${startP.year}-${startP.month}-${startP.day}T00:00:00+08:00`,
    appointEndTime: `${endP.year}-${endP.month}-${endP.day}T23:59:59+08:00`,
  };
};

/** 在廠查詢用時段：含前一日，避免跨日仍在廠漏查 */
export const getVisitQueryRangeTaipei = (): {
  visitStartTime: string;
  visitEndTime: string;
} => {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const startP = taipeiParts(start, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const endP = taipeiParts(end, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return {
    visitStartTime: `${startP.year}-${startP.month}-${startP.day}T00:00:00+08:00`,
    visitEndTime: `${endP.year}-${endP.month}-${endP.day}T23:59:59+08:00`,
  };
};

export const jsonError = (message: string, status = 400) =>
  Response.json({ code: String(status), msg: message, data: null }, { status });

export const jsonOk = <T>(data: T, msg = "Success") =>
  Response.json({ code: "0", msg, data });
