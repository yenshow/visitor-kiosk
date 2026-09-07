import { createHmac } from "crypto";
import https from "https";
import { getConfig, type AppConfig } from "@/lib/config";

const ACCEPT = "application/json";
const CONTENT_TYPE = "application/json;charset=UTF-8";

export type ArtemisCredentials = {
  hostname: string;
  port: number;
  baseUrl: string;
  accessKey: string;
  secretKey: string;
  rejectUnauthorized: boolean;
  timeoutMs: number;
};

export const getArtemisCredentials = (
  config: AppConfig = getConfig(),
): ArtemisCredentials => ({
  hostname: config.hcp.hostname,
  port: config.hcp.port,
  baseUrl: config.hcp.baseUrl,
  accessKey: config.hcp.accessKey,
  secretKey: config.hcp.secretKey,
  rejectUnauthorized: config.hcp.rejectUnauthorized,
  timeoutMs: config.hcp.timeoutMs,
});

export const buildSignature = (
  secretKey: string,
  path: string,
  method = "POST",
): string => {
  const plain = `${method}\n${ACCEPT}\n${CONTENT_TYPE}\n${path}`;
  return createHmac("sha256", secretKey).update(plain).digest("base64");
};

export type ArtemisResponse<T = unknown> = {
  status: number;
  data: T;
};

/** HTTPS POST（內網自簽憑證可設 HCP_REJECT_UNAUTHORIZED=false） */
export const artemisPostSecure = async <T = unknown>(
  path: string,
  body: Record<string, unknown> = {},
  credentials?: ArtemisCredentials,
): Promise<ArtemisResponse<T>> => {
  const creds = credentials ?? getArtemisCredentials();
  if (!creds.accessKey || !creds.secretKey) {
    throw new Error("尚未設定連線金鑰，請在 .env 填入 OpenAPI 金鑰後重啟");
  }

  const payload = JSON.stringify(body);
  const headers: Record<string, string> = {
    Accept: ACCEPT,
    "Content-Type": CONTENT_TYPE,
    "X-Ca-Key": creds.accessKey,
    "X-Ca-Signature": buildSignature(creds.secretKey, path),
    "Content-Length": Buffer.byteLength(payload).toString(),
  };

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: "https:",
        hostname: creds.hostname,
        port: creds.port,
        path,
        method: "POST",
        headers,
        rejectUnauthorized: creds.rejectUnauthorized,
        timeout: creds.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const contentType = String(res.headers["content-type"] || "");
          let data: T;
          try {
            data = contentType.includes("json")
              ? (JSON.parse(text) as T)
              : (text as unknown as T);
          } catch {
            data = text as unknown as T;
          }

          const status = res.statusCode ?? 500;
          if (status >= 400) {
            const hint =
              typeof data === "string"
                ? data.slice(0, 200)
                : JSON.stringify(data).slice(0, 200);
            reject(new Error(`YSCP HTTP ${status}: ${hint || "請求失敗"}`));
            return;
          }

          resolve({ status, data });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("YSCP 連線逾時"));
    });
    req.write(payload);
    req.end();
  });
};
