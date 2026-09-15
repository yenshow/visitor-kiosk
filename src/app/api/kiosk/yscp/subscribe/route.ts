import { getConfig } from "@/lib/config";
import {
  EVENT_TYPE_PLATE_UPLOAD,
  ensureEventSubscription,
} from "@/lib/yscp/event-api";
import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { guardAdminAction } from "@/lib/kiosk/admin-guard";
import { writeAudit } from "@/lib/kiosk/audit";

/** 手動重訂 YSCP 車牌事件 */
export const POST = async (request: Request) => {
  const { ip, denied } = await guardAdminAction(request, "yscp.subscribe");
  if (denied) return denied;

  try {
    const result = await ensureEventSubscription();
    if (result.skipped) {
      await writeAudit({
        action: "yscp.subscribe",
        result: "error",
        ip,
        detail: result.reason || "skipped",
      });
      return jsonError(result.reason || "無法訂閱", 400);
    }

    await writeAudit({ action: "yscp.subscribe", result: "ok", ip });
    return jsonOk({
      eventDest: result.eventDest,
      eventTypes: [EVENT_TYPE_PLATE_UPLOAD],
      exitLaneCount: getConfig().yscp.exitLanes.length,
      message: "已向 YSCP 訂閱車牌上傳事件（131622）",
    });
  } catch (error) {
    await writeAudit({
      action: "yscp.subscribe",
      result: "error",
      ip,
      detail: error instanceof Error ? error.message : "fail",
    });
    return jsonError(
      error instanceof Error ? error.message : "事件訂閱失敗",
      500,
    );
  }
};
