import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { searchHosts } from "@/lib/kiosk/directory";
import { requireVisitorLicense } from "@/lib/license/gate";

export const POST = async (request: Request) => {
  const denied = await requireVisitorLicense();
  if (denied) return denied;

  try {
    const body = (await request.json()) as { orgIndexCode?: string };
    const orgIndexCode = String(body.orgIndexCode ?? "").trim();

    if (!orgIndexCode) {
      return jsonError("請先選擇部門");
    }

    const hosts = await searchHosts(orgIndexCode);
    return jsonOk({ hosts });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "查詢被訪人失敗",
      500,
    );
  }
};
