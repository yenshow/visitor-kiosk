import { getConfig } from "@/lib/config";
import { jsonOk } from "@/lib/kiosk/api-helpers";

/** YSCP 連線狀態（前端提示用） */
export const GET = async () => {
  const config = getConfig();
  const hasCredentials = Boolean(
    config.yscp.accessKey && config.yscp.secretKey,
  );

  return jsonOk({
    host: config.yscp.hostname,
    port: config.yscp.port,
    hasCredentials,
  });
};
