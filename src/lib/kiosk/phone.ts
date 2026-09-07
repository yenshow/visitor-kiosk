/** 僅保留數字，台灣手機可含國碼 886 */
export const normalizePhoneDigits = (value: string): string => {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("886") && digits.length >= 11) {
    digits = `0${digits.slice(3)}`;
  }
  return digits;
};

export const looksLikePhone = (value: string): boolean => {
  const digits = normalizePhoneDigits(value);
  return digits.length >= 8 && digits.length <= 15;
};
