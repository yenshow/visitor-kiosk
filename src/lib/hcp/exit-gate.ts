import { artemisPostSecure } from "./artemis-client";
import type { HcpApiResult } from "./visitor-api";

export type HcpCamera = {
  cameraIndexCode: string;
  cameraName: string;
  encodeDevIndexCode: string;
  capabilitySet: string;
  status?: number;
};

export type HcpAlarmOutput = {
  alarmOutputIndexCode: string;
  alarmOutputName: string;
  devIndexCode: string;
  status?: number;
};

type PageList = { total?: number; list?: Record<string, unknown>[] };

const assertOk = <T>(result: HcpApiResult<T>, fallback: string): T => {
  if (String(result?.code) !== "0") {
    throw new Error(result?.msg || fallback);
  }
  return result.data;
};

/** action: 1 = 開閘，0 = 關閉 */
export const controlAlarmOutput = async (input: {
  alarmOutputIndexCode: string;
  action?: 0 | 1;
}): Promise<unknown> => {
  const alarmOutputIndexCode = String(input.alarmOutputIndexCode ?? "").trim();
  if (!alarmOutputIndexCode) throw new Error("缺少 alarmOutputIndexCode");

  const { data } = await artemisPostSecure<HcpApiResult<unknown>>(
    "/artemis/api/resource/v1/alarmOutput/controlling",
    {
      alarmOutputIndexCode,
      action: input.action === 0 ? 0 : 1,
    },
  );
  return assertOk(data, "道閘控制失敗");
};

/** 分頁查詢全部攝影機通道 */
export const listCameras = async (): Promise<HcpCamera[]> => {
  const all: HcpCamera[] = [];
  let pageNo = 1;
  let total = Infinity;

  while (all.length < total && pageNo <= 200) {
    const { data } = await artemisPostSecure<HcpApiResult<PageList>>(
      "/artemis/api/resource/v1/cameras",
      { pageNo, pageSize: 100 },
    );
    const page = assertOk(data, "查詢攝影機失敗");
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
): Promise<HcpAlarmOutput[]> => {
  const devIndexCode = String(encodeDevIndexCode ?? "").trim();
  if (!devIndexCode) throw new Error("缺少 encodeDevIndexCode");

  const { data } = await artemisPostSecure<HcpApiResult<PageList>>(
    "/artemis/api/resource/v1/alarmOutput/advance/alarmOutputList",
    {
      pageNo: 1,
      pageSize: 50,
      devIndexCode,
      deviceType: "encodeDevice",
    },
  );
  const page = assertOk(data, "查詢警報輸出失敗");
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
export const isLikelyLprCamera = (cam: HcpCamera): boolean => {
  if (cam.capabilitySet.toLowerCase().includes("event_veh")) return true;
  const name = cam.cameraName.toUpperCase();
  if (["LPR", "PLATE", "GATE", "EXIT"].some((kw) => name.includes(kw))) {
    return true;
  }
  return /車牌|出口/.test(cam.cameraName);
};
