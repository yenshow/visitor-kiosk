import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { updateVisitStatus, VisitStateConflict } from "@/lib/kiosk/visit-actions";
import {
  consumeCheckoutToken,
  peekCheckoutToken,
} from "@/lib/kiosk/session";

type CheckoutMode = "temp" | "return" | "final";

type CheckoutBody = {
  token?: string;
  mode?: CheckoutMode;
};

const MESSAGES: Record<CheckoutMode, string> = {
  temp: "已登記臨時外出。當日返回請至「訪客報到」確認返回；若跨日至翌日，請再報到並同意訪客須知。",
  return: "已確認返回，狀態恢復為在場。",
  final: "正式簽退成功。",
};

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

    await updateVisitStatus(
      session.appointRecordId,
      session.status,
      session.eventCount,
      mode,
    );

    consumeCheckoutToken(token);
    return jsonOk({
      mode,
      message: MESSAGES[mode],
    });
  } catch (error) {
    if (error instanceof VisitStateConflict) return jsonError(error.message, 409);
    return jsonError(
      error instanceof Error ? error.message : "簽退失敗",
      500,
    );
  }
};
