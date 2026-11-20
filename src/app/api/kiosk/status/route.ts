import { jsonOk } from "@/lib/kiosk/api-helpers";

/** 健康檢查（無授權閘道） */
export const GET = async () => jsonOk({ ready: true });
