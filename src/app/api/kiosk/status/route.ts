import { getConfig } from "@/lib/config";
import { jsonOk } from "@/lib/kiosk/api-helpers";

/** YSCP 連線狀態（前端提示用） */
export const GET = async () => {
  const config = getConfig();
  const hasCredentials = Boolean(
    config.hcp.accessKey && config.hcp.secretKey,
  );

  return jsonOk({
    host: config.hcp.hostname,
    port: config.hcp.port,
    hasCredentials,
  });
};
