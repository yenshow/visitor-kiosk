import { jsonError, jsonOk, toTaipeiDateKey } from "@/lib/kiosk/api-helpers";
import { guardAdminAction } from "@/lib/kiosk/admin-guard";
import { loadLegacyKioskData } from "@/lib/kiosk/appointments";
import { writeAudit } from "@/lib/kiosk/audit";
import { updateKioskData } from "@/lib/kiosk/data-store";
import { isDepartedToday } from "@/lib/kiosk/presence";

export const POST = async (request: Request) => {
  const { ip, denied } = await guardAdminAction(request, "records.reset");
  if (denied) return denied;

  try {
    await updateKioskData(loadLegacyKioskData, (data) => {
      const now = new Date();
      const today = toTaipeiDateKey(now);
      const departed = data.visits.filter((visit) => visit.status === "departed");
      data.statsBaseline = {
        at: now.toISOString(),
        departedToday: departed.filter((visit) => isDepartedToday(visit, today)).length,
        departedTotal: departed.length,
      };
    });
    await writeAudit({ action: "records.reset", result: "ok", ip });
    return jsonOk({
      reset: true,
      message: "今日與本期離場統計已歸零，歷史紀錄已保留",
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
