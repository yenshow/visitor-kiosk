/**
 * 出口 LPR 一次性放行 adapter。
 * YSCP 停車／道閘 OpenAPI 未確認前為 no-op，不擋 YSOP 狀態更新。
 */
export type VehicleExitMode = "temp" | "final";

export const requestVehicleExit = async (
  plateNo: string,
  mode: VehicleExitMode,
): Promise<{ ok: boolean; skipped: boolean }> => {
  const plate = String(plateNo ?? "").trim();
  if (!plate) return { ok: true, skipped: true };

  console.info(
    `[vehicle-exit] no-op: plate=${plate} mode=${mode}（待接 YSCP 道閘 API）`,
  );
  return { ok: true, skipped: true };
};
