/** 僅保留數字，不做國碼轉換（如 0958255908） */
export const normalizePhoneDigits = (value: string): string =>
  String(value ?? "").replace(/\D/g, "");

export const looksLikePhone = (value: string): boolean => {
  const digits = normalizePhoneDigits(value);
  return digits.length >= 8 && digits.length <= 15;
};
