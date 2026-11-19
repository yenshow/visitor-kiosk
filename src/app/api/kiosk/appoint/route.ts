import { createLocalAppointment } from "@/lib/kiosk/appointments";
import {
  jsonError,
  jsonOk,
  taipeiDateKeyFromIso,
  toTaipeiDateKey,
} from "@/lib/kiosk/api-helpers";
import { notifyApproversOfAppointment } from "@/lib/kiosk/approver-mail";
import { requireVisitorLicense } from "@/lib/license/gate";
import { normalizePhoneDigits, normalizePlateNo } from "@/lib/kiosk/normalize";
import { isValidEmail } from "@/lib/kiosk/visitor-fields";

type AppointBody = {
  receptionistId?: string;
  receptionistName?: string;
  orgLabel?: string;
  appointStartTime?: string;
  appointEndTime?: string;
  visitReasonType?: number;
  visitorFamilyName?: string;
  visitorGivenName?: string;
  companyName?: string;
  phoneNo?: string;
  email?: string;
  gender?: number;
  plateNo?: string;
};

export const POST = async (request: Request) => {
  const denied = await requireVisitorLicense();
  if (denied) return denied;

  try {
    const body = (await request.json()) as AppointBody;

    const receptionistId = String(body.receptionistId ?? "").trim();
    const receptionistName = String(body.receptionistName ?? "").trim();
    const orgLabel = String(body.orgLabel ?? "").trim();
    const visitorFamilyName = String(body.visitorFamilyName ?? "").trim();
    const visitorGivenName = String(body.visitorGivenName ?? "").trim();
    const appointStartTime = String(body.appointStartTime ?? "").trim();
    const appointEndTime = String(body.appointEndTime ?? "").trim();
    const visitReasonType = Number(body.visitReasonType ?? 0);
    const companyName = String(body.companyName ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phoneNo = normalizePhoneDigits(String(body.phoneNo ?? "").trim());
    const plateNo = normalizePlateNo(body.plateNo);

    if (!receptionistId) return jsonError("請選擇被訪人");
    if (!visitorFamilyName && !visitorGivenName) {
      return jsonError("請填寫姓或名");
    }
    if (!email) return jsonError("請填寫 Email");
    if (!isValidEmail(email)) return jsonError("Email 格式不正確");
    if (!phoneNo) return jsonError("請填寫手機號碼");
    if (phoneNo.length < 8 || phoneNo.length > 15) {
      return jsonError("手機號碼格式不正確");
    }
    if (!appointStartTime || !appointEndTime) {
      return jsonError("請選擇開始與結束時間");
    }
    if (appointStartTime >= appointEndTime) {
      return jsonError("結束時間須晚於開始時間");
    }

    const today = toTaipeiDateKey();
    const startDay = taipeiDateKeyFromIso(appointStartTime);
    const endDay = taipeiDateKeyFromIso(appointEndTime);
    if (!startDay || !endDay) {
      return jsonError("開始或結束時間格式不正確");
    }
    if (startDay !== today || endDay !== today) {
      return jsonError("現場預約僅限當日，不可跨日");
    }

    const item = await createLocalAppointment({
      receptionistId,
      receptionistName,
      appointStartTime,
      appointEndTime,
      visitReasonType,
      visitReasonDetail: visitReasonType === 4 ? "施工" : "",
      visitorInfo: {
        visitorFamilyName,
        visitorGivenName,
        companyName,
        phoneNo,
        email,
        gender: typeof body.gender === "number" ? body.gender : 0,
        ...(plateNo ? { plateNo } : {}),
      },
    });

    const appointCode = String(item.appointCode ?? "").trim();
    const waitingMessage = appointCode
      ? `預約已完成。請至「訪客報到」輸入手機或預約碼 ${appointCode}。`
      : "預約已完成。請至「訪客報到」輸入手機號碼。";

    void notifyApproversOfAppointment({
      visitorFamilyName,
      visitorGivenName,
      companyName,
      phoneNo,
      email,
      plateNo: plateNo || "",
      visitReasonType,
      appointStartTime,
      appointEndTime,
      receptionistName: item.receptionistName ?? receptionistName,
      orgLabel,
      appointCode,
    });

    return jsonOk({
      waitingMessage,
      appointCode,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "建立預約失敗",
      500,
    );
  }
};
