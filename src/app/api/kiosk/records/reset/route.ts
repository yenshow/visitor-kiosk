import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { resetPresenceStats } from "@/lib/kiosk/presence";

/** POST：清所有離場累計、取消臨時外出標記；保留在場完整欄位 */
export const POST = async () => {
  try {
    await resetPresenceStats();
    return jsonOk({
      reset: true,
      message: "已重置訪客統計（已清除離場累計並取消臨時外出標記）",
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "重置失敗",
      500,
    );
  }
};
