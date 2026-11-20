import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { guardAdminAction } from "@/lib/kiosk/admin-guard";
import { writeAudit } from "@/lib/kiosk/audit";
import { listKioskRecords } from "@/lib/kiosk/records";

/** GET：訪客紀錄明細（管理員） */
export const GET = async (request: Request) => {
  const { ip, denied } = await guardAdminAction(request, "records.get");
  if (denied) return denied;

  try {
    const records = await listKioskRecords();
    await writeAudit({ action: "records.get", result: "ok", ip });
    const response = jsonOk(records);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    await writeAudit({
      action: "records.get",
      result: "error",
      ip,
      detail: error instanceof Error ? error.message : "fail",
    });
    return jsonError(
      "取得訪客紀錄失敗，請聯絡維運人員檢查資料檔",
      500,
    );
  }
};
