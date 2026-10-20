export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

/** What every downloaded file carries at the end of its name, before the extension */
export const KMRA_TAG = "kmra";
/** A trailing tag, and the older "(kmra.dev)" form, on names that came from kmra.dev */
const OLD_TAG = /(?:\s*\(kmra\.dev\)|-kmra)\s*$/i;

/**
 * A file name with the kmra tag before the extension: "photo-compress.png" →
 * "photo-compress-kmra.png". No spaces or brackets, so the name works in upload forms, code and
 * terminals. Names that have the tag already stay as they are.
 */
export function tagged(filename: string): string {
  const m = /^(.+?)(\.[A-Za-z0-9]{1,5})?$/.exec(filename);
  const stem = (m?.[1] ?? filename).trim() || "file";
  if (OLD_TAG.test(stem)) return filename;
  return `${stem}-${KMRA_TAG}${m?.[2] ?? ""}`;
}

/**
 * "photo.jpg" + "compress" → "photo-compress": the user's file name, then the tool. A file that
 * already came from kmra.dev loses its old tag, so a second tool reads "photo-compress-resize".
 */
export function toolName(fileName: string, tool: string): string {
  const stem = fileName.replace(/\.[^.]+$/, "").replace(OLD_TAG, "") || "file";
  return tool ? `${stem}-${tool}` : stem;
}

/** Save a file; every download is named with the kmra tag */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = tagged(filename);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "photo.png" + "webp" -> "photo.webp" */
export function replaceExtension(filename: string, ext: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return `${base}.${ext}`;
}

/** Image files, including HEIC/HEIF which browsers often report with no MIME type. */
export function isImageFile(f: File): boolean {
  return f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name);
}

/** File picker filter for images, with HEIC listed explicitly for Windows. */
export const IMAGE_ACCEPT = "image/*,.heic,.heif";
