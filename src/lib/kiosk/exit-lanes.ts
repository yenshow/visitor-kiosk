export type ExitLane = {
  cameraIndexCode: string;
  alarmOutputIndexCode: string;
};

/** 解析 HCP_EXIT_LANES：[{ "cameraIndexCode": "...", "alarmOutputIndexCode": "..." }] */
export const parseExitLanes = (raw: string | undefined): ExitLane[] => {
  const text = String(raw ?? "").trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const cameraIndexCode = String(row.cameraIndexCode ?? "").trim();
      const alarmOutputIndexCode = String(row.alarmOutputIndexCode ?? "").trim();
      if (!cameraIndexCode || !alarmOutputIndexCode) return [];
      return [{ cameraIndexCode, alarmOutputIndexCode }];
    });
  } catch {
    console.warn("[exit-lanes] HCP_EXIT_LANES JSON 解析失敗");
    return [];
  }
};

export const findExitLane = (
  lanes: ExitLane[],
  cameraIndexCode: string,
): ExitLane | undefined => {
  const key = String(cameraIndexCode ?? "").trim();
  if (!key) return undefined;
  return lanes.find((lane) => lane.cameraIndexCode === key);
};
