import {
  parseTagsFromPromptSuffix,
  type MediaItem,
} from "@/lib/mirageMedia";
import { getVideoThumbnailUrl } from "@/lib/videoThumb";
import type { VideoRow } from "@/types/database";

function parseDbTags(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function tagsFromVideoRow(row: VideoRow): string[] {
  const anyRow = row as unknown as Record<string, unknown>;
  const fromJson = parseDbTags(anyRow.tags);
  if (fromJson.length) return fromJson;
  const fromPrompt = parseTagsFromPromptSuffix(row.prompt);
  if (fromPrompt.length) return fromPrompt;
  return ["outros"];
}

export function videoRowToMediaItem(
  row: VideoRow,
  index = 0,
): MediaItem | null {
  const anyRow = row as unknown as Record<string, unknown>;

  const idRaw = anyRow.id;
  const id = typeof idRaw === "string" ? idRaw : String(idRaw ?? "");

  const titleRaw =
    anyRow.title ??
    anyRow.displayTitle ??
    anyRow.display_title;
  const title = titleRaw == null ? "" : String(titleRaw).trim();

  const urlRaw =
    anyRow.video_url ??
    anyRow.absoluteVideoUrl ??
    anyRow.absolute_video_url ??
    anyRow.videoUrl ??
    anyRow.videoURL;
  const videoUrl =
    urlRaw == null
      ? null
      : (() => {
          const s = String(urlRaw).trim();
          return s === "" ? null : s;
        })();

  if (!videoUrl) return null;

  return {
    type: "video",
    src: id || String(index),
    base: "supabase:",
    folderTag: null,
    index,
    id: id || undefined,
    displayTitle: title || null,
    absoluteVideoUrl: videoUrl,
    absolutePosterUrl: getVideoThumbnailUrl(row),
    dbTags: tagsFromVideoRow(row),
  };
}
