/// <reference lib="webworker" />
import type * as Ort from "onnxruntime-web";

/**
 * On-device models, run in the image worker with onnxruntime-web (WebAssembly, single thread).
 * Models are served from this site (/models), so nothing is sent anywhere:
 * - MODNet (Apache-2.0): portrait matting for people
 * - U²-Net-p (Apache-2.0): general subject cut-out for objects
 * - UltraFace RFB-320 (MIT): face boxes for face blur and passport framing
 */

let ortP: Promise<typeof Ort> | null = null;
function ort(): Promise<typeof Ort> {
  ortP ??= (async () => {
    const o = await import("onnxruntime-web/wasm");
    const wasm = (
      await import("onnxruntime-web/ort-wasm-simd-threaded.wasm?url")
    ).default;
    o.env.wasm.wasmPaths = { wasm };
    // Threads need cross-origin isolation, which the site doesn't use
    o.env.wasm.numThreads = 1;
    return o;
  })();
  return ortP;
}

const sessions = new Map<string, Promise<Ort.InferenceSession>>();
function session(file: string): Promise<Ort.InferenceSession> {
  let s = sessions.get(file);
  if (!s) {
    s = ort().then((o) =>
      o.InferenceSession.create(`/models/${file}`, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      }),
    );
    // Let a failed download be retried later
    s.catch(() => sessions.delete(file));
    sessions.set(file, s);
  }
  return s;
}

function pixels(src: ImageBitmap | OffscreenCanvas, w: number, h: number) {
  const c = new OffscreenCanvas(w, h);
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, w, h);
  return x.getImageData(0, 0, w, h).data;
}

/** Planar float32 tensor data, with per-channel (v/255 - mean) / std */
function planar(
  px: Uint8ClampedArray,
  n: number,
  mean: number[],
  std: number[],
): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++)
    for (let c = 0; c < 3; c++)
      out[c * n + i] = (px[i * 4 + c]! / 255 - mean[c]!) / std[c]!;
  return out;
}

/* ---------- Faces ---------- */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

function iou(a: Box, b: Box) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a.w * a.h + b.w * b.h - inter || 1);
}

function nms(boxes: Box[], thr = 0.3): Box[] {
  const keep: Box[] = [];
  for (const b of boxes.sort((p, q) => q.score - p.score))
    if (keep.every((k) => iou(k, b) < thr)) keep.push(b);
  return keep;
}

async function detectIn(
  bmp: ImageBitmap,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): Promise<Box[]> {
  const o = await ort();
  const s = await session("ultraface-320.onnx");
  const W = 320;
  const H = 240;
  const c = new OffscreenCanvas(W, H);
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(bmp, sx, sy, sw, sh, 0, 0, W, H);
  const px = x.getImageData(0, 0, W, H).data;
  const data = new Float32Array(3 * W * H);
  for (let i = 0; i < W * H; i++)
    for (let ch = 0; ch < 3; ch++)
      data[ch * W * H + i] = (px[i * 4 + ch]! - 127) / 128;
  const out = await s.run({
    [s.inputNames[0]!]: new o.Tensor("float32", data, [1, 3, H, W]),
  });
  const scores = out["scores"]!.data as Float32Array;
  const boxes = out["boxes"]!.data as Float32Array;
  const found: Box[] = [];
  for (let i = 0; i < scores.length / 2; i++) {
    const score = scores[i * 2 + 1]!;
    if (score < 0.75) continue;
    const x1 = boxes[i * 4]!;
    const y1 = boxes[i * 4 + 1]!;
    const x2 = boxes[i * 4 + 2]!;
    const y2 = boxes[i * 4 + 3]!;
    found.push({
      x: (sx + x1 * sw) / bmp.width,
      y: (sy + y1 * sh) / bmp.height,
      w: ((x2 - x1) * sw) / bmp.width,
      h: ((y2 - y1) * sh) / bmp.height,
      score,
    });
  }
  return found;
}

/**
 * Face boxes as fractions of the image. The whole image is checked, then overlapping tiles,
 * so small faces in group photos are found too.
 */
export async function faces(bmp: ImageBitmap): Promise<Box[]> {
  const all = await detectIn(bmp, 0, 0, bmp.width, bmp.height);
  const long = Math.max(bmp.width, bmp.height);
  if (long > 900) {
    const n = long > 2400 ? 3 : 2;
    const tw = bmp.width / n;
    const th = bmp.height / n;
    const ox = tw * 0.25;
    const oy = th * 0.25;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const sx = Math.max(0, c * tw - ox);
        const sy = Math.max(0, r * th - oy);
        const sw = Math.min(bmp.width - sx, tw + ox * 2);
        const sh = Math.min(bmp.height - sy, th + oy * 2);
        all.push(...(await detectIn(bmp, sx, sy, sw, sh)));
      }
  }
  return nms(all).filter((b) => b.w > 0.004 && b.h > 0.004);
}

/* ---------- Subject masks ---------- */

export type MaskModel = "person" | "object";

/** Alpha mask the size of the image: white where the subject is */
export async function mask(
  bmp: ImageBitmap,
  model: MaskModel,
): Promise<ImageBitmap> {
  const o = await ort();
  let w: number;
  let h: number;
  let matte: Float32Array;
  if (model === "person") {
    const s = await session("modnet.onnx");
    // MODNet works best around 512 px, in multiples of 32
    const scale = 512 / Math.max(bmp.width, bmp.height);
    w = Math.max(32, Math.round((bmp.width * scale) / 32) * 32);
    h = Math.max(32, Math.round((bmp.height * scale) / 32) * 32);
    const data = planar(
      pixels(bmp, w, h),
      w * h,
      [0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
    );
    const out = await s.run({
      [s.inputNames[0]!]: new o.Tensor("float32", data, [1, 3, h, w]),
    });
    matte = out[s.outputNames[0]!]!.data as Float32Array;
  } else {
    const s = await session("u2netp.onnx");
    w = 320;
    h = 320;
    const data = planar(
      pixels(bmp, w, h),
      w * h,
      [0.485, 0.456, 0.406],
      [0.229, 0.224, 0.225],
    );
    const out = await s.run({
      [s.inputNames[0]!]: new o.Tensor("float32", data, [1, 3, h, w]),
    });
    const raw = out[s.outputNames[0]!]!.data as Float32Array;
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of raw) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    matte = raw.map((v) => (v - lo) / (hi - lo || 1));
  }
  // People keep soft hair edges; objects get crisper edges with less colour fringe
  const [lo0, span] = model === "person" ? [0.06, 0.88] : [0.22, 0.5];
  const img = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    // Firm up the edges a little: near-0 and near-1 snap, the soft middle (hair) stays soft
    const a = Math.min(1, Math.max(0, (matte[i]! - lo0) / span));
    img.data[i * 4] = 255;
    img.data[i * 4 + 1] = 255;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = Math.round(a * 255);
  }
  const small = await createImageBitmap(img);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const x = c.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  x.drawImage(small, 0, 0, bmp.width, bmp.height);
  small.close();
  return c.transferToImageBitmap();
}
