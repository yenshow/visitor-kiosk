import { reapplyAuth, registerCheckIn } from "@/lib/hcp/visitor-api";
import { jsonError, jsonOk, toTaipeiIso } from "@/lib/kiosk/api-helpers";
import {
  consumeCheckinToken,
  peekCheckinToken,
} from "@/lib/kiosk/session";

type CheckinBody = {
  acceptedNotice?: boolean;
  token?: string;
};

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as CheckinBody;

    if (!body.acceptedNotice) {
      return jsonError("請先閱讀並同意訪客須知");
    }

    const token = String(body.token ?? "").trim();
    if (!token) return jsonError("缺少報到憑證，請重新查詢預約");

    const item = peekCheckinToken(token);
    if (!item) {
      return jsonError("報到憑證已失效，請重新查詢預約", 401);
    }

    const appointId = String(item.appointID ?? "").trim();
    const visitorId = String(item.visitorInfo?.visitorId ?? "").trim();
    if (!appointId || !visitorId) {
      return jsonError("預約資料不完整，請洽接待人員");
    }

    const visitStartTime = toTaipeiIso(new Date());
    const visitEndTime =
      item.appointEndTime || visitStartTime.replace(/T.*/, "T23:59:59+08:00");

    const visitPurposeType = Number(item.visitReasonType ?? 0);

    const result = await registerCheckIn({
      appointId,
      visitorId,
      visitStartTime,
      visitEndTime,
      visitPurposeType: Number.isFinite(visitPurposeType)
        ? visitPurposeType
        : 0,
      visitorInfo: item.visitorInfo,
    });

    consumeCheckinToken(token);

    void reapplyAuth(visitorId).catch(() => undefined);

    return jsonOk({
      appointRecordId: result.appointRecordId ?? null,
      visitorId: result.visitorId ?? visitorId,
      qrCodeImage: result.qrCodeImage ?? null,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "簽到失敗",
      500,
    );
  }
};
