import { jsonOk } from "@/lib/kiosk/api-helpers";
import { isVisitorLicensed } from "@/lib/license/gate";

/** 授權狀態（前端提示用） */
export const GET = async () => {
  const licensed = await isVisitorLicensed();
  return jsonOk({ licensed });
};
