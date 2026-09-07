/** HCP registerment／appointment 不接受空的 visitorGivenName，無名時用此佔位 */
export const HCP_EMPTY_GIVEN = "-";

/**
 * Kiosk 單欄「姓名」→ HCP 姓／名。
 * 整段寫入姓；名固定佔位（OpenAPI 不接受空名）。
 */
export const mapVisitorName = (
  fullName: string,
): { visitorFamilyName: string; visitorGivenName: string } => {
  const name = fullName.trim();
  return {
    visitorFamilyName: name,
    visitorGivenName: HCP_EMPTY_GIVEN,
  };
};

/**
 * 報到送出前正規化：
 * HCP 畫面只填姓時，API 可能把值放在 given、family 為空。
 */
export const normalizeRegisterNames = (info: {
  visitorFamilyName?: string;
  visitorGivenName?: string;
  visitorName?: string;
}): { visitorFamilyName: string; visitorGivenName: string } => {
  const family = String(info.visitorFamilyName ?? "").trim();
  const rawGiven = String(info.visitorGivenName ?? "").trim();
  const given = rawGiven === HCP_EMPTY_GIVEN ? "" : rawGiven;
  const full = String(info.visitorName ?? "").trim();

  const visitorFamilyName = family || given || full;
  if (!visitorFamilyName) {
    throw new Error("訪客姓名資料不完整，請洽接待人員");
  }

  return {
    visitorFamilyName,
    visitorGivenName: family && given ? given : HCP_EMPTY_GIVEN,
  };
};

export const displayVisitorName = (
  familyName?: string,
  givenName?: string,
  visitorName?: string,
): string => {
  const family = String(familyName ?? "").trim();
  const given = String(givenName ?? "").trim();
  const givenShow = given === HCP_EMPTY_GIVEN ? "" : given;
  const full = String(visitorName ?? "").trim();
  if (family || givenShow) return `${family}${givenShow}`;
  return full.split(HCP_EMPTY_GIVEN).join("").trim() || "—";
};

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
