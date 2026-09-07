import { searchHosts } from "@/lib/hcp/org-api";
import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as { orgIndexCode?: string };
    const orgIndexCode = String(body.orgIndexCode ?? "").trim();

    if (!orgIndexCode) {
      return jsonError("請先選擇部門");
    }

    const hosts = await searchHosts({ orgIndexCode });
    return jsonOk({ hosts });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "查詢被訪人失敗",
      500,
    );
  }
};
