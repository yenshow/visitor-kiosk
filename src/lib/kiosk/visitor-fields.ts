export const displayVisitorName = (
  familyName?: string,
  givenName?: string,
  visitorName?: string,
): string => {
  const family = String(familyName ?? "").trim();
  const given = String(givenName ?? "").trim();
  if (family || given) return `${family}${given}`;
  return String(visitorName ?? "").trim() || "—";
};

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
