import type { NextConfig } from "next";

/**
 * 開發模式下允許以區網 IP 開啟頁面（否則 /_next 資源被擋，
 * React 無法 hydration → 按鈕看起來點了沒反應）。
 * 可用環境變數 ALLOWED_DEV_ORIGINS 覆寫，逗號分隔。
 */
const allowedDevOrigins = String(
  process.env.ALLOWED_DEV_ORIGINS ||
    "localhost,127.0.0.1,192.168.2.8,*.local",
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
