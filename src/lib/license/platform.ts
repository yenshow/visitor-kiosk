import { getConfig } from "@/lib/config";

export type PlatformActivateResult = {
  features: string[];
  serialNumber?: string | null;
  licenseKey?: string | null;
  isExtension?: boolean;
  deviceFingerprint?: string | null;
  refreshedAt?: string | null;
};

export class LicensePlatformError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "LicensePlatformError";
    this.statusCode =
      Number.isFinite(statusCode) && statusCode >= 400 && statusCode <= 599
        ? statusCode
        : 502;
  }
}

const unwrapResult = (data: unknown): PlatformActivateResult => {
  if (!data || typeof data !== "object") {
    throw new LicensePlatformError("授權平台回傳格式不正確");
  }
  const body = data as {
    success?: boolean;
    result?: PlatformActivateResult;
    message?: string;
    statusCode?: number;
  };
  if (body.success === true && body.result && typeof body.result === "object") {
    return body.result;
  }
  if (body.success === false) {
    throw new LicensePlatformError(
      body.message || "授權平台回傳錯誤",
      body.statusCode,
    );
  }
  throw new LicensePlatformError("授權平台回傳格式不正確");
};

export const activateOnline = async ({
  licenseKey,
  deviceFingerprint,
}: {
  licenseKey: string;
  deviceFingerprint: string;
}): Promise<PlatformActivateResult> => {
  const trimmedKey = String(licenseKey ?? "").trim();
  const fingerprint = String(deviceFingerprint ?? "").trim();
  if (!trimmedKey) throw new LicensePlatformError("licenseKey 必須為字串", 400);
  if (!fingerprint) {
    throw new LicensePlatformError("deviceFingerprint 必須為字串", 400);
  }

  const { license } = getConfig();
  const baseURL = license.platformApiBaseUrl;
  if (!baseURL) {
    throw new LicensePlatformError("LICENSE_PLATFORM_API_BASE_URL 未設定", 500);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), license.platformTimeoutMs);

  try {
    const res = await fetch(`${baseURL.replace(/\/$/, "")}/activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        licenseKey: trimmedKey,
        deviceFingerprint: fingerprint,
      }),
      signal: controller.signal,
    });

    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg =
        data &&
        typeof data === "object" &&
        typeof (data as { message?: unknown }).message === "string"
          ? String((data as { message: string }).message)
          : `授權平台啟用失敗（HTTP ${res.status}）`;
      throw new LicensePlatformError(msg, res.status);
    }

    const result = unwrapResult(data);
    if (!Array.isArray(result.features)) {
      throw new LicensePlatformError("授權平台回傳格式不正確");
    }
    return result;
  } catch (error) {
    if (error instanceof LicensePlatformError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new LicensePlatformError("授權平台連線逾時", 504);
    }
    throw new LicensePlatformError(
      error instanceof Error ? error.message : "授權平台啟用失敗",
    );
  } finally {
    clearTimeout(timer);
  }
};
