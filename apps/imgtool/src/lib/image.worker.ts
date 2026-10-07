/// <reference lib="webworker" />
import {
  baseDims,
  hasGeometry,
  isLossy,
  outDims,
  outType,
  type Settings,
} from "./settings";

/**
 * Decoding and encoding run here so the page stays responsive.
 * Decoded images are cached by key; nothing leaves this device.
 */
const bitmaps = new Map<string, ImageBitmap>();

export type WorkerRequest =
  | { id: number; kind: "load"; key: string; file: Blob }
  | { id: number; kind: "drop"; key: string }
  | {
      id: number;
      kind: "encode";
      key: string;
      srcType: string;
      settings: Settings;
    }
  | { id: number; kind: "sample" };

export interface EncodeResult {
  blob: Blob;
  w: number;
  h: number;
  type: string;
  q: number;
  /** Target size couldn't be reached even at the lowest quality */
  over: boolean;
}

/** Apply crop, rotation and flips. Returns the bitmap itself when there's nothing to do. */
function geometry(
  bmp: ImageBitmap,
  s: Settings,
): CanvasImageSource & { width: number; height: number } {
  if (!hasGeometry(s)) return bmp;
  const [bw, bh] = baseDims(bmp.width, bmp.height, s);
  const sx = s.crop ? s.crop.x * bmp.width : 0;
  const sy = s.crop ? s.crop.y * bmp.height : 0;
  const sw = s.crop ? s.crop.w * bmp.width : bmp.width;
  const sh = s.crop ? s.crop.h * bmp.height : bmp.height;
  const c = new OffscreenCanvas(bw, bh);
  const ctx = c.getContext("2d")!;
  ctx.translate(bw / 2, bh / 2);
  ctx.rotate((s.rotate * Math.PI) / 180);
  ctx.scale(s.flipH ? -1 : 1, s.flipV ? -1 : 1);
  ctx.drawImage(bmp, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
  return c;
}

async function encodeAt(
  bmp: ImageBitmap,
  s: Settings,
  srcType: string,
  quality: number,
) {
  const src = geometry(bmp, s);
  const [w, h] = outDims(bmp.width, bmp.height, s);
  const type = outType(srcType, s);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (type === "image/jpeg") {
    // JPEG has no transparency; paint white so transparent areas don't turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
  }
  if (s.w && s.h && !s.lock) {
    // Fixed frame (social presets): scale to cover and crop the overflow evenly.
    const scale = Math.max(w / src.width, h / src.height);
    const dw = src.width * scale;
    const dh = src.height * scale;
    ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    ctx.drawImage(src, 0, 0, w, h);
  }
  const blob = await canvas.convertToBlob({ type, quality: quality / 100 });
  return { blob, w, h, type };
}

async function encode(
  bmp: ImageBitmap,
  s: Settings,
  srcType: string,
): Promise<EncodeResult> {
  const type = outType(srcType, s);
  if (!s.target || !isLossy(type))
    return {
      ...(await encodeAt(bmp, s, srcType, s.quality)),
      q: s.quality,
      over: false,
    };
  // Binary-search the highest quality that fits the target size.
  const limit = s.target * 1024;
  let lo = 5;
  let hi = 95;
  let best: EncodeResult | null = null;
  for (let i = 0; i < 7 && lo <= hi; i++) {
    const mid = Math.round((lo + hi) / 2);
    const r = await encodeAt(bmp, s, srcType, mid);
    if (r.blob.size <= limit) {
      best = { ...r, q: mid, over: false };
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best ?? { ...(await encodeAt(bmp, s, srcType, 5)), q: 5, over: true };
}

/** A grainy landscape so tools can be tried without a file. Grain makes sizes behave like a real photo. */
async function sample(): Promise<Blob> {
  const W = 2400;
  const H = 1600;
  const c = new OffscreenCanvas(W, H);
  const x = c.getContext("2d")!;
  const sky = x.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#ffb37a");
  sky.addColorStop(0.5, "#ff7e7e");
  sky.addColorStop(1, "#7a5cff");
  x.fillStyle = sky;
  x.fillRect(0, 0, W, H);
  x.fillStyle = "#ffe7a8";
  x.beginPath();
  x.arc(1600, 640, 190, 0, Math.PI * 2);
  x.fill();
  const ridge = (pts: [number, number][], col: string) => {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(0, H);
    for (const [a, b] of pts) x.lineTo(a, b);
    x.lineTo(W, H);
    x.fill();
  };
  ridge(
    [
      [0, 1000],
      [380, 640],
      [700, 880],
      [1100, 470],
      [1550, 900],
      [1900, 650],
      [2400, 960],
    ],
    "#3b2f7a",
  );
  ridge(
    [
      [0, 1150],
      [500, 860],
      [950, 1090],
      [1450, 800],
      [1950, 1060],
      [2400, 900],
    ],
    "#2a2160",
  );
  const lake = x.createLinearGradient(0, 1240, 0, H);
  lake.addColorStop(0, "#5a4bd1");
  lake.addColorStop(1, "#1e2a5a");
  x.fillStyle = lake;
  x.fillRect(0, 1240, W, H - 1240);
  const img = x.getImageData(0, 0, W, H);
  const p = img.data;
  for (let i = 0; i < p.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    p[i] = p[i]! + n;
    p[i + 1] = p[i + 1]! + n;
    p[i + 2] = p[i + 2]! + n;
  }
  x.putImageData(img, 0, 0);
  return c.convertToBlob({ type: "image/jpeg", quality: 0.95 });
}

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  try {
    if (data.kind === "load") {
      const bmp = await createImageBitmap(data.file, {
        imageOrientation: "from-image",
      });
      bitmaps.set(data.key, bmp);
      self.postMessage({
        id: data.id,
        ok: true,
        value: { w: bmp.width, h: bmp.height },
      });
    } else if (data.kind === "drop") {
      bitmaps.get(data.key)?.close();
      bitmaps.delete(data.key);
      self.postMessage({ id: data.id, ok: true });
    } else if (data.kind === "encode") {
      const bmp = bitmaps.get(data.key);
      if (!bmp) throw new Error("Image is no longer loaded");
      self.postMessage({
        id: data.id,
        ok: true,
        value: await encode(bmp, data.settings, data.srcType),
      });
    } else if (data.kind === "sample") {
      self.postMessage({ id: data.id, ok: true, value: await sample() });
    }
  } catch (err) {
    self.postMessage({
      id: data.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
