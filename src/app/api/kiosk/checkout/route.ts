import { visitorCheckOut } from "@/lib/hcp/visitor-api";
import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import {
  consumeCheckoutToken,
  peekCheckoutToken,
} from "@/lib/kiosk/session";

type CheckoutBody = {
  token?: string;
};

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as CheckoutBody;
    const token = String(body.token ?? "").trim();
    if (!token) return jsonError("缺少簽退憑證，請重新查詢");

    const appointRecordId = peekCheckoutToken(token);
    if (!appointRecordId) {
      return jsonError("簽退憑證已失效，請重新查詢", 401);
    }

    await visitorCheckOut(appointRecordId);
    consumeCheckoutToken(token);

    return jsonOk({ appointRecordId });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "簽退失敗",
      500,
    );
  }
};
