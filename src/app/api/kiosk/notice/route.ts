import { getVisitorNotice } from "@/lib/kiosk/notice";
import { jsonOk } from "@/lib/kiosk/api-helpers";

export const GET = async () => {
  const content = await getVisitorNotice();
  return jsonOk({ content });
};
