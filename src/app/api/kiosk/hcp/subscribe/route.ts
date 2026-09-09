import { getConfig } from "@/lib/config";
import {
  EVENT_TYPE_PLATE_UPLOAD,
  ensureEventSubscription,
} from "@/lib/hcp/event-api";
import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";

/** 手動重訂 HCP 車牌事件（換 IP／token 後可用） */
export const POST = async () => {
  try {
    const result = await ensureEventSubscription();
    if (result.skipped) {
      return jsonError(result.reason || "無法訂閱", 400);
    }

    return jsonOk({
      eventDest: result.eventDest,
      eventTypes: [EVENT_TYPE_PLATE_UPLOAD],
      exitLaneCount: getConfig().hcp.exitLanes.length,
      data: result.data ?? null,
      message: "已向 YSCP 訂閱車牌上傳事件（131622）",
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "事件訂閱失敗",
      500,
    );
  }
};
