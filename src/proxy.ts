import { NextResponse, type NextRequest } from "next/server";
import {
  getClientIp,
  isLocalHostHeader,
  isLoopbackIp,
  parseAdminIps,
} from "@/lib/kiosk/access";

const ADMIN_API_EXACT = new Set([
  "/api/kiosk/records",
  "/api/kiosk/records/reset",
  "/api/kiosk/yscp/subscribe",
]);

const isAdminPath = (pathname: string, method: string): boolean => {
  if (pathname === "/setting" || pathname.startsWith("/setting/")) return true;
  if (pathname === "/api/kiosk/settings" && method === "PUT") return true;
  if (pathname === "/api/kiosk/settings/logo" && method === "POST") return true;
  return ADMIN_API_EXACT.has(pathname);
};

/** Next.js 16：原 middleware 慣例改名為 proxy */
export const proxy = (request: NextRequest) => {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  if (!isAdminPath(pathname, method)) return NextResponse.next();

  // NextRequest.ip：dev／部分 runtime 有；portable 靠 with-client-ip 的 x-real-ip
  const ip = getClientIp(request.headers, request.ip);
  const adminIps = parseAdminIps(process.env.KIOSK_ADMIN_IPS);
  const allowed =
    isLoopbackIp(ip) ||
    (!ip && isLocalHostHeader(request.headers.get("host"))) ||
    (ip !== "" && adminIps.includes(ip));

  if (allowed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { code: "403", msg: "無權限：僅本機或管理員 IP 可操作", data: null },
      { status: 403 },
    );
  }

  return new NextResponse("Forbidden：僅本機或管理員 IP 可開啟設定頁", {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};

export const config = {
  matcher: [
    "/setting",
    "/setting/:path*",
    "/api/kiosk/settings",
    "/api/kiosk/settings/logo",
    "/api/kiosk/records",
    "/api/kiosk/records/reset",
    "/api/kiosk/yscp/subscribe",
  ],
};
