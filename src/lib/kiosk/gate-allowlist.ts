import { getConfig } from "@/lib/config";
import { getPresenceStore } from "@/lib/kiosk/presence";
import { normalizePlateNo } from "@/lib/kiosk/plate";

export type ExitAllowReason = "temp_out" | "departed";

const isWithinExitWindow = (at: string, windowMs: number): boolean => {
  const atMs = Date.parse(at);
  if (!Number.isFinite(atMs)) return false;
  const elapsed = Date.now() - atMs;
  return elapsed >= 0 && elapsed <= windowMs;
};

/** 出場允許：臨時外出或正式簽退，且登記時間起算在開閘時限內 */
export const isExitPlateAllowed = async (
  plateRaw: string,
): Promise<{ allowed: boolean; reason?: ExitAllowReason; plateNo: string }> => {
  const plateNo = normalizePlateNo(plateRaw);
  if (!plateNo) return { allowed: false, plateNo: "" };

  const windowMs = getConfig().yscp.exitGateMinutes * 60_000;
  const store = await getPresenceStore();

  const lists: { reason: ExitAllowReason; items: { plateNo: string; at: string }[] }[] =
    [
      { reason: "temp_out", items: store.tempOut },
      { reason: "departed", items: store.departed },
    ];

  for (const { reason, items } of lists) {
    const hit = items.find(
      (item) => normalizePlateNo(item.plateNo) === plateNo,
    );
    if (hit && isWithinExitWindow(hit.at, windowMs)) {
      return { allowed: true, reason, plateNo };
    }
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

  const dedupMs = getConfig().yscp.gateDedupMs;
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
