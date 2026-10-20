/**
 * Encoders for the formats browsers can't save on their own. Canvas encodes JPEG, PNG and WebP;
 * these add AVIF (jSquash's libavif build, WebAssembly, loaded only when AVIF is picked), GIF
 * (gifenc, 256 colours), BMP, TIFF and ICO (written here). All run in the image worker.
 */
import { icoFromPngs } from "./ico";

/** The largest icon an ICO holds */
export const ICO_MAX = 256;

/** An ICO from any image: fitted, centred on a transparent square of at most 256 px */
export async function ico(canvas: OffscreenCanvas): Promise<Blob> {
  const side = Math.min(ICO_MAX, Math.max(canvas.width, canvas.height));
  const k = side / Math.max(canvas.width, canvas.height);
  const w = Math.max(1, Math.round(canvas.width * k));
  const h = Math.max(1, Math.round(canvas.height * k));
  const sq = new OffscreenCanvas(side, side);
  const x = sq.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  x.drawImage(canvas, (side - w) / 2, (side - h) / 2, w, h);
  const png = await sq.convertToBlob({ type: "image/png" });
  return icoFromPngs([{ size: side, blob: png }]);
}

function pixels(canvas: OffscreenCanvas): ImageData {
  return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
}

/** 24-bit BMP, bottom-up rows padded to 4 bytes (the render flattens transparency first) */
export function bmp(canvas: OffscreenCanvas): Blob {
  const { width: w, height: h, data } = pixels(canvas);
  const row = Math.ceil((w * 3) / 4) * 4;
  const size = 54 + row * h;
  const buf = new ArrayBuffer(size);
  const v = new DataView(buf);
  const b = new Uint8Array(buf);
  b[0] = 0x42;
  b[1] = 0x4d;
  v.setUint32(2, size, true);
  v.setUint32(10, 54, true);
  v.setUint32(14, 40, true);
  v.setInt32(18, w, true);
  v.setInt32(22, h, true);
  v.setUint16(26, 1, true);
  v.setUint16(28, 24, true);
  v.setUint32(34, row * h, true);
  v.setInt32(38, 2835, true); // 72 dpi
  v.setInt32(42, 2835, true);
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4;
    const dst = 54 + y * row;
    for (let x = 0; x < w; x++) {
      const s = src + x * 4;
      const d = dst + x * 3;
      b[d] = data[s + 2]!;
      b[d + 1] = data[s + 1]!;
      b[d + 2] = data[s]!;
    }
  }
  return new Blob([buf], { type: "image/bmp" });
}

/** Baseline TIFF: uncompressed RGBA in one strip, little-endian, transparency kept */
export function tiff(canvas: OffscreenCanvas): Blob {
  const { width: w, height: h, data } = pixels(canvas);
  const pixelBytes = w * h * 4;
  const entries: [tag: number, type: number, count: number, value: number][] = [];
  // Layout: header (8) | IFD | bits-per-sample (4 shorts) | resolution (2 rationals) | pixels
  const n = 13;
  const ifd = 8;
  const extra = ifd + 2 + n * 12 + 4;
  const bpsAt = extra;
  const resAt = bpsAt + 8;
  const pixAt = resAt + 16;
  entries.push(
    [256, 4, 1, w], // ImageWidth
    [257, 4, 1, h], // ImageLength
    [258, 3, 4, bpsAt], // BitsPerSample 8,8,8,8
    [259, 3, 1, 1], // Compression: none
    [262, 3, 1, 2], // Photometric: RGB
    [273, 4, 1, pixAt], // StripOffsets
    [277, 3, 1, 4], // SamplesPerPixel
    [278, 4, 1, h], // RowsPerStrip
    [279, 4, 1, pixelBytes], // StripByteCounts
    [282, 5, 1, resAt], // XResolution
    [283, 5, 1, resAt + 8], // YResolution
    [296, 3, 1, 2], // ResolutionUnit: inch
    [338, 3, 1, 2], // ExtraSamples: unassociated alpha
  );
  const buf = new ArrayBuffer(pixAt + pixelBytes);
  const v = new DataView(buf);
  v.setUint8(0, 0x49);
  v.setUint8(1, 0x49);
  v.setUint16(2, 42, true);
  v.setUint32(4, ifd, true);
  v.setUint16(ifd, n, true);
  entries.forEach(([tag, type, count, value], i) => {
    const e = ifd + 2 + i * 12;
    v.setUint16(e, tag, true);
    v.setUint16(e + 2, type, true);
    v.setUint32(e + 4, count, true);
    if (type === 3 && count === 1) v.setUint16(e + 8, value, true);
    else v.setUint32(e + 8, value, true);
  });
  v.setUint32(ifd + 2 + n * 12, 0, true); // no next IFD
  for (let i = 0; i < 4; i++) v.setUint16(bpsAt + i * 2, 8, true);
  for (const at of [resAt, resAt + 8]) {
    v.setUint32(at, 72, true);
    v.setUint32(at + 4, 1, true);
  }
  new Uint8Array(buf, pixAt).set(data);
  return new Blob([buf], { type: "image/tiff" });
}

/** GIF: one frame, at most 256 colours; fully transparent pixels stay transparent */
export async function gif(canvas: OffscreenCanvas): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const { width: w, height: h, data } = pixels(canvas);
  const palette = quantize(data, 256, { format: "rgba4444", oneBitAlpha: true });
  const index = applyPalette(data, palette, "rgba4444");
  const transparentIndex = palette.findIndex((c) => c[3] === 0);
  const enc = GIFEncoder();
  enc.writeFrame(index, w, h, {
    palette,
    transparent: transparentIndex >= 0,
    transparentIndex: Math.max(0, transparentIndex),
  });
  enc.finish();
  return new Blob([enc.bytes() as Uint8Array<ArrayBuffer>], { type: "image/gif" });
}

/** AVIF via libavif (WebAssembly, loaded on first use); quality 0–100 */
export async function avif(canvas: OffscreenCanvas, quality: number): Promise<Blob> {
  const { default: encode } = await import("@jsquash/avif/encode.js");
  const out = await encode(pixels(canvas), { quality });
  return new Blob([out], { type: "image/avif" });
}
