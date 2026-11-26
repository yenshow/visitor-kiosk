import { createHash } from "crypto";
import os from "os";

/**
 * 與 ba-backend licenseRoutes.getDeviceFingerprint 相同算法：
 * sha256(hostname + ":" + 第一個非內部 IPv4 MAC)
 */
export const getDeviceFingerprint = (): string => {
  const hostname = os.hostname() || "unknown";
  let mac = "";
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      const family = String(iface.family);
      if (
        (family === "IPv4" || family === "4") &&
        !iface.internal &&
        iface.mac
      ) {
        mac = (iface.mac || "").replace(/:/g, "").toLowerCase();
        if (mac && mac !== "000000000000") break;
      }
    }
    if (mac) break;
  }
  const raw = `${hostname}:${mac || "nomac"}`;
  return createHash("sha256").update(raw, "utf8").digest("hex");
};
