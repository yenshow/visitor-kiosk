const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;

export type NoticeVideoSource =
  | { kind: "file"; src: string }
  | { kind: "youtube"; embedSrc: string };

const extractYoutubeId = (raw: string): string | null => {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname.startsWith("/embed/")) {
        return url.pathname.split("/")[2] || null;
      }
      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/")[2] || null;
      }
      return url.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
};

/**
 * 解析訪客須知影片來源。
 * 支援：YouTube 網址、直接影片網址／檔案、資料夾路徑（自動補 notice.mp4）。
 */
export const resolveNoticeVideoSource = (
  raw?: string | null,
): NoticeVideoSource => {
  const value = String(raw ?? "").trim();
  if (!value) return { kind: "file", src: "/notice.mp4" };

  const youtubeId = extractYoutubeId(value);
  if (youtubeId) {
    return {
      kind: "youtube",
      embedSrc: `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1`,
    };
  }

  const withoutTrailingSlash = value.replace(/\/+$/, "");
  const isHttp = /^https?:\/\//i.test(value);
  const looksLikeFolder =
    value.endsWith("/") ||
    value.endsWith("\\") ||
    (!VIDEO_EXT.test(withoutTrailingSlash) &&
      !withoutTrailingSlash.includes("?"));

  if (looksLikeFolder) {
    const base = withoutTrailingSlash.replace(/\\/g, "/");
    if (isHttp) return { kind: "file", src: `${base}/notice.mp4` };
    const normalized = base.startsWith("/") ? base : `/${base}`;
    return { kind: "file", src: `${normalized}/notice.mp4` };
  }

  if (isHttp) return { kind: "file", src: value };

  const asPath = value.replace(/\\/g, "/");
  return {
    kind: "file",
    src: asPath.startsWith("/") ? asPath : `/${asPath}`,
  };
};
