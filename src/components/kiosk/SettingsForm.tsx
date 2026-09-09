"use client";

import { useRef, useState } from "react";
import {
  applyThemeClass,
  writeThemeCookie,
  type KioskTheme,
} from "@/lib/kiosk/theme";

export type KioskSettingsView = {
  marquee: string;
  resolvedMarquee: string;
  showAppoint: boolean;
  theme: KioskTheme;
  hasCustomLogo: boolean;
  logoUrl: string;
};

type SettingsFormProps = {
  initial?: KioskSettingsView | null;
  onSaved?: (settings: KioskSettingsView) => void;
};

export const SettingsForm = ({ initial, onSaved }: SettingsFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [marquee, setMarquee] = useState(initial?.marquee ?? "");
  const [showAppoint, setShowAppoint] = useState(initial?.showAppoint ?? true);
  const [theme, setTheme] = useState<KioskTheme>(
    initial?.theme === "dark" ? "dark" : "light",
  );
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? "/yenshow-logo.svg");
  const [hasCustomLogo, setHasCustomLogo] = useState(
    initial?.hasCustomLogo ?? false,
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [error, setError] = useState("");
  const [savedHint, setSavedHint] = useState("");

  const applyLogoView = (data: KioskSettingsView) => {
    setLogoUrl(data.logoUrl);
    setHasCustomLogo(data.hasCustomLogo);
    onSaved?.(data);
  };

  const postLogo = async (form: FormData, failMsg: string) => {
    setUploading(true);
    setError("");
    setSavedHint("");
    try {
      const res = await fetch("/api/kiosk/settings/logo", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as {
        msg?: string;
        data?: KioskSettingsView;
      };
      if (!res.ok || !json.data) {
        setError(json.msg || failMsg);
        return;
      }
      applyLogoView(json.data);
      setSavedHint("Logo 已更新");
    } catch {
      setError(failMsg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleThemeChange = (next: KioskTheme) => {
    setTheme(next);
    applyThemeClass(next);
    writeThemeCookie(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSavedHint("");
    setResetConfirm(false);
    try {
      const res = await fetch("/api/kiosk/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marquee, showAppoint, theme }),
      });
      const json = (await res.json()) as {
        msg?: string;
        data?: KioskSettingsView;
      };
      if (!res.ok || !json.data) {
        setError(json.msg || "儲存失敗");
        return;
      }
      applyThemeClass(json.data.theme);
      writeThemeCookie(json.data.theme);
      onSaved?.(json.data);
      setSavedHint("設定已儲存");
    } catch {
      setError("儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleResetStats = async () => {
    setResetting(true);
    setError("");
    setSavedHint("");
    try {
      const res = await fetch("/api/kiosk/records/reset", { method: "POST" });
      const json = (await res.json()) as {
        msg?: string;
        data?: { message?: string };
      };
      if (!res.ok) {
        setError(json.msg || "重置失敗");
        return;
      }
      setResetConfirm(false);
      setSavedHint(json.data?.message || "已重置訪客統計");
    } catch {
      setError("重置失敗");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <label className="block">
        <span className="mb-2 block text-base font-medium text-slate-700">
          跑馬燈文字
        </span>
        <textarea
          className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          value={marquee}
          onChange={(e) => setMarquee(e.target.value)}
          maxLength={500}
          placeholder="留空則使用環境變數或預設文案"
          aria-label="跑馬燈文字"
        />
      </label>

      <div>
        <span className="mb-2 block text-base font-medium text-slate-700">
          顯示模式
        </span>
        <div
          className="grid grid-cols-2 gap-3"
          role="radiogroup"
          aria-label="明亮或黑暗模式"
        >
          {(
            [
              { value: "light" as const, label: "明亮模式" },
              { value: "dark" as const, label: "黑暗模式" },
            ] as const
          ).map((opt) => {
            const selected = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`min-h-14 rounded-xl border px-4 text-lg font-semibold active:scale-[0.98] ${
                  selected
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-800"
                }`}
                onClick={() => handleThemeChange(opt.value)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-base font-medium text-slate-700">
          公司 Logo
        </span>
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {/* 動態自訂 Logo URL，不適合 next/image 靜態優化 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="公司 Logo 預覽"
            className="h-16 w-auto max-w-55 object-contain"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-12 rounded-xl bg-slate-800 px-4 text-base font-semibold text-white active:bg-slate-700 disabled:opacity-50"
              aria-label="選擇 Logo 檔案"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "處理中…" : "選擇檔案"}
            </button>
            {hasCustomLogo ? (
              <button
                type="button"
                className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-50"
                aria-label="恢復預設 Logo"
                disabled={uploading}
                onClick={() => {
                  const form = new FormData();
                  form.append("reset", "1");
                  void postLogo(form, "恢復預設 Logo 失敗");
                }}
              >
                恢復預設
              </button>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp,.png,.jpg,.jpeg,.svg,.webp"
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const form = new FormData();
              form.append("file", file);
              void postLogo(form, "上傳 Logo 失敗");
            }}
          />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          支援 PNG／JPG／SVG／WebP，上限 2MB
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={showAppoint}
        aria-label="顯示訪客預約入口"
        className={`flex min-h-16 w-full items-center justify-between rounded-xl border px-4 text-left text-lg font-medium active:scale-[0.99] ${
          showAppoint
            ? "border-blue-600 bg-blue-50 text-blue-900"
            : "border-slate-300 bg-white text-slate-800"
        }`}
        onClick={() => setShowAppoint((prev) => !prev)}
      >
        <span>顯示訪客預約入口</span>
        <span
          className={`relative h-8 w-14 rounded-full transition-colors ${
            showAppoint ? "bg-blue-600" : "bg-slate-300"
          }`}
          aria-hidden
        >
          <span
            className={`absolute top-1 size-6 rounded-full bg-white shadow transition-transform ${
              showAppoint ? "left-7" : "left-1"
            }`}
          />
        </span>
      </button>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="text-lg font-semibold text-amber-950">重置訪客統計</h3>
        <p className="mt-2 text-base text-amber-900">
          清除所有離場累計，並取消本機臨時外出標記；保留在場訪客完整資料。不影響 YSCP 在廠狀態。
        </p>
        {resetConfirm ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-12 rounded-xl bg-red-600 px-4 text-base font-semibold text-white active:bg-red-700 disabled:opacity-50"
              aria-label="確認重置訪客統計"
              disabled={resetting}
              onClick={() => void handleResetStats()}
            >
              {resetting ? "重置中…" : "確認重置"}
            </button>
            <button
              type="button"
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-50"
              aria-label="取消重置"
              disabled={resetting}
              onClick={() => setResetConfirm(false)}
            >
              取消
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="mt-4 min-h-12 rounded-xl border border-amber-400 bg-white px-4 text-base font-semibold text-amber-900 active:bg-amber-100 disabled:opacity-50"
            aria-label="重置訪客統計"
            disabled={resetting || uploading || saving}
            onClick={() => {
              setError("");
              setSavedHint("");
              setResetConfirm(true);
            }}
          >
            重置統計與紀錄
          </button>
        )}
      </div>

      {error ? (
        <p className="text-lg text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {savedHint ? (
        <p className="text-lg text-emerald-700" role="status">
          {savedHint}
        </p>
      ) : null}

      <button
        type="button"
        className={`min-h-14 w-full rounded-xl text-xl font-semibold text-white ${
          saving
            ? "cursor-not-allowed bg-slate-300"
            : "bg-blue-600 active:bg-blue-700"
        }`}
        aria-label="儲存設定"
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving ? "儲存中…" : "儲存設定"}
      </button>
    </div>
  );
};
