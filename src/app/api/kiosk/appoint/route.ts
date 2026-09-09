import {
  createAppointment,
  getAutomaticApproval,
} from "@/lib/yscp/visitor-api";
import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { normalizePlateNo } from "@/lib/kiosk/plate";
import { rememberPlate } from "@/lib/kiosk/plate-cache";
import { normalizePhoneDigits } from "@/lib/kiosk/phone";
import { isValidEmail } from "@/lib/kiosk/visitor-fields";

type AppointBody = {
  receptionistId?: string;
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
  try {
    const body = (await request.json()) as AppointBody;

    const receptionistId = String(body.receptionistId ?? "").trim();
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
      return jsonError("請選擇開始與結束日期時間");
    }
    if (appointStartTime >= appointEndTime) {
      return jsonError("結束時間須晚於開始時間");
    }

    const result = await createAppointment({
      receptionistId,
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

    if (Array.isArray(result.watchListInfo) && result.watchListInfo.length > 0) {
      return jsonError("預約需現場人員協助處理，請洽接待櫃台", 409);
    }

    if (plateNo) {
      await rememberPlate({
        plateNo,
        phoneNo,
        visitorId: result.visitorId,
        appointId: result.appointRecordId,
      });
    }

    const automaticApproval = await getAutomaticApproval();
    const waitingMessage =
      automaticApproval === 1
        ? "預約已送出，系統審核中。確認完成後將提供預約密碼，請再使用「訪客報到」。"
        : "預約已送出，請等待內部人員確認。確認完成後將由系統提供預約密碼，再使用「訪客報到」。";

    return jsonOk({
      appointRecordId: result.appointRecordId ?? null,
      visitorId: result.visitorId ?? null,
      automaticApproval,
      waitingMessage,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "建立預約失敗",
      500,
    );
  }
};
