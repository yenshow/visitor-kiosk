import { artemisPostSecure } from "./artemis-client";
import { getConfig } from "@/lib/config";
import type { HcpApiResult } from "./visitor-api";

/** 車牌資訊上傳（不論名單皆推送） */
export const EVENT_TYPE_PLATE_UPLOAD = 131622;

/** 向 HCP 訂閱事件回呼 */
export const subscribeEventByTypes = async (input: {
  eventDest: string;
  token: string;
  eventTypes?: number[];
}): Promise<unknown> => {
  const eventDest = String(input.eventDest ?? "").trim();
  const token = String(input.token ?? "").trim();
  if (!eventDest) throw new Error("缺少 eventDest（HCP_EVENT_DEST）");
  if (!token) throw new Error("缺少 token（HCP_EVENT_TOKEN）");

  const { data } = await artemisPostSecure<HcpApiResult<unknown>>(
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

  if (String(data?.code) !== "0") {
    throw new Error(data?.msg || "HCP 事件訂閱失敗");
  }
  return data.data;
};

/** 依 .env 訂閱；缺設定時 skipped，不拋錯 */
export const ensureEventSubscription = async (): Promise<{
  skipped: boolean;
  eventDest?: string;
  data?: unknown;
  reason?: string;
}> => {
  const { hcp } = getConfig();
  if (!hcp.eventDest || !hcp.eventToken) {
    return {
      skipped: true,
      reason: "未設定 HCP_EVENT_DEST / HCP_EVENT_TOKEN",
    };
  }
  if (!hcp.accessKey || !hcp.secretKey) {
    return { skipped: true, reason: "未設定 HCP_AK / HCP_SK" };
  }

  const data = await subscribeEventByTypes({
    eventDest: hcp.eventDest,
    token: hcp.eventToken,
  });
  return { skipped: false, eventDest: hcp.eventDest, data };
};
