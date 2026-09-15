import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { getClientIp } from "@/lib/kiosk/access";
import { lookupOnSiteRecords } from "@/lib/kiosk/on-site-lookup";
import {
  checkQueryLock,
  clearQueryFailures,
  QUERY_RATE_MAX,
  QUERY_RATE_WINDOW_MS,
  rateLimitResponse,
  recordQueryFailure,
  takeRateToken,
} from "@/lib/kiosk/rate-limit";
import {
  parseVisitorQuery,
  type VisitorQueryInput,
} from "@/lib/kiosk/visitor-query";

const queryKeyOf = (phoneNo: string, appointCode: string) =>
  phoneNo ? `p:${phoneNo}` : `c:${appointCode}`;

export const POST = async (request: Request) => {
  const ip = getClientIp(request.headers);
  const limited = takeRateToken(
    `query:${ip}:checkout-lookup`,
    QUERY_RATE_MAX,
    QUERY_RATE_WINDOW_MS,
  );
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const body = (await request.json()) as VisitorQueryInput;
    const { phoneNo, appointCode } = parseVisitorQuery(body);

    if (!phoneNo && !appointCode) {
      return jsonError("請輸入預約號碼／密碼或手機號碼");
    }

    const qKey = queryKeyOf(phoneNo, appointCode);
    const lock = checkQueryLock(qKey);
    if (lock.locked) return rateLimitResponse(lock.retryAfterSec);

    const result = await lookupOnSiteRecords({ phoneNo, appointCode });

    if (appointCode && result.appointNotFound) {
      recordQueryFailure(qKey);
      return jsonError("查無此預約密碼對應的在廠記錄", 404);
    }

    if (result.incompleteVisitorId) {
      recordQueryFailure(qKey);
      return jsonError(
        "預約資料缺少訪客識別，無法對應在廠記錄，請洽接待人員",
        404,
      );
    }

    if (result.records.length === 0) {
      recordQueryFailure(qKey);
      return jsonError("查無在廠簽到記錄，請確認已報到或洽接待人員", 404);
    }

    clearQueryFailures(qKey);
    return jsonOk({ records: result.records });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "查詢在廠記錄失敗",
      500,
    );
  }
};
