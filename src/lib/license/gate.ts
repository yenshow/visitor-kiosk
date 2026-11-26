import { VISITOR_FEATURE_KEY } from "@/lib/license/constants";
import { isVisitorLicensed } from "@/lib/license/store";

export { isVisitorLicensed };

/** 未授權 visitor 時回 403 FEATURE_NOT_LICENSED */
export const jsonFeatureNotLicensed = () =>
  Response.json(
    {
      code: "FEATURE_NOT_LICENSED",
      msg: `未授權功能：${VISITOR_FEATURE_KEY}`,
      data: null,
    },
    { status: 403 },
  );

/** 未授權回 Response；已授權回 null */
export const requireVisitorLicense = async (): Promise<Response | null> => {
  if (await isVisitorLicensed()) return null;
  return jsonFeatureNotLicensed();
};
