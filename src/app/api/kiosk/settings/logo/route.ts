import { readFile } from "fs/promises";
import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import {
  clearCustomLogo,
  extensionForMime,
  extensionFromFileName,
  getLogoAbsolutePath,
  getLogoContentType,
  getSettings,
  LOGO_MAX_BYTES,
  saveCustomLogo,
  toSettingsView,
} from "@/lib/kiosk/settings";

/** GET：自訂 logo 二進位；無自訂則 404（前端改用預設 public logo） */
export const GET = async () => {
  try {
    const settings = await getSettings();
    const logoPath = getLogoAbsolutePath(settings.logoFileName);
    if (!logoPath) return new Response("Not Found", { status: 404 });
    const bytes = await readFile(logoPath);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": getLogoContentType(settings.logoFileName),
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
};

/** POST：multipart 上傳 logo；欄位 reset=1 則恢復預設 */
export const POST = async (request: Request) => {
  try {
    const form = await request.formData();
    const reset = String(form.get("reset") ?? "").trim();
    if (reset === "1" || reset === "true") {
      return jsonOk(toSettingsView(await clearCustomLogo()));
    }

    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("請選擇 Logo 檔案");
    if (file.size <= 0) return jsonError("檔案為空");
    if (file.size > LOGO_MAX_BYTES) return jsonError("Logo 檔案不可超過 2MB");

    const extension =
      extensionForMime(file.type || "") || extensionFromFileName(file.name);
    if (!extension) return jsonError("僅支援 PNG、JPG、SVG、WebP");

    const buffer = Buffer.from(await file.arrayBuffer());
    return jsonOk(toSettingsView(await saveCustomLogo(buffer, extension)));
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "上傳 Logo 失敗",
      500,
    );
  }
};
