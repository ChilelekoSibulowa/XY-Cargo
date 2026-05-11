export const mergeCmsContent = <T,>(base: T, override: unknown): T => {
  if (override === undefined || override === null) {
    return base;
  }

  if (base === undefined || base === null) {
    return override as T;
  }

  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }

  if (
    typeof base === "object" &&
    typeof override === "object" &&
    !Array.isArray(override)
  ) {
    const result: Record<string, unknown> = {
      ...(base as Record<string, unknown>),
    };

    Object.keys(override).forEach((key) => {
      result[key] = mergeCmsContent(
        (base as Record<string, unknown>)[key],
        (override as Record<string, unknown>)[key]
      );
    });

    return result as T;
  }

  return override as T;
};

export const getYouTubeVideoId = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      if (url.searchParams.get("v")) {
        return url.searchParams.get("v");
      }

      const segments = url.pathname.split("/").filter(Boolean);
      if (segments[0] === "embed" || segments[0] === "shorts") {
        return segments[1] ?? null;
      }
    }
  } catch {
    const matched = value.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
    );
    return matched?.[1] ?? null;
  }

  return null;
};

export const getYouTubeEmbedUrl = (value: string) => {
  const videoId = getYouTubeVideoId(value);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
};

export const formatCmsDate = (value: string) => {
  if (!value.trim()) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};
