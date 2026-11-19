import { getConfig } from "@/lib/config";
import { LICENSE_PRODUCT } from "@/lib/license/constants";
import { getDeviceFingerprint } from "@/lib/license/fingerprint";
import { activateOnline } from "@/lib/license/platform";
import { verifyLicensePayload } from "@/lib/license/sign";
import {
  getLicenseState,
  setLicenseState,
  type KioskLicenseState,
} from "@/lib/license/store";

const trimKey = (raw: unknown): string | null => {
  if (raw == null || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed || null;
};

const isBlank = (v: unknown): boolean =>
  v == null || (typeof v === "string" && !v.trim());

/** 線上啟用（yscp-bridge） */
export const activateLicenseByKey = async (
  licenseKey: string,
): Promise<KioskLicenseState> => {
  const trimmedKey = trimKey(licenseKey);
  if (!trimmedKey) throw new Error("請提供 licenseKey");

  const deviceFingerprint = getDeviceFingerprint();
  const result = await activateOnline({
    licenseKey: trimmedKey,
    deviceFingerprint,
  });

  const current = await getLicenseState({ bypassCache: true, real: true });
  const isExtension =
    result.isExtension === true ||
    (isBlank(result.serialNumber) && Boolean(current.licenseKey));

  if (isExtension) {
    return setLicenseState({
      mergeFeatures: true,
      features: result.features,
      preserveMainLicenseKey: true,
      deviceFingerprint: result.deviceFingerprint
        ? String(result.deviceFingerprint)
        : undefined,
      activationMethod: current.activationMethod || "online",
    });
  }

  const mainKey = trimKey(result.licenseKey) || trimmedKey;
  return setLicenseState({
    features: result.features,
    serialNumber: isBlank(result.serialNumber)
      ? null
      : String(result.serialNumber),
    licenseKey: mainKey,
    activationMethod: "online",
    deviceFingerprint: result.deviceFingerprint ?? deviceFingerprint,
  });
};

export const buildOfflineRequestBase64 = (licenseKey: string): string => {
  const trimmedKey = trimKey(licenseKey);
  if (!trimmedKey) throw new Error("請提供 licenseKey");
  return Buffer.from(
    JSON.stringify([trimmedKey, getDeviceFingerprint()]),
    "utf8",
  ).toString("base64");
};

/** 匯入離線回應（含 signature） */
export const importOfflineLicensePayload = async (
  body: unknown,
): Promise<KioskLicenseState> => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("離線授權檔格式不正確");
  }

  const secret = getConfig().license.signSecret;
  if (!secret) {
    throw new Error("未設定 LICENSE_SIGN_SECRET，無法驗簽離線授權檔");
  }

  const verified = verifyLicensePayload(body, secret);
  if (!verified.ok) {
    throw new Error(`離線授權檔驗簽失敗：${verified.reason}`);
  }

  const payload = body as {
    product?: unknown;
    features?: unknown;
    isExtension?: unknown;
    refreshedAt?: unknown;
    licenseKey?: unknown;
    serialNumber?: unknown;
    deviceFingerprint?: unknown;
  };

  if (payload.product && payload.product !== LICENSE_PRODUCT) {
    throw new Error("授權產品不匹配");
  }
  if (!Array.isArray(payload.features) || payload.features.length === 0) {
    throw new Error("離線授權檔缺少 features");
  }

  const isExtension =
    payload.isExtension === true ||
    (payload.isExtension !== false && payload.refreshedAt != null);

  const deviceFingerprint = isBlank(payload.deviceFingerprint)
    ? null
    : String(payload.deviceFingerprint);

  if (isExtension) {
    return setLicenseState({
      mergeFeatures: true,
      features: payload.features as string[],
      preserveMainLicenseKey: true,
      deviceFingerprint: deviceFingerprint ?? undefined,
      activationMethod: "offline",
    });
  }

  return setLicenseState({
    features: payload.features as string[],
    serialNumber: isBlank(payload.serialNumber)
      ? null
      : String(payload.serialNumber),
    licenseKey: trimKey(payload.licenseKey),
    activationMethod: "offline",
    deviceFingerprint,
  });
};
