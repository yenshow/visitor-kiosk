/** 授權平台產品碼（與 BA-system 分開，避免 LK 互用） */
export const LICENSE_PRODUCT = "YSOP-Kiosk";

/** 與 YSOP／BA 同一授權平台 Base（至 /api/license） */
export const LICENSE_PLATFORM_API_DEFAULT =
  "https://api.yenshow.com/api/license";

/** Kiosk 唯一買斷 feature */
export const VISITOR_FEATURE_KEY = "visitor";

export const KIOSK_FEATURE_KEYS = [VISITOR_FEATURE_KEY] as const;
