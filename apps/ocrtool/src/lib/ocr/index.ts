import type { EngineId, OcrResult, RecognizeOptions } from "./types";
import { photoReads } from "./languages";
import { recognizeDocument } from "./document";
import { recognizePhoto } from "./photo";

/**
 * The one entry point the OCR tools use. Decodes the input, keeps huge images within memory and
 * hands the picture to an engine:
 *   document  Tesseract (./document.ts), every language in ./languages.ts
 *   photo     PaddleOCR (./photo.ts), only for the languages it supports
 * Both modules are light: each engine loads its library, wasm and models on its first call.
 */

export type { EngineId, OcrResult, RecognizeOptions } from "./types";
export { LANGUAGES, getLanguage, photoReads, PHOTO_READY } from "./languages";
export { cachedLangs, missingLangs, resetDocumentEngine } from "./document";

/** Longest side read; bigger pictures are scaled down first (text stays far above OCR size) */
const MAX_SIDE = 5000;
/** …and at most this many pixels (a very long screenshot is tall but narrow) */
const MAX_PIXELS = 24_000_000;

export type OcrInput = Blob | ImageBitmap | HTMLCanvasElement;

/** Decode to a bitmap, upright (EXIF orientation applied), within MAX_SIDE / MAX_PIXELS */
export async function toBitmap(input: OcrInput): Promise<ImageBitmap> {
  let bmp: ImageBitmap;
  if (input instanceof ImageBitmap) bmp = input;
  else if (input instanceof Blob)
    bmp = await createImageBitmap(input, { imageOrientation: "from-image" });
  else bmp = await createImageBitmap(input);
  const { width: w, height: h } = bmp;
  const k = Math.min(
    1,
    MAX_SIDE / Math.max(w, h),
    Math.sqrt(MAX_PIXELS / (w * h)),
  );
  if (k >= 1) return bmp;
  const out = await createImageBitmap(bmp, {
    resizeWidth: Math.max(1, Math.round(w * k)),
    resizeHeight: Math.max(1, Math.round(h * k)),
    resizeQuality: "high",
  });
  if (bmp !== input) bmp.close();
  return out;
}

/**
 * The engine `recognize()` will really use: photo only when it reads every chosen language,
 * otherwise document.
 */
export function effectiveEngine(
  engine: EngineId,
  langs: readonly string[],
): EngineId {
  return engine === "photo" && photoReads(langs) ? "photo" : "document";
}

/**
 * Read the text in an image. Boxes in the result are in the space of the picture that was read
 * (`width` × `height`), which is the input's size unless it was over MAX_SIDE / MAX_PIXELS.
 * Rejects with an AbortError when `opts.signal` aborts.
 */
export async function recognize(
  input: OcrInput,
  opts: RecognizeOptions,
): Promise<OcrResult> {
  const bmp = await toBitmap(input);
  try {
    if (effectiveEngine(opts.engine, opts.langs) === "photo")
      return await recognizePhoto(bmp, opts);
    return await recognizeDocument(bmp, opts);
  } finally {
    if (bmp !== input) bmp.close();
  }
}

/* ---------- Choosing an engine ---------- */

/** Does a JPEG carry camera EXIF (Make or Model)? Cameras and phones write it; editors and screenshots don't. */
async function cameraExif(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 128 * 1024).arrayBuffer());
  if (head[0] !== 0xff || head[1] !== 0xd8) return false;
  let i = 2;
  while (i + 4 < head.length && head[i] === 0xff) {
    const marker = head[i + 1]!;
    const len = (head[i + 2]! << 8) | head[i + 3]!;
    if (marker === 0xe1) {
      const s = new TextDecoder("latin1").decode(
        head.subarray(i + 4, i + 2 + len),
      );
      if (!s.startsWith("Exif")) return false;
      // Tags 0x010F (Make) / 0x0110 (Model) in either byte order
      const t = head.subarray(i + 10, i + 2 + len);
      for (let j = 0; j + 1 < t.length; j++) {
        const a = t[j]!;
        const b = t[j + 1]!;
        if (
          (a === 0x01 && (b === 0x0f || b === 0x10)) ||
          ((a === 0x0f || a === 0x10) && b === 0x01)
        )
          return true;
      }
      return false;
    }
    if (marker === 0xda) break;
    i += 2 + len;
  }
  return false;
}

/**
 * Look at the colours: scans and plain documents are mostly paper plus dark ink with almost no
 * colour; screenshots of apps and photos have coloured areas, dark backgrounds or gradients.
 */
function looksLikeDocument(bmp: ImageBitmap): boolean {
  const k = Math.min(1, 256 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const c = new OffscreenCanvas(w, h);
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.fillStyle = "#fff";
  x.fillRect(0, 0, w, h);
  x.drawImage(bmp, 0, 0, w, h);
  const px = x.getImageData(0, 0, w, h).data;
  let paper = 0;
  let ink = 0;
  let colour = 0;
  const n = w * h;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]!;
    const g = px[i + 1]!;
    const b = px[i + 2]!;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (sat > 0.25 && max > 60) colour++;
    else if (lum > 185) paper++;
    else if (lum < 110) ink++;
  }
  return paper / n > 0.6 && (paper + ink) / n > 0.85 && colour / n < 0.03;
}

/**
 * Pick an engine for a file: PDFs and scan-like pictures (paper and ink) → document; camera photos
 * (JPEG with camera EXIF) and colourful screenshots → photo. Only a suggestion: recognize() still
 * falls back to document when the photo engine doesn't read the chosen language.
 */
export async function chooseEngine(
  input: Blob | ImageBitmap,
): Promise<EngineId> {
  if (input instanceof Blob) {
    if (input.type === "application/pdf") return "document";
    if (
      /jpe?g/.test(input.type) &&
      (await cameraExif(input).catch(() => false))
    )
      return "photo";
    let bmp: ImageBitmap | null = null;
    try {
      bmp = await createImageBitmap(input, { imageOrientation: "from-image" });
      return looksLikeDocument(bmp) ? "document" : "photo";
    } catch {
      return "document";
    } finally {
      bmp?.close();
    }
  }
  return looksLikeDocument(input) ? "document" : "photo";
}
