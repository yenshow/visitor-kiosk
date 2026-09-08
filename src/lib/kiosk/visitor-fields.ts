/** YSCP OpenAPI 不接受空的姓或名；Kiosk／Web 二選一時寫入用此佔位 */
export const HCP_EMPTY_NAME = "-";

export const toHcpVisitorNames = (info: {
  visitorFamilyName?: string;
  visitorGivenName?: string;
}): { visitorFamilyName: string; visitorGivenName: string } => {
  const family = String(info.visitorFamilyName ?? "").trim();
  const given = String(info.visitorGivenName ?? "").trim();
  return {
    visitorFamilyName: family || HCP_EMPTY_NAME,
    visitorGivenName: given || HCP_EMPTY_NAME,
  };
};

/** 隱藏 HCP 姓名佔位「-」（含組字後的 "test02 -"、"-蘇"） */
const visibleNamePart = (value?: string): string => {
  let text = String(value ?? "").trim();
  if (!text || text === HCP_EMPTY_NAME) return "";

  // 前綴佔位（例如 "-蘇"）
  if (text.startsWith(HCP_EMPTY_NAME)) {
    text = text.slice(HCP_EMPTY_NAME.length).trim();
  }
  if (!text || text === HCP_EMPTY_NAME) return "";

  // 空白分隔的佔位 token（例如 "test02 -"、"- 蘇"）
  text = text
    .split(/\s+/)
    .filter((part) => part !== HCP_EMPTY_NAME)
    .join(" ")
    .trim();

  return !text || text === HCP_EMPTY_NAME ? "" : text;
};

export const displayVisitorName = (
  familyName?: string,
  givenName?: string,
  visitorName?: string,
): string => {
  const family = visibleNamePart(familyName);
  const given = visibleNamePart(givenName);
  if (family || given) return `${family}${given}`;
  return visibleNamePart(visitorName) || "—";
};

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
