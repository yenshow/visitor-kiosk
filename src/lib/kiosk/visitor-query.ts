import { looksLikePhone, normalizePhoneDigits } from "@/lib/kiosk/phone";

export type OnSitePresence = "on_site" | "temp_out";

export type OnSiteRecordView = {
  token: string;
  visitorName: string;
  phoneNo: string;
  companyName: string;
  receptionistName: string;
  plateNo?: string;
  presence: OnSitePresence;
  /** 臨時外出登記時間（ISO）；跨日返回需再同意須知 */
  tempOutAt?: string;
  visitReasonType?: number;
  visitReason?: string;
  visitStartTime: string;
  visitEndTime: string;
  visitingTime?: string;
};

export type VisitorQueryInput = {
  query?: string;
  phoneNo?: string;
  appointCode?: string;
};

export const parseVisitorQuery = (body: VisitorQueryInput) => {
  const query = String(body.query ?? "").trim();
  let appointCode = String(body.appointCode ?? "").trim();
  let phoneNo = String(body.phoneNo ?? "").trim();

  if (!appointCode && !phoneNo && query) {
    if (looksLikePhone(query)) phoneNo = query;
    else appointCode = query;
  }

  if (phoneNo) phoneNo = normalizePhoneDigits(phoneNo);

  return { query, phoneNo, appointCode };
};

export const toggleSelectedToken = (tokens: string[], token: string) =>
  tokens.includes(token)
    ? tokens.filter((item) => item !== token)
    : [...tokens, token];

export const postCheckoutModes = async (
  tokens: string[],
  mode: "temp" | "return" | "final",
): Promise<{ message: string; exitGateMinutes: number | null }> => {
  let message = "";
  let exitGateMinutes: number | null = null;
  for (const token of tokens) {
    const res = await fetch("/api/kiosk/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, mode }),
    });
    const json = (await res.json()) as {
      msg?: string;
      data?: { message?: string; exitGateMinutes?: number | null };
    };
    if (!res.ok) throw new Error(json.msg || "操作失敗");
    message = json.data?.message || message;
    if (
      typeof json.data?.exitGateMinutes === "number" &&
      json.data.exitGateMinutes > 0
    ) {
      exitGateMinutes = json.data.exitGateMinutes;
    }
  }
  return { message, exitGateMinutes };
};
