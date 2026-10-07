export type ImageFormat = "image/jpeg" | "image/png" | "image/webp";

export const FORMAT_EXT: Record<ImageFormat, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Decode a file into an ImageBitmap (respects EXIF orientation). */
export function decodeImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

export interface EncodeOptions {
  width: number;
  height: number;
  type: ImageFormat;
  /** 0–1, ignored for PNG */
  quality?: number;
}

/** Draw a bitmap to an OffscreenCanvas at the given size and encode it. */
export async function encodeImage(
  bitmap: ImageBitmap,
  opts: EncodeOptions,
): Promise<Blob> {
  const canvas = new OffscreenCanvas(opts.width, opts.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (opts.type === "image/jpeg") {
    // JPEG has no alpha; paint white so transparent areas don't turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, opts.width, opts.height);
  }
  ctx.drawImage(bitmap, 0, 0, opts.width, opts.height);
  return canvas.convertToBlob({ type: opts.type, quality: opts.quality });
}
