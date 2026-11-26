import { createHmac, timingSafeEqual } from "crypto";

const toSortedPayload = (
  payload: Record<string, unknown>,
): Record<string, unknown> => {
  const keys = Object.keys(payload).sort((a, b) => a.localeCompare(b));
  const sorted: Record<string, unknown> = {};
  for (const key of keys) sorted[key] = payload[key];
  return sorted;
};

/**
 * 離線授權驗簽：payload（不含 signature）依 key 排序後
 * JSON.stringify → HMAC-SHA256 → hex 小寫
 */
export const verifyLicensePayload = (
  fullPayload: unknown,
  secret: string,
): { ok: true } | { ok: false; reason: string } => {
  if (
    !fullPayload ||
    typeof fullPayload !== "object" ||
    Array.isArray(fullPayload)
  ) {
    return { ok: false, reason: "payload 必須為 object" };
  }
  if (!secret) return { ok: false, reason: "LICENSE_SIGN_SECRET 未設定" };

  const receivedSig = String(
    (fullPayload as { signature?: unknown }).signature ?? "",
  )
    .trim()
    .toLowerCase();
  if (!receivedSig) return { ok: false, reason: "缺少 signature" };

  const rest = { ...(fullPayload as Record<string, unknown>) };
  delete rest.signature;
  const message = JSON.stringify(toSortedPayload(rest));
  const expectedSig = createHmac("sha256", secret)
    .update(message, "utf8")
    .digest("hex")
    .toLowerCase();

  try {
    const a = Buffer.from(receivedSig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length) return { ok: false, reason: "signature 不匹配" };
    return timingSafeEqual(a, b)
      ? { ok: true }
      : { ok: false, reason: "signature 不匹配" };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "signature 比對失敗",
    };
  }
};
