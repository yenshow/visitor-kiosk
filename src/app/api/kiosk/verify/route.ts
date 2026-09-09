import {
  appointmentStatusMessage,
  findAppointmentsByQuery,
  isPendingCheckin,
  withCompleteVisitorInfo,
} from "@/lib/kiosk/appoint-lookup";
import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { lookupOnSiteRecords } from "@/lib/kiosk/on-site-lookup";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import { normalizePhoneDigits } from "@/lib/kiosk/phone";
import { createCheckinToken } from "@/lib/kiosk/session";
import { displayVisitorName } from "@/lib/kiosk/visitor-fields";
import {
  parseVisitorQuery,
  type VisitorQueryInput,
} from "@/lib/kiosk/visitor-query";
import { visitReasonLabel } from "@/lib/kiosk/visit-reason";

const alreadyOnSiteMessage = "您已在場，如需臨時外出或簽退請使用訪客簽退";

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as VisitorQueryInput;
    const { appointCode, phoneNo } = parseVisitorQuery(body);

    if (!appointCode && !phoneNo) {
      return jsonError("請輸入預約號碼／密碼或手機號碼");
    }

    const matchedRaw = await findAppointmentsByQuery({ appointCode, phoneNo });
    const onSiteResult = await lookupOnSiteRecords({
      phoneNo,
      appointCode,
      appointments: matchedRaw,
    }).catch(() => ({ records: [], appointNotFound: false }));

    const tempOutRecords = onSiteResult.records.filter(
      (item) => item.presence === "temp_out",
    );
    if (tempOutRecords.length > 0) {
      return jsonOk({ appointments: [], tempOutRecords });
    }

    const matched = matchedRaw.map((item) =>
      withCompleteVisitorInfo(item, phoneNo),
    );
    const pending = matched.filter((item) =>
      isPendingCheckin(item.appointStatus),
    );

    if (pending.length === 0) {
      if (onSiteResult.records.length > 0) {
        return jsonError(alreadyOnSiteMessage, 409);
      }
      if (matched.length === 0) {
        return jsonError(
          "查無此預約資訊，請聯繫接待員工建立預約，或改由「訪客預約」申請",
          404,
        );
      }
      return jsonError(appointmentStatusMessage(matched[0]?.appointStatus), 409);
    }

    const appointments = [];
    for (const item of pending) {
      const info = item.visitorInfo;
      const plateNo = normalizePlateNo(info?.plateNo);
      const itemPhone = normalizePhoneDigits(info?.phoneNo ?? "");

      appointments.push({
        token: createCheckinToken({
          ...item,
          visitorInfo: {
            ...info,
            phoneNo: itemPhone || info?.phoneNo,
            plateNo: plateNo || info?.plateNo || "",
            companyName: String(info?.companyName ?? "").trim(),
          },
        }),
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
