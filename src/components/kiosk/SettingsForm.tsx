"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { DirectoryDialog } from "@/components/kiosk/DirectoryDialog";
import { RecordsDialog } from "@/components/kiosk/RecordsDialog";
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
  noticeVideoUrl: string;
  resolvedNoticeVideoUrl: string;
  hasCustomLogo: boolean;
  logoUrl: string;
  publicBookingEnabled?: boolean;
  /** 僅管理員 GET／PUT 回傳 */
  approverEmails?: string[];
};

type SettingsFormProps = {
  initial?: KioskSettingsView | null;
  onSaved?: (settings: KioskSettingsView) => void;
};

const RESET_DESC =
  "今日與本期離場統計將歸零，後續離場重新計數。在場、外出狀態和歷史紀錄會保留。";

const LABEL = "text-base font-medium text-slate-700";
const FIELD =
  "w-full rounded-xl border border-slate-300 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";
const BTN =
  "min-h-12 cursor-pointer rounded-xl px-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const BTN_DARK = `${BTN} bg-slate-800 text-white active:bg-slate-700`;
const BTN_OUTLINE = `${BTN} border border-slate-300 bg-white text-slate-700 active:bg-slate-100`;
const BTN_WARN = `${BTN} border border-amber-400 bg-white text-amber-900 active:bg-amber-100`;
const BTN_DANGER = `${BTN} bg-red-600 text-white active:bg-red-700`;
const HINT = "text-sm font-normal text-slate-500";
const LABEL_ROW = "mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5";

const Icon = ({
  children,
  className = "size-6",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const SettingsForm = ({ initial, onSaved }: SettingsFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resetTitleId = useId();
  const [marquee, setMarquee] = useState(initial?.marquee ?? "");
  const [noticeVideoUrl, setNoticeVideoUrl] = useState(
    initial?.noticeVideoUrl ?? "",
  );
  const [showAppoint, setShowAppoint] = useState(initial?.showAppoint ?? true);
  const [publicBookingEnabled, setPublicBookingEnabled] = useState(
    initial?.publicBookingEnabled ?? true,
  );
  const [approverEmailsText, setApproverEmailsText] = useState(
    (initial?.approverEmails ?? []).join("\n"),
  );
  const [theme, setTheme] = useState<KioskTheme>(
    initial?.theme === "dark" ? "dark" : "light",
  );
  const [logoUrl, setLogoUrl] = useState(
    initial?.logoUrl ?? "/yenshow-logo.svg",
  );
  const [hasCustomLogo, setHasCustomLogo] = useState(
    initial?.hasCustomLogo ?? false,
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [error, setError] = useState("");
  const [savedHint, setSavedHint] = useState("");

  useEffect(() => {
    if (!resetConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !resetting) setResetConfirm(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetConfirm, resetting]);

  const clearStatus = () => {
    setError("");
    setSavedHint("");
  };

  const applyLogoView = (data: KioskSettingsView) => {
    setLogoUrl(data.logoUrl);
    setHasCustomLogo(data.hasCustomLogo);
    onSaved?.(data);
  };

  const postLogo = async (form: FormData, failMsg: string) => {
    setUploading(true);
    clearStatus();
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
    clearStatus();
    setResetConfirm(false);
    try {
      const res = await fetch("/api/kiosk/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marquee,
          noticeVideoUrl,
          showAppoint,
          publicBookingEnabled,
          theme,
          approverEmails: approverEmailsText,
        }),
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
      if (Array.isArray(json.data.approverEmails)) {
        setApproverEmailsText(json.data.approverEmails.join("\n"));
      }
      if (typeof json.data.publicBookingEnabled === "boolean") {
        setPublicBookingEnabled(json.data.publicBookingEnabled);
      }
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
    clearStatus();
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

  const handleCloseResetConfirm = () => {
    if (resetting) return;
    setResetConfirm(false);
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <div className={LABEL_ROW}>
          <span className={LABEL}>公司 Logo</span>
          <span className={HINT}>支援 PNG／JPG／SVG／WebP，上限 2MB</span>
        </div>
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
              className={BTN_DARK}
              aria-label="選擇 Logo 檔案"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "處理中…" : "選擇檔案"}
            </button>
            {hasCustomLogo ? (
              <button
                type="button"
                className={BTN_OUTLINE}
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
      </div>

      <label className="block">
        <span className={`mb-2 block ${LABEL}`}>跑馬燈文字</span>
        <textarea
          className={`${FIELD} min-h-28 px-4 py-3 text-lg`}
          value={marquee}
          onChange={(e) => setMarquee(e.target.value)}
          maxLength={500}
          placeholder="留空則使用預設文案"
          aria-label="跑馬燈文字"
        />
      </label>

      <label className="block">
        <span className={LABEL_ROW}>
          <span className={LABEL}>訪客須知影片</span>
          <span className={HINT}>
            支援 YouTube、直接影片網址，或本機路徑（如 /notice.mp4）
          </span>
        </span>
        <input
          type="url"
          className={`${FIELD} min-h-12 px-4 py-3 text-lg`}
          value={noticeVideoUrl}
          onChange={(e) => setNoticeVideoUrl(e.target.value)}
          maxLength={1000}
          placeholder="留空＝/notice.mp4；可填 YouTube 或影片網址"
          aria-label="訪客須知影片網址"
        />
      </label>

      <div>
        <span className={`mb-2 block ${LABEL}`}>顯示模式</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            role="switch"
            aria-checked={showAppoint}
            aria-label="現場訪客預約功能"
            className={`flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 text-left text-base font-semibold active:scale-[0.99] ${
              showAppoint
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : "border-slate-300 bg-white text-slate-800"
            }`}
            onClick={() => setShowAppoint((prev) => !prev)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <Icon className="size-7 shrink-0">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </Icon>
              <span className="leading-snug">現場預約</span>
            </span>
            <span
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
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

          <button
            type="button"
            role="switch"
            aria-checked={publicBookingEnabled}
            aria-label="外部線上預約功能"
            className={`flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 text-left text-base font-semibold active:scale-[0.99] ${
              publicBookingEnabled
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : "border-slate-300 bg-white text-slate-800"
            }`}
            onClick={() => setPublicBookingEnabled((prev) => !prev)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <Icon className="size-7 shrink-0">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </Icon>
              <span className="leading-snug">外部預約</span>
            </span>
            <span
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                publicBookingEnabled ? "bg-blue-600" : "bg-slate-300"
              }`}
              aria-hidden
            >
              <span
                className={`absolute top-1 size-6 rounded-full bg-white shadow transition-transform ${
                  publicBookingEnabled ? "left-7" : "left-1"
                }`}
              />
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={theme === "dark"}
            aria-label="黑暗模式"
            className={`flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 text-left text-base font-semibold active:scale-[0.99] ${
              theme === "dark"
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : "border-slate-300 bg-white text-slate-800"
            }`}
            onClick={() =>
              handleThemeChange(theme === "dark" ? "light" : "dark")
            }
          >
            <span className="flex min-w-0 items-center gap-3">
              <Icon className="size-7 shrink-0">
                <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
              </Icon>
              <span className="leading-snug">黑暗模式</span>
            </span>
            <span
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                theme === "dark" ? "bg-blue-600" : "bg-slate-300"
              }`}
              aria-hidden
            >
              <span
                className={`absolute top-1 size-6 rounded-full bg-white shadow transition-transform ${
                  theme === "dark" ? "left-7" : "left-1"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <label className="block">
        <span className={LABEL_ROW}>
          <span className={LABEL}>預約通知信箱</span>
          <span className={HINT}>固定內部信箱；換行或逗號分隔，上限 20</span>
        </span>
        <textarea
          className={`${FIELD} min-h-24 px-4 py-3 text-lg`}
          value={approverEmailsText}
          onChange={(e) => setApproverEmailsText(e.target.value)}
          placeholder={"reception@example.com"}
          aria-label="預約通知信箱"
        />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          className={`${BTN_DARK} w-full px-2 sm:px-4`}
          aria-label="開啟部門與被訪人"
          aria-haspopup="dialog"
          onClick={() => {
            clearStatus();
            setDirectoryOpen(true);
          }}
        >
          部門與被訪人
        </button>
        <button
          type="button"
          className={`${BTN_DARK} w-full px-2 sm:px-4`}
          aria-label="開啟訪客紀錄"
          aria-haspopup="dialog"
          onClick={() => {
            clearStatus();
            setRecordsOpen(true);
          }}
        >
          訪客紀錄
        </button>
        <button
          type="button"
          className={`${BTN_WARN} w-full px-2 sm:px-4`}
          aria-label="重置訪客統計"
          aria-haspopup="dialog"
          disabled={resetting || uploading || saving}
          onClick={() => {
            clearStatus();
            setResetConfirm(true);
          }}
        >
          重置統計
        </button>
      </div>

      <DirectoryDialog
        open={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
      />

      <RecordsDialog open={recordsOpen} onClose={() => setRecordsOpen(false)} />

      {resetConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={handleCloseResetConfirm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={resetTitleId}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={resetTitleId} className="text-xl font-bold text-slate-900">
              確認重置訪客統計？
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-700">
              {RESET_DESC}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className={`${BTN_OUTLINE} flex-1`}
                aria-label="取消重置"
                disabled={resetting}
                onClick={handleCloseResetConfirm}
              >
                取消
              </button>
              <button
                type="button"
                className={`${BTN_DANGER} flex-1`}
                aria-label="確認重置訪客統計"
                disabled={resetting}
                onClick={() => void handleResetStats()}
              >
                {resetting ? "重置中…" : "確認重置"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
            : "cursor-pointer bg-blue-600 active:bg-blue-700"
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
