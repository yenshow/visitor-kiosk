import { getConfig } from "@/lib/config";
import { getPresenceStore } from "@/lib/kiosk/presence";
import { normalizePlateNo } from "@/lib/kiosk/plate";

export type ExitAllowReason = "temp_out" | "departed";

/** 出場允許：臨時外出或當日正式簽退 */
export const isExitPlateAllowed = async (
  plateRaw: string,
): Promise<{ allowed: boolean; reason?: ExitAllowReason; plateNo: string }> => {
  const plateNo = normalizePlateNo(plateRaw);
  if (!plateNo) return { allowed: false, plateNo: "" };

  const store = await getPresenceStore();
  if (store.tempOut.some((item) => normalizePlateNo(item.plateNo) === plateNo)) {
    return { allowed: true, reason: "temp_out", plateNo };
  }
  if (
    store.departedToday.some(
      (item) => normalizePlateNo(item.plateNo) === plateNo,
    )
  ) {
    return { allowed: true, reason: "departed", plateNo };
  }
  return { allowed: false, plateNo };
};

const recentGateKeys = new Map<string, number>();

/** 同車牌＋同相機短時間內不重複開閘；true = 可開閘 */
export const tryClaimGateDedup = (
  plateNo: string,
  cameraIndexCode: string,
): boolean => {
  const plate = normalizePlateNo(plateNo);
  const camera = String(cameraIndexCode ?? "").trim();
  if (!plate || !camera) return false;

  const dedupMs = getConfig().hcp.gateDedupMs;
  const now = Date.now();
  for (const [key, at] of recentGateKeys) {
    if (now - at > dedupMs) recentGateKeys.delete(key);
  }

  const key = `${plate}|${camera}`;
  const prev = recentGateKeys.get(key);
  if (prev !== undefined && now - prev < dedupMs) return false;

  recentGateKeys.set(key, now);
  return true;
};
