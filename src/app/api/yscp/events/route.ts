import { after } from "next/server";
import { getConfig } from "@/lib/config";
import { pulseAlarmOutput } from "@/lib/yscp/exit-gate";
import {
  isExitPlateAllowed,
  tryClaimGateDedup,
} from "@/lib/kiosk/gate-allowlist";
import { findExitLane } from "@/lib/kiosk/exit-lanes";
import {
  asJsonObject,
  extractYscpEventToken,
  parsePlateEvents,
  summarizeYscpEventBody,
  type ParsedPlateEvent,
} from "@/lib/yscp/event-parse";

const processPlateEvent = async (event: ParsedPlateEvent) => {
  const { yscp } = getConfig();
  const lane = findExitLane(yscp.exitLanes, event.cameraIndexCode);
  if (!lane) {
    console.info(
      `[yscp-events] 略過非出口相機 camera=${event.cameraIndexCode} plate=${event.plateNo}`,
    );
    return;
  }

  const allow = await isExitPlateAllowed(event.plateNo);
  if (!allow.allowed) {
    console.info(
      `[yscp-events] 車牌未在出場名單 plate=${event.plateNo} camera=${event.cameraIndexCode}`,
    );
    return;
  }

  if (!tryClaimGateDedup(event.plateNo, event.cameraIndexCode)) {
    console.info(
      `[yscp-events] 去重略過 plate=${event.plateNo} camera=${event.cameraIndexCode}`,
    );
    return;
  }

  try {
    const { holdMs } = await pulseAlarmOutput({
      alarmOutputIndexCode: lane.alarmOutputIndexCode,
    });
    console.info(
      `[yscp-events] 開閘 reason=${allow.reason} plate=${event.plateNo} relay=${lane.alarmOutputIndexCode} hold=${holdMs}ms`,
    );
  } catch (error) {
    console.error(
      `[yscp-events] 開閘失敗 plate=${event.plateNo}`,
      error instanceof Error ? error.message : error,
    );
  }
};

/** 立刻回 200，背景比對／開閘，避免 YSCP 推送逾時 */
export const POST = async (request: Request) => {
  const url = new URL(request.url);
  let body = null as ReturnType<typeof asJsonObject>;
  try {
    body = asJsonObject(await request.json());
  } catch {
    body = null;
  }

  const expected = getConfig().yscp.eventToken;
  if (!expected) {
    return Response.json(
      { code: "1", msg: "event token not configured" },
      { status: 503 },
    );
  }

  if (extractYscpEventToken(request, body, url) !== expected) {
    return Response.json({ code: "1", msg: "invalid token" }, { status: 401 });
  }

  const events = parsePlateEvents(body);
  if (events.length === 0) {
    console.info(`[yscp-events] 無法解析車牌事件 ${summarizeYscpEventBody(body)}`);
    return Response.json({ code: "0", msg: "ok" });
  }

  console.info(
    `[yscp-events] 收到 ${events.length} 筆車牌事件 ${events
      .map((event) => `${event.plateNo}@${event.cameraIndexCode}`)
      .join(",")}`,
  );

  after(async () => {
    for (const event of events) {
      await processPlateEvent(event);
    }
  });

  return Response.json({ code: "0", msg: "ok" });
};
