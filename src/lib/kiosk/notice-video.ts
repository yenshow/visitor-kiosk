const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
]);

export type NoticeVideoSource =
  | { kind: "file"; src: string }
  | { kind: "youtube"; embedSrc: string };

const parseStartSeconds = (raw: string): number | undefined => {
  try {
    const url = new URL(raw);
    const t = url.searchParams.get("t") ?? url.searchParams.get("start");
    if (!t) return undefined;
    if (/^\d+$/.test(t)) return Number(t);
    const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(t);
    if (!match?.[0]) return undefined;
    const total =
      Number(match[1] ?? 0) * 3600 +
      Number(match[2] ?? 0) * 60 +
      Number(match[3] ?? 0);
    return total > 0 ? total : undefined;
  } catch {
    return undefined;
  }
};

const extractYoutubeId = (raw: string): string | null => {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    if (!YOUTUBE_HOSTS.has(host)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (
      parts[0] === "embed" ||
      parts[0] === "shorts" ||
      parts[0] === "live" ||
      parts[0] === "v"
    ) {
      return parts[1] || null;
    }
    return url.searchParams.get("v");
  } catch {
    return null;
  }
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
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
    });
    const start = parseStartSeconds(value);
    if (start != null) params.set("start", String(start));
    return {
      kind: "youtube",
      embedSrc: `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`,
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
