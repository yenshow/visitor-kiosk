export type KioskTheme = "light" | "dark";

export const THEME_COOKIE = "theme";
export const DEFAULT_THEME: KioskTheme = "light";

export const normalizeTheme = (value: unknown): KioskTheme =>
  value === "dark" ? "dark" : "light";

export const applyThemeClass = (theme: KioskTheme) => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
};

/** 寫入 cookie 供 theme-init.js 防閃爍（一年） */
export const writeThemeCookie = (theme: KioskTheme) => {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(theme)}; path=/; max-age=${maxAge}; SameSite=Lax`;
};

export const readThemeCookie = (): KioskTheme | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)theme=([^;]*)/);
  if (!match) return null;
  return normalizeTheme(decodeURIComponent(match[1] ?? ""));
};

export const themeCookieHeader = (theme: KioskTheme): string => {
  const maxAge = 60 * 60 * 24 * 365;
  return `${THEME_COOKIE}=${encodeURIComponent(theme)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
};
