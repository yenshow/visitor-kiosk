import {
  listAppointments,
  type AppointmentItem,
} from "@/lib/yscp/visitor-api";
import {
  getAppointQueryRangeTaipei,
  jsonError,
  jsonOk,
} from "@/lib/kiosk/api-helpers";
import { lookupOnSiteRecords } from "@/lib/kiosk/on-site-lookup";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import {
  lookupCachedPlate,
  rememberPlate,
} from "@/lib/kiosk/plate-cache";
import { normalizePhoneDigits } from "@/lib/kiosk/phone";
import { createCheckinToken } from "@/lib/kiosk/session";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";
import {
  parseVisitorQuery,
  type VisitorQueryInput,
} from "@/lib/kiosk/visitor-query";
import { visitReasonLabel } from "@/lib/kiosk/visit-reason";

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

const alreadyOnSiteMessage = "您已在場，如需臨時外出或簽退請使用訪客簽退";

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as VisitorQueryInput;
    const { query, appointCode, phoneNo } = parseVisitorQuery(body);

    if (!appointCode && !phoneNo) {
      return jsonError("請輸入預約密碼或手機號碼");
    }

    const range = getAppointQueryRangeTaipei();
    const queries: Array<ReturnType<typeof listAppointments>> = [];
    if (appointCode) queries.push(listAppointments({ appointCode, ...range }));
    if (phoneNo) {
      queries.push(listAppointments({ phoneNo, ...range }));
      if (query) queries.push(listAppointments({ appointCode: query, ...range }));
    }

    const [appointLists, onSiteResult] = await Promise.all([
      Promise.all(queries),
      lookupOnSiteRecords({ phoneNo, appointCode }).catch(() => ({
        records: [],
        appointNotFound: false,
      })),
    ]);

    const tempOutRecords = onSiteResult.records.filter(
      (item) => item.presence === "temp_out",
    );
    if (tempOutRecords.length > 0) {
      return jsonOk({ appointments: [], tempOutRecords });
    }

    const onSiteCount = onSiteResult.records.length;
    const merged = mergeByAppointId(appointLists.map((r) => r.list ?? []));
    const matched = merged.filter((item) => {
      const code = String(item.appointCode ?? "").trim();
      const itemPhone = normalizePhoneDigits(item.visitorInfo?.phoneNo ?? "");
      if (appointCode && code === appointCode) return true;
      if (phoneNo && itemPhone === phoneNo) return true;
      if (phoneNo && query && code === query) return true;
      return false;
    });
    const pending = matched.filter((item) =>
      isPendingCheckin(item.appointStatus),
    );

    if (pending.length === 0) {
      if (onSiteCount > 0) return jsonError(alreadyOnSiteMessage, 409);
      if (matched.length === 0) {
        return jsonError(
          "查無此預約資訊，請聯繫接待員工建立預約，或改由「訪客預約」申請",
          404,
        );
      }
      return jsonError(statusMessage(matched[0]?.appointStatus), 409);
    }

    const appointments = [];
    for (const item of pending) {
      const info = item.visitorInfo;
      const visitorId = String(info?.visitorId ?? "").trim();
      const itemPhone =
        normalizePhoneDigits(info?.phoneNo ?? "") || phoneNo || "";
      const plateNo =
        normalizePlateNo(info?.plateNo) ||
        (await lookupCachedPlate({
          visitorId,
          phoneNo: itemPhone,
          appointId: item.appointID,
        })) ||
        "";

      if (plateNo) {
        await rememberPlate({
          plateNo,
          visitorId,
          phoneNo: itemPhone,
          appointId: item.appointID,
        });
      }

      const tokenItem: AppointmentItem = {
        ...item,
        visitorInfo: {
          ...info,
          plateNo: plateNo || info?.plateNo || "",
          phoneNo: itemPhone || info?.phoneNo,
        },
      };

      appointments.push({
        token: createCheckinToken(tokenItem),
        appointStartTime: item.appointStartTime ?? "",
        appointEndTime: item.appointEndTime ?? "",
        receptionistName: item.receptionistName ?? "",
        visitorName: displayVisitorName(
          info?.visitorFamilyName,
          info?.visitorGivenName,
          info?.visitorName,
        ),
        phoneNo: itemPhone,
        companyName: String(info?.companyName ?? "").trim(),
        plateNo,
        visitReason: visitReasonLabel(
          item.visitReasonType,
          item.visitReasonDetail,
          item.visitorReasonName,
        ),
      });
    }

    return jsonOk({ appointments });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "查詢預約失敗",
      500,
    );
  }
};
