import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { listOrgOptions } from "@/lib/kiosk/directory";
import { requireVisitorLicense } from "@/lib/license/gate";

/** GET：扁平部門清單（供下拉） */
export const GET = async () => {
  const denied = await requireVisitorLicense();
  if (denied) return denied;

  try {
    const orgs = await listOrgOptions();
    return jsonOk({ orgs });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "取得部門清單失敗",
      500,
    );
  }
};
