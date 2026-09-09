import { artemisPostSecure } from "./artemis-client";
import { getConfig } from "@/lib/config";
import { assertYscpOk, type YscpApiResult } from "./visitor-api";

/** 車牌資訊上傳（不論名單皆推送） */
export const EVENT_TYPE_PLATE_UPLOAD = 131622;

/** 向 YSCP 訂閱事件回呼 */
export const subscribeEventByTypes = async (input: {
  eventDest: string;
  token: string;
  eventTypes?: number[];
}): Promise<unknown> => {
  const eventDest = String(input.eventDest ?? "").trim();
  const token = String(input.token ?? "").trim();
  if (!eventDest) throw new Error("缺少 eventDest（YSCP_EVENT_DEST）");
  if (!token) throw new Error("缺少 token（YSCP_EVENT_TOKEN）");

  const { data } = await artemisPostSecure<YscpApiResult<unknown>>(
    "/artemis/api/eventService/v1/eventSubscriptionByEventTypes",
    {
      eventTypes: input.eventTypes?.length
        ? input.eventTypes
        : [EVENT_TYPE_PLATE_UPLOAD],
      eventDest,
      token,
      passBack: 1,
    },
  );

  return assertYscpOk(data, "YSCP 事件訂閱失敗");
};

/** 依 .env 訂閱；缺設定時 skipped，不拋錯 */
export const ensureEventSubscription = async (): Promise<{
  skipped: boolean;
  eventDest?: string;
  data?: unknown;
  reason?: string;
}> => {
  const { yscp } = getConfig();
  if (!yscp.eventDest) {
    return {
      skipped: true,
      reason: "未設定 YSCP_EVENT_DEST",
    };
  }
  if (!yscp.accessKey || !yscp.secretKey) {
    return { skipped: true, reason: "未設定 YSCP_AK / YSCP_SK" };
  }

  const data = await subscribeEventByTypes({
    eventDest: yscp.eventDest,
    token: yscp.eventToken,
  });
  return { skipped: false, eventDest: yscp.eventDest, data };
};
