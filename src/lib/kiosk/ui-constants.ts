/** 前端／後端共用預設文案（勿放 Node fs） */
export const DEFAULT_MARQUEE =
  "歡迎使用訪客服務機｜請選擇訪客報到、簽退或現場預約";

/** 無操作倒數回首頁秒數 */
export const KIOSK_IDLE_SECONDS = 20;

/** 外部預約可選日期：今日起最長天數（含當日） */
export const PUBLIC_BOOKING_MAX_DAYS = 30;

export type RecordsFilter =
  | "all"
  | "on_site"
  | "temp_out"
  | "overstay"
  | "departed_today"
  | "departed";

