import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import {
  getSettings,
  normalizeApproverEmails,
  toSettingsView,
  updateSettings,
} from "@/lib/kiosk/settings";
import { normalizeTheme, themeCookieHeader } from "@/lib/kiosk/theme";

export const GET = async () => {
  try {
    const settings = await getSettings();
    const view = toSettingsView(settings);
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
  approverEmails?: string[] | string;
};

export const PUT = async (request: Request) => {
  try {
    const body = (await request.json()) as PutBody;
    const patch: {
      marquee?: string;
      showAppoint?: boolean;
      theme?: "light" | "dark";
      approverEmails?: string[];
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
    if (body.approverEmails !== undefined) {
      patch.approverEmails = normalizeApproverEmails(body.approverEmails);
    }

    const settings = await updateSettings(patch);
    const view = toSettingsView(settings);
    const response = jsonOk(view);
    response.headers.append("Set-Cookie", themeCookieHeader(view.theme));
    return response;
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "儲存設定失敗",
      500,
    );
  }
};
