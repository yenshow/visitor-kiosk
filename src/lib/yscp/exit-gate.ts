import { artemisPostSecure } from "./artemis-client";
import { YSCP_RELAY_HOLD_MS } from "@/lib/config";
import { assertYscpOk, type YscpApiResult } from "./visitor-api";

export type YscpCamera = {
  cameraIndexCode: string;
  cameraName: string;
  encodeDevIndexCode: string;
  capabilitySet: string;
  status?: number;
};

export type YscpAlarmOutput = {
  alarmOutputIndexCode: string;
  alarmOutputName: string;
  devIndexCode: string;
  status?: number;
};

type PageList = { total?: number; list?: Record<string, unknown>[] };

/** action: 1 = 開閘，0 = 關閉（維持致能直到再送 0） */
export const controlAlarmOutput = async (input: {
  alarmOutputIndexCode: string;
  action?: 0 | 1;
}): Promise<unknown> => {
  const alarmOutputIndexCode = String(input.alarmOutputIndexCode ?? "").trim();
  if (!alarmOutputIndexCode) throw new Error("缺少 alarmOutputIndexCode");

  const { data } = await artemisPostSecure<YscpApiResult<unknown>>(
    "/artemis/api/resource/v1/alarmOutput/controlling",
    {
      alarmOutputIndexCode,
      action: input.action === 0 ? 0 : 1,
    },
  );
  return assertYscpOk(data, "道閘控制失敗");
};

const waitMs = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** 同一繼電器若連續脈衝，較新的開啟不應被較舊的延時關閉關掉 */
const pulseSeqByRelay = new Map<string, number>();

/** 開閘後維持 holdMs，再送關閉 */
export const pulseAlarmOutput = async (input: {
  alarmOutputIndexCode: string;
  holdMs?: number;
}): Promise<{ holdMs: number }> => {
  const alarmOutputIndexCode = String(input.alarmOutputIndexCode ?? "").trim();
  if (!alarmOutputIndexCode) throw new Error("缺少 alarmOutputIndexCode");

  const holdMs = Math.max(
    200,
    Number.isFinite(input.holdMs) ? Number(input.holdMs) : YSCP_RELAY_HOLD_MS,
  );
  const seq = (pulseSeqByRelay.get(alarmOutputIndexCode) ?? 0) + 1;
  pulseSeqByRelay.set(alarmOutputIndexCode, seq);

  await controlAlarmOutput({ alarmOutputIndexCode, action: 1 });
  await waitMs(holdMs);
  if (pulseSeqByRelay.get(alarmOutputIndexCode) !== seq) {
    return { holdMs };
  }
  try {
    await controlAlarmOutput({ alarmOutputIndexCode, action: 0 });
  } catch (error) {
    console.error(
      `[exit-gate] 繼電器關閉失敗 relay=${alarmOutputIndexCode}`,
      error instanceof Error ? error.message : error,
    );
  }
  return { holdMs };
};

/** 分頁查詢全部攝影機通道 */
export const listCameras = async (): Promise<YscpCamera[]> => {
  const all: YscpCamera[] = [];
  let pageNo = 1;
  let total = Infinity;

  while (all.length < total && pageNo <= 200) {
    const { data } = await artemisPostSecure<YscpApiResult<PageList>>(
      "/artemis/api/resource/v1/cameras",
      { pageNo, pageSize: 100 },
    );
    const page = assertYscpOk(data, "查詢攝影機失敗");
    total = Number(page?.total ?? 0);
    const list = Array.isArray(page?.list) ? page.list : [];
    if (list.length === 0) break;

    for (const row of list) {
      const cameraIndexCode = String(row.cameraIndexCode ?? "").trim();
      if (!cameraIndexCode) continue;
      all.push({
        cameraIndexCode,
        cameraName: String(row.cameraName ?? "").trim(),
        encodeDevIndexCode: String(row.encodeDevIndexCode ?? "").trim(),
        capabilitySet: String(row.capabilitySet ?? "").trim(),
        status: typeof row.status === "number" ? row.status : undefined,
      });
    }
    pageNo += 1;
  }
  return all;
};

/** 依編碼設備 ID 查警報輸出（繼電器） */
export const listAlarmOutputs = async (
  encodeDevIndexCode: string,
): Promise<YscpAlarmOutput[]> => {
  const devIndexCode = String(encodeDevIndexCode ?? "").trim();
  if (!devIndexCode) throw new Error("缺少 encodeDevIndexCode");

  const { data } = await artemisPostSecure<YscpApiResult<PageList>>(
    "/artemis/api/resource/v1/alarmOutput/advance/alarmOutputList",
    {
      pageNo: 1,
      pageSize: 50,
      devIndexCode,
      deviceType: "encodeDevice",
    },
  );
  const page = assertYscpOk(data, "查詢警報輸出失敗");
  return (page?.list ?? []).flatMap((row) => {
    const alarmOutputIndexCode = String(row.alarmOutputIndexCode ?? "").trim();
    if (!alarmOutputIndexCode) return [];
    return [
      {
        alarmOutputIndexCode,
        alarmOutputName: String(row.alarmOutputName ?? "").trim(),
        devIndexCode: String(row.devIndexCode ?? "").trim(),
        status: typeof row.status === "number" ? row.status : undefined,
      },
    ];
  });
};

/** 能力集或名稱疑似車牌相機 */
export const isLikelyLprCamera = (cam: YscpCamera): boolean => {
  if (cam.capabilitySet.toLowerCase().includes("event_veh")) return true;
  const name = cam.cameraName.toUpperCase();
  if (["LPR", "PLATE", "GATE", "EXIT"].some((kw) => name.includes(kw))) {
    return true;
  }
  return /車牌|出口/.test(cam.cameraName);
};
