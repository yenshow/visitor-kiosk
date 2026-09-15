import { jsonOk } from "@/lib/kiosk/api-helpers";
import { getConfig } from "@/lib/config";

/** YSCP 連線狀態（前端提示用；不回 host/port） */
export const GET = async () => {
  const config = getConfig();
  const hasCredentials = Boolean(
    config.yscp.accessKey && config.yscp.secretKey,
  );

  return jsonOk({ hasCredentials });
};
