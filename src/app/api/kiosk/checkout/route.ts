import { requestVehicleExit } from "@/lib/hcp/vehicle-exit";
import { visitorCheckOut } from "@/lib/hcp/visitor-api";
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

const MESSAGES: Record<CheckoutMode, string> = {
  temp: "已登記臨時外出。請開車至出口；預約結束前可自原入口返回，無需再次報到。",
  return: "已確認返回，狀態恢復為在場。",
  final:
    "正式簽退成功，人員通行權限已撤銷。入口車牌時段權限仍由 YSCP 控管至預約結束。",
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

    const { appointRecordId, visitorName, plateNo } = session;

    if (mode === "temp") {
      await markTempOut({ recordId: appointRecordId, visitorName, plateNo });
      void requestVehicleExit(plateNo, "temp").catch(() => undefined);
    } else if (mode === "return") {
      await clearTempOut(appointRecordId);
    } else {
      await visitorCheckOut(appointRecordId);
      await markDeparted({ recordId: appointRecordId, visitorName, plateNo });
      void requestVehicleExit(plateNo, "final").catch(() => undefined);
    }

    consumeCheckoutToken(token);
    return jsonOk({
      mode,
      appointRecordId,
      plateNo: plateNo || null,
      message: MESSAGES[mode],
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "簽退失敗",
      500,
    );
  }
};
