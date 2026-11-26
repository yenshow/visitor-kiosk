import { getVisitorNotice } from "@/lib/kiosk/notice";
import { jsonOk } from "@/lib/kiosk/api-helpers";
import { requireVisitorLicense } from "@/lib/license/gate";

export const GET = async () => {
  const denied = await requireVisitorLicense();
  if (denied) return denied;

  const content = await getVisitorNotice();
  return jsonOk({ content });
};
