import { getClientIp } from "@/lib/kiosk/access";
import { writeAudit } from "@/lib/kiosk/audit";
import {
  ADMIN_RATE_MAX,
  ADMIN_RATE_WINDOW_MS,
  rateLimitResponse,
  takeRateToken,
} from "@/lib/kiosk/rate-limit";

/** 管理 API 共用：限流；超限時寫 audit 並回 429 */
export const guardAdminAction = async (
  request: Request,
  action: string,
): Promise<{ ip: string; denied: Response | null }> => {
  const ip = getClientIp(request.headers);
  const limited = takeRateToken(
    `admin:${ip}:${action}`,
    ADMIN_RATE_MAX,
    ADMIN_RATE_WINDOW_MS,
  );
  if (!limited.ok) {
    await writeAudit({
      action,
      result: "deny",
      ip,
      detail: "rate_limit",
    });
    return { ip, denied: rateLimitResponse(limited.retryAfterSec) };
  }
  return { ip, denied: null };
};
