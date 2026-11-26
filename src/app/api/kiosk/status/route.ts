import { jsonOk } from "@/lib/kiosk/api-helpers";
import { isVisitorLicensed } from "@/lib/license/gate";

export const GET = async () =>
  jsonOk({ ready: true, licensed: await isVisitorLicensed() });
