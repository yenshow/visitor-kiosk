"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { resolveNoticeVideoSource } from "@/lib/kiosk/notice-video";

type VisitorNoticeDialogProps = {
  title?: string;
  confirmLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const SCROLL_BOTTOM_THRESHOLD_PX = 24;

export const VisitorNoticeDialog = ({
  title = "訪客須知",
  confirmLabel,
  loading = false,
  onCancel,
  onConfirm,
}: VisitorNoticeDialogProps) => {
  const titleId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [reachedBottom, setReachedBottom] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [videoAvailable, setVideoAvailable] = useState(true);

  const videoSource = useMemo(
    () => resolveNoticeVideoSource(process.env.NEXT_PUBLIC_NOTICE_VIDEO_URL),
    [],
  );

  const updateReachedBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining <= SCROLL_BOTTOM_THRESHOLD_PX) {
      setReachedBottom(true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/kiosk/notice");
        const json = (await res.json()) as {
          data?: { content?: string };
        };
        if (!cancelled) {
          setContent(json.data?.content ?? "請詳閱訪客須知。");
        }
      } catch {
        if (!cancelled) setContent("無法載入訪客須知，請洽現場人員。");
      } finally {
        if (!cancelled) setFetching(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fetching) return;
    // 內容載入後若無需捲動，視為已讀完
    const frame = window.requestAnimationFrame(() => {
      updateReachedBottom();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fetching, content, videoAvailable]);

  useEffect(() => {
    if (!videoAvailable || videoSource.kind !== "file") return;
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => {
      /* 觸控裝置可手動播放 */
    });
  }, [videoAvailable, videoSource]);

  const canAccept = reachedBottom && !fetching;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 id={titleId} className="text-2xl font-bold text-slate-900">
            {title}
          </h2>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4"
          onScroll={updateReachedBottom}
        >
          {videoAvailable ? (
            <div className="overflow-hidden rounded-xl bg-slate-900">
              {videoSource.kind === "youtube" ? (
                <iframe
                  className="aspect-video w-full bg-black"
                  src={videoSource.embedSrc}
                  title="訪客須知影片"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <video
                  ref={videoRef}
                  className="aspect-video w-full bg-black"
                  controls
                  playsInline
                  preload="metadata"
                  controlsList="nodownload"
                  aria-label="訪客須知影片"
                  src={videoSource.src}
                  onError={() => setVideoAvailable(false)}
                >
                  您的瀏覽器不支援影片播放。
                </video>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-800">
              須知影片無法播放。請確認{" "}
              <code className="rounded bg-amber-100 px-1">
                NEXT_PUBLIC_NOTICE_VIDEO_URL
              </code>{" "}
              （YouTube／影片網址／資料夾，例如{" "}
              <code className="rounded bg-amber-100 px-1">/videos/</code> →{" "}
              <code className="rounded bg-amber-100 px-1">
                /videos/notice.mp4
              </code>
              ）。
            </p>
          )}

          {fetching ? (
            <p className="text-lg text-slate-500">載入中…</p>
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-base leading-7 text-slate-700">
              {content}
            </pre>
          )}
        </div>

        <div className="space-y-4 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            role="checkbox"
            aria-checked={accepted}
            aria-disabled={!canAccept}
            aria-label="我已閱讀並同意訪客須知"
            disabled={!canAccept}
            className={`flex min-h-16 w-full items-center gap-4 rounded-xl border px-4 text-left text-lg font-medium ${
              !canAccept
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : accepted
                  ? "border-blue-600 bg-blue-50 text-blue-900 active:scale-[0.99]"
                  : "border-slate-300 bg-white text-slate-800 active:scale-[0.99]"
            }`}
            onClick={() => {
              if (!canAccept) return;
              setAccepted((prev) => !prev);
            }}
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-md border-2 text-base ${
                accepted
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-400 bg-white text-transparent"
              }`}
              aria-hidden
            >
              ✓
            </span>
            <span>我已閱讀並同意訪客須知</span>
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              className="min-h-16 flex-1 rounded-xl border border-slate-300 bg-white text-xl font-semibold text-slate-700 active:bg-slate-50"
              aria-label="取消"
              onClick={onCancel}
              disabled={loading}
            >
              取消
            </button>
            <button
              type="button"
              className={`min-h-16 flex-1 rounded-xl text-xl font-semibold text-white ${
                accepted && !loading
                  ? "bg-blue-600 active:bg-blue-700"
                  : "cursor-not-allowed bg-slate-300"
              }`}
              aria-label={confirmLabel}
              disabled={!accepted || loading}
              onClick={onConfirm}
            >
              {loading ? "處理中…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
