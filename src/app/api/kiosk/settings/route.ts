import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import {
  getClientIp,
  isLocalHostHeader,
  isLoopbackIp,
  parseAdminIps,
} from "@/lib/kiosk/access";
import { guardAdminAction } from "@/lib/kiosk/admin-guard";
import { writeAudit } from "@/lib/kiosk/audit";
import {
  getSettings,
  normalizeApproverEmails,
  toAdminSettingsView,
  toSettingsView,
  updateSettings,
} from "@/lib/kiosk/settings";
import { normalizeTheme, themeCookieHeader } from "@/lib/kiosk/theme";

const isAdminRequest = (request: Request): boolean => {
  const ip = getClientIp(request.headers);
  const adminIps = parseAdminIps(process.env.KIOSK_ADMIN_IPS);
  return (
    isLoopbackIp(ip) ||
    (!ip && isLocalHostHeader(request.headers.get("host"))) ||
    (ip !== "" && adminIps.includes(ip))
  );
};

export const GET = async (request: Request) => {
  try {
    const settings = await getSettings();
    const view = isAdminRequest(request)
      ? toAdminSettingsView(settings)
      : toSettingsView(settings);
    const response = jsonOk(view);
    response.headers.append("Set-Cookie", themeCookieHeader(view.theme));
    return response;
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "讀取設定失敗",
      500,
    );
  }
};

type PutBody = {
  marquee?: string;
  showAppoint?: boolean;
  theme?: string;
  noticeVideoUrl?: string;
  approverEmails?: string[] | string;
  publicBookingEnabled?: boolean;
};

export const PUT = async (request: Request) => {
  const { ip, denied } = await guardAdminAction(request, "settings.put");
  if (denied) return denied;

  try {
    const body = (await request.json()) as PutBody;
    const patch: {
      marquee?: string;
      showAppoint?: boolean;
      theme?: "light" | "dark";
      noticeVideoUrl?: string;
      approverEmails?: string[];
      publicBookingEnabled?: boolean;
    } = {};

    if (typeof body.marquee === "string") {
      patch.marquee = body.marquee.slice(0, 500);
    }
    if (typeof body.showAppoint === "boolean") {
      patch.showAppoint = body.showAppoint;
    }
    if (body.theme === "light" || body.theme === "dark") {
      patch.theme = normalizeTheme(body.theme);
    }
    if (typeof body.noticeVideoUrl === "string") {
      patch.noticeVideoUrl = body.noticeVideoUrl;
    }
    if (body.approverEmails !== undefined) {
      patch.approverEmails = normalizeApproverEmails(body.approverEmails);
    }
    if (typeof body.publicBookingEnabled === "boolean") {
      patch.publicBookingEnabled = body.publicBookingEnabled;
    }

    const settings = await updateSettings(patch);
    const view = toAdminSettingsView(settings);
    await writeAudit({ action: "settings.put", result: "ok", ip });
    const response = jsonOk(view);
    response.headers.append("Set-Cookie", themeCookieHeader(view.theme));
    return response;
  } catch (error) {
    await writeAudit({
      action: "settings.put",
      result: "error",
      ip,
      detail: error instanceof Error ? error.message : "fail",
    });
    return jsonError(
      error instanceof Error ? error.message : "儲存設定失敗",
      500,
    );
  }
};
