"use client";

import { useEffect } from "react";
import {
  applyThemeClass,
  normalizeTheme,
  writeThemeCookie,
  type KioskTheme,
} from "@/lib/kiosk/theme";

type ThemeSyncProps = {
  theme?: KioskTheme | null;
};

/** 依本機設定同步 html.dark 與 cookie（與 ba theme-init 對齊） */
export const ThemeSync = ({ theme }: ThemeSyncProps) => {
  useEffect(() => {
    if (!theme) return;
    const next = normalizeTheme(theme);
    applyThemeClass(next);
    writeThemeCookie(next);
  }, [theme]);

  return null;
};
