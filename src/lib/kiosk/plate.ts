/** 車牌正規化：去空白、轉大寫 */
export const normalizePlateNo = (value: string | null | undefined): string =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
