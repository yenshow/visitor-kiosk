import { getConfig } from "@/lib/config";
import { visitorCheckOut } from "@/lib/yscp/visitor-api";
import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import {
  clearTempOut,
  markDeparted,
  markTempOut,
} from "@/lib/kiosk/presence";
import {
  consumeCheckoutToken,
  peekCheckoutToken,
} from "@/lib/kiosk/session";

type CheckoutMode = "temp" | "return" | "final";

type CheckoutBody = {
  token?: string;
  mode?: CheckoutMode;
};

const buildMessages = (
  minutes: number,
): Record<CheckoutMode, string> => ({
  temp: `已登記臨時外出。當日返回請至「訪客報到」確認返回；若跨日至翌日，請再報到並同意訪客須知。請於 ${minutes} 分鐘內離場。`,
  return: "已確認返回，狀態恢復為在場。",
  final: `正式簽退成功，人員通行權限已撤銷。請於 ${minutes} 分鐘內離場。`,
});

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as CheckoutBody;
    const token = String(body.token ?? "").trim();
    const mode: CheckoutMode =
      body.mode === "temp" || body.mode === "return" || body.mode === "final"
        ? body.mode
        : "final";

    if (!token) return jsonError("缺少簽退憑證，請重新查詢");

    const session = peekCheckoutToken(token);
    if (!session) {
      return jsonError("簽退憑證已失效，請重新查詢", 401);
    }

    const {
      appointRecordId,
      visitorName,
      plateNo,
      phoneNo,
      companyName,
      receptionistName,
    } = session;
    const exitGateMinutes = getConfig().yscp.exitGateMinutes;
    const messages = buildMessages(exitGateMinutes);

    if (mode === "temp") {
      await markTempOut({
        recordId: appointRecordId,
        visitorName,
        plateNo,
        phoneNo,
        companyName,
        receptionistName,
      });
    } else if (mode === "return") {
      await clearTempOut(appointRecordId);
    } else {
      await visitorCheckOut(appointRecordId);
      await markDeparted({
        recordId: appointRecordId,
        visitorName,
        plateNo,
        phoneNo,
        companyName,
        receptionistName,
      });
    }

    consumeCheckoutToken(token);
    return jsonOk({
      mode,
      appointRecordId,
      plateNo: plateNo || null,
      message: messages[mode],
      exitGateMinutes:
        mode === "temp" || mode === "final" ? exitGateMinutes : null,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "簽退失敗",
      500,
    );
  }
};
