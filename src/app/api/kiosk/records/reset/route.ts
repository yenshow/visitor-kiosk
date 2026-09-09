import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { resetPresenceStats } from "@/lib/kiosk/presence";

/** POST：清空本機在場快取／臨時外出／已離場統計與紀錄 */
export const POST = async () => {
  try {
    await resetPresenceStats();
    return jsonOk({
      reset: true,
      message: "已重置訪客統計（臨時外出、已離場與本機在場快取）",
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "重置失敗",
      500,
    );
  }
};
