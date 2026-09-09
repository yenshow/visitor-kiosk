import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { lookupOnSiteRecords } from "@/lib/kiosk/on-site-lookup";
import {
  parseVisitorQuery,
  type VisitorQueryInput,
} from "@/lib/kiosk/visitor-query";

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as VisitorQueryInput;
    const { phoneNo, appointCode } = parseVisitorQuery(body);

    if (!phoneNo && !appointCode) {
      return jsonError("請輸入預約號碼／密碼或手機號碼");
    }

    const result = await lookupOnSiteRecords({ phoneNo, appointCode });

    if (appointCode && result.appointNotFound) {
      return jsonError("查無此預約密碼對應的在廠記錄", 404);
    }

    if (result.records.length === 0) {
      return jsonError("查無在廠簽到記錄，請確認已報到或洽接待人員", 404);
    }

    return jsonOk({ records: result.records });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "查詢在廠記錄失敗",
      500,
    );
  }
};
