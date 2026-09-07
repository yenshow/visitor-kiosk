import {
  getVisitorRegisterRecords,
  listAppointments,
} from "@/lib/hcp/visitor-api";
import {
  getAppointQueryRangeTaipei,
  getVisitQueryRangeTaipei,
  jsonError,
  jsonOk,
} from "@/lib/kiosk/api-helpers";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import { looksLikePhone, normalizePhoneDigits } from "@/lib/kiosk/phone";
import { getPresenceStore } from "@/lib/kiosk/presence";
import {
  flattenRegisterList,
  type FlatRegisterRecord,
} from "@/lib/kiosk/register-record";
import { createCheckoutToken } from "@/lib/kiosk/session";

type LookupBody = {
  query?: string;
  phoneNo?: string;
  appointCode?: string;
};

const toView = (
  flat: FlatRegisterRecord,
  extras: {
    receptionistName?: string;
    fallbackPhone?: string;
    fallbackPlate?: string;
    tempOutIds: Set<string>;
  },
) => {
  const phone =
    normalizePhoneDigits(flat.phoneNo) ||
    normalizePhoneDigits(extras.fallbackPhone ?? "");
  const plateNo =
    normalizePlateNo(flat.plateNo) || normalizePlateNo(extras.fallbackPlate);
  const visitorName = flat.visitorName || "—";

  return {
    token: createCheckoutToken({
      appointRecordId: flat.recordId,
      visitorName,
      plateNo,
    }),
    visitorName,
    phoneNo: phone,
    companyName: flat.companyName,
    receptionistName: extras.receptionistName || flat.receptionistName || "",
    plateNo,
    presence: extras.tempOutIds.has(flat.recordId)
      ? ("temp_out" as const)
      : ("on_site" as const),
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
    let filterPlate = "";

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
      filterPlate = normalizePlateNo(item.visitorInfo?.plateNo);
      receptionistName = item.receptionistName ?? "";
    }

    const onSiteList = flattenRegisterList(
      (await getVisitorRegisterRecords(getVisitQueryRangeTaipei())).list,
    );
    const matched = onSiteList.filter((item) => {
      if (filterVisitorId && item.visitorId === filterVisitorId) return true;
      if (filterPhone && normalizePhoneDigits(item.phoneNo) === filterPhone) {
        return true;
      }
      return false;
    });

    if (matched.length === 0) {
      return jsonError("查無在廠簽到記錄，請確認已報到或洽接待人員", 404);
    }

    const presence = await getPresenceStore(
      new Set(onSiteList.map((item) => item.recordId)),
    );
    const tempOutIds = new Set(presence.tempOut.map((item) => item.recordId));

    return jsonOk({
      records: matched.map((item) =>
        toView(item, {
          receptionistName,
          fallbackPhone: filterPhone,
          fallbackPlate: filterPlate,
          tempOutIds,
        }),
      ),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "查詢在廠記錄失敗",
      500,
    );
  }
};
