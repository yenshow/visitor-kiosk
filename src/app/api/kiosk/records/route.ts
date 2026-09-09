import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { listVisitorRecords } from "@/lib/kiosk/records";

/** GET：在場中／臨時外出／已離場明細 */
export const GET = async () => {
  try {
    const data = await listVisitorRecords();
    return jsonOk(data);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "取得訪客紀錄失敗",
      500,
    );
  }
};
