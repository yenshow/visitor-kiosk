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

const visibleNamePart = (value?: string): string => {
  const text = String(value ?? "").trim();
  return text === HCP_EMPTY_NAME ? "" : text;
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
