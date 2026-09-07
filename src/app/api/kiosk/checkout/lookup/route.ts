import {
  getVisitorRegisterRecords,
  listAppointments,
  type VisitorRegisterRecord,
} from "@/lib/hcp/visitor-api";
import {
  getAppointQueryRangeTaipei,
  getVisitQueryRangeTaipei,
  jsonError,
  jsonOk,
} from "@/lib/kiosk/api-helpers";
import { looksLikePhone, normalizePhoneDigits } from "@/lib/kiosk/phone";
import { createCheckoutToken } from "@/lib/kiosk/session";

type LookupBody = {
  query?: string;
  phoneNo?: string;
  appointCode?: string;
};

type FlatRecord = {
  recordId: string;
  visitorId: string;
  visitorName: string;
  phoneNo: string;
  companyName: string;
  receptionistName: string;
  visitStartTime: string;
  visitEndTime: string;
  registerTime: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const pickText = (
  obj: Record<string, unknown> | null,
  keys: string[],
): string => {
  if (!obj) return "";
  for (const key of keys) {
    const value = obj[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text && text !== "null" && text !== "undefined") return text;
  }
  return "";
};

/** HCP：recordId + visitorBaseInfo{ fullName, phoneNum, ... } */
const flattenRegisterRecord = (raw: unknown): FlatRecord | null => {
  const root = asRecord(raw);
  if (!root) return null;

  const base =
    asRecord(root.visitorBaseInfo) ??
    asRecord(root.visitorInfo) ??
    asRecord(root.VisitorInfo);

  const recordId = pickText(root, ["recordId", "appointRecordId"]);
  if (!recordId) return null;

  return {
    recordId,
    visitorId:
      pickText(base, ["visitorId"]) || pickText(root, ["visitorId"]),
    visitorName:
      pickText(base, ["fullName", "visitorName", "name"]) ||
      pickText(root, ["visitorName", "fullName"]),
    phoneNo:
      pickText(base, ["phoneNum", "phoneNo", "phone", "mobile"]) ||
      pickText(root, ["phoneNum", "phoneNo", "phone", "mobile"]),
    companyName:
      pickText(base, ["companyName"]) || pickText(root, ["companyName"]),
    receptionistName: pickText(root, [
      "receptionistName",
      "interviewName",
      "beVisitedPersonName",
      "hostName",
    ]),
    visitStartTime:
      pickText(base, ["visitStartTime"]) ||
      pickText(root, ["visitStartTime", "visitingTime", "registerTime"]),
    visitEndTime:
      pickText(base, ["visitEndTime"]) || pickText(root, ["visitEndTime"]),
    registerTime: pickText(root, ["registerTime", "visitingTime"]),
  };
};

const toView = (
  flat: FlatRecord,
  extras?: { receptionistName?: string; fallbackPhone?: string },
) => {
  const phone =
    normalizePhoneDigits(flat.phoneNo) ||
    normalizePhoneDigits(extras?.fallbackPhone ?? "");

  return {
    token: createCheckoutToken(flat.recordId),
    visitorName: flat.visitorName || "—",
    phoneNo: phone,
    companyName: flat.companyName,
    receptionistName:
      extras?.receptionistName || flat.receptionistName || "",
    visitStartTime: flat.visitStartTime || flat.registerTime,
    visitEndTime: flat.visitEndTime,
    visitingTime: flat.registerTime || flat.visitStartTime,
  };
};

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as LookupBody;
    const query = String(body.query ?? "").trim();
    let phoneNo = String(body.phoneNo ?? "").trim();
    let appointCode = String(body.appointCode ?? "").trim();

    if (!phoneNo && !appointCode && query) {
      if (looksLikePhone(query)) phoneNo = query;
      else appointCode = query;
    }

    if (phoneNo) phoneNo = normalizePhoneDigits(phoneNo);
    if (!phoneNo && !appointCode) {
      return jsonError("請輸入預約密碼或手機號碼");
    }

    let receptionistName = "";
    let filterVisitorId = "";
    let filterPhone = phoneNo;

    if (appointCode) {
      const appt = await listAppointments({
        appointCode,
        ...getAppointQueryRangeTaipei(),
      });
      const item = appt.list?.[0];
      if (!item) {
        return jsonError("查無此預約密碼對應的在廠記錄", 404);
      }
      filterVisitorId = String(item.visitorInfo?.visitorId ?? "").trim();
      filterPhone =
        normalizePhoneDigits(item.visitorInfo?.phoneNo ?? "") || filterPhone;
      receptionistName = item.receptionistName ?? "";
    }

    const result = await getVisitorRegisterRecords(getVisitQueryRangeTaipei());
    const matched = (result.list ?? [])
      .map((item: VisitorRegisterRecord) => flattenRegisterRecord(item))
      .filter((item): item is FlatRecord => item !== null)
      .filter((item) => {
        if (filterVisitorId && item.visitorId === filterVisitorId) return true;
        if (filterPhone && normalizePhoneDigits(item.phoneNo) === filterPhone) {
          return true;
        }
        return false;
      });

    if (matched.length === 0) {
      return jsonError(
        "查無在廠簽到記錄，請確認已報到或洽接待人員",
        404,
      );
    }

    return jsonOk({
      records: [
        toView(matched[0], {
          receptionistName,
          fallbackPhone: filterPhone,
        }),
      ],
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "查詢在廠記錄失敗",
      500,
    );
  }
};
