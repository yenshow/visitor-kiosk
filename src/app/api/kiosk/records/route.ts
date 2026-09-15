import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { guardAdminAction } from "@/lib/kiosk/admin-guard";
import { writeAudit } from "@/lib/kiosk/audit";
import { listVisitorRecords } from "@/lib/kiosk/records";

/** GET：訪客紀錄明細（管理員） */
export const GET = async (request: Request) => {
  const { ip, denied } = await guardAdminAction(request, "records.get");
  if (denied) return denied;

  try {
    const data = await listVisitorRecords();
    await writeAudit({ action: "records.get", result: "ok", ip });
    return jsonOk(data);
  } catch (error) {
    await writeAudit({
      action: "records.get",
      result: "error",
      ip,
      detail: error instanceof Error ? error.message : "fail",
    });
    return jsonError(
      error instanceof Error ? error.message : "取得訪客紀錄失敗",
      500,
    );
  }
};
