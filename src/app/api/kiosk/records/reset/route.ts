import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { guardAdminAction } from "@/lib/kiosk/admin-guard";
import { writeAudit } from "@/lib/kiosk/audit";
import { resetPresenceStats } from "@/lib/kiosk/presence";

/** POST：清離場累計、取消臨時外出；保留在場 */
export const POST = async (request: Request) => {
  const { ip, denied } = await guardAdminAction(request, "records.reset");
  if (denied) return denied;

  try {
    await resetPresenceStats();
    await writeAudit({ action: "records.reset", result: "ok", ip });
    return jsonOk({
      reset: true,
      message: "已重置訪客統計（已清除離場累計並取消臨時外出標記）",
    });
  } catch (error) {
    await writeAudit({
      action: "records.reset",
      result: "error",
      ip,
      detail: error instanceof Error ? error.message : "fail",
    });
    return jsonError(
      error instanceof Error ? error.message : "重置失敗",
      500,
    );
  }
};
