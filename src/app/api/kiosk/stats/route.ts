import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { computeKioskStats } from "@/lib/kiosk/stats";

/** GET：首頁在場／臨時外出／今日離場統計 */
export const GET = async () => {
  try {
    const stats = await computeKioskStats();
    return jsonOk(stats);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "取得統計失敗",
      500,
    );
  }
};
