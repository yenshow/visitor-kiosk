import { listOrgOptions } from "@/lib/hcp/org-api";
import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";

/** GET：扁平部門清單（含路徑標籤，供下拉） */
export const GET = async () => {
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
