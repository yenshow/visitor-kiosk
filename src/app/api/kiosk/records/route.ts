import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { listVisitorRecords } from "@/lib/kiosk/records";

/** GET：目前在場／臨時外出／今日正式簽退明細 */
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
