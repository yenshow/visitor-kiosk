import {
  listAppointments,
  type AppointmentItem,
} from "@/lib/hcp/visitor-api";
import {
  getAppointQueryRangeTaipei,
  jsonError,
  jsonOk,
} from "@/lib/kiosk/api-helpers";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import { looksLikePhone, normalizePhoneDigits } from "@/lib/kiosk/phone";
import { createCheckinToken } from "@/lib/kiosk/session";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";
import { visitReasonLabel } from "@/lib/kiosk/visit-reason";

type VerifyBody = {
  query?: string;
  appointCode?: string;
  phoneNo?: string;
};

const isPendingCheckin = (status: unknown) => String(status ?? "0") === "0";

const mergeByAppointId = (lists: AppointmentItem[][]) => {
  const map = new Map<string, AppointmentItem>();
  for (const list of lists) {
    for (const item of list) {
      const id = String(item.appointID ?? "").trim();
      if (id) map.set(id, item);
    }
  }
  return [...map.values()];
};

const statusMessage = (status: unknown) => {
  const s = String(status ?? "");
  if (s === "1") return "預約審核中，請等待內部確認後再報到";
  if (s === "2") return "預約未通過審核，請重新預約或洽接待人員";
  if (s === "3" || s === "4") {
    return "此預約已報到或已結束，如需再次來訪請重新預約";
  }
  return "預約尚未核准或已使用，請等待內部確認或重新預約";
};

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as VerifyBody;
    const query = String(body.query ?? "").trim();
    let appointCode = String(body.appointCode ?? "").trim();
    let phoneNo = String(body.phoneNo ?? "").trim();

    if (!appointCode && !phoneNo && query) {
      if (looksLikePhone(query)) phoneNo = query;
      else appointCode = query;
    }

    if (phoneNo) phoneNo = normalizePhoneDigits(phoneNo);
    if (!appointCode && !phoneNo) {
      return jsonError("請輸入預約密碼或手機號碼");
    }

    const range = getAppointQueryRangeTaipei();
    // 不帶 appointState：此環境 number 0 常空回；字串 "0" 又會混入已結束
    const queries: Array<ReturnType<typeof listAppointments>> = [];
    if (appointCode) queries.push(listAppointments({ appointCode, ...range }));
    if (phoneNo) {
      queries.push(listAppointments({ phoneNo, ...range }));
      if (query) queries.push(listAppointments({ appointCode: query, ...range }));
    }

    const merged = mergeByAppointId(
      (await Promise.all(queries)).map((r) => r.list ?? []),
    );

    const matched = merged.filter((item) => {
      const code = String(item.appointCode ?? "").trim();
      const itemPhone = normalizePhoneDigits(item.visitorInfo?.phoneNo ?? "");
      if (appointCode && code === appointCode) return true;
      if (phoneNo && itemPhone === phoneNo) return true;
      if (phoneNo && query && code === query) return true;
      return false;
    });

    if (matched.length === 0) {
      return jsonError(
        "查無此預約資訊，請聯繫接待員工建立預約，或改由「訪客預約」申請",
        404,
      );
    }

    const pending = matched.filter((item) =>
      isPendingCheckin(item.appointStatus),
    );
    if (pending.length === 0) {
      return jsonError(statusMessage(matched[0]?.appointStatus), 409);
    }

    return jsonOk({
      appointments: pending.map((item) => {
        const info = item.visitorInfo;
        return {
          token: createCheckinToken(item),
          appointStartTime: item.appointStartTime ?? "",
          appointEndTime: item.appointEndTime ?? "",
          receptionistName: item.receptionistName ?? "",
          visitorName: displayVisitorName(
            info?.visitorFamilyName,
            info?.visitorGivenName,
            info?.visitorName,
          ),
          phoneNo: String(info?.phoneNo || phoneNo || "").trim(),
          companyName: String(info?.companyName ?? "").trim(),
          plateNo: normalizePlateNo(info?.plateNo),
          visitReason: visitReasonLabel(
            item.visitReasonType,
            item.visitReasonDetail,
            item.visitorReasonName,
          ),
        };
      }),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "查詢預約失敗",
      500,
    );
  }
};
