/// <reference lib="webworker" />
import type * as Ort from "onnxruntime-web";
import { CLS, DET, REC, type ModelFile, type RecId } from "./photo-models";
import { PHOTO_STATUS as S } from "./photo-status";
import { dist, type Pt, type Quad, type Read } from "./photo-layout";

/**
 * The photo engine's worker: PaddleOCR (PP-OCRv5 mobile) on onnxruntime-web, WebAssembly, one
 * thread. photo.ts runs a small pool of these: the first one finds the text, then all of them
 * read the strips in parallel.
 *
 *   load:   fetch (first time: download, then the Cache API) and start the models
 *   detect: DBNet probability map → connected parts → minimum-area rectangles grown back to the
 *           full text height → each cut out as a straight 48 px strip → 0°/180° check
 *   read:   recognise strips (CTC, greedy) with each recognition model
 */

export interface Strip {
  /** Corners in the source image, in reading order */
  quad: Quad;
  /** Which detected box it came from (upside-down candidates are read both ways) */
  box: number;
  /** RGBA pixels, REC_H tall */
  px: Uint8ClampedArray;
  w: number;
}

export type PhotoRequest =
  | { id: number; kind: "load"; recs: RecId[]; detect: boolean }
  | { id: number; kind: "detect"; bitmap: ImageBitmap }
  | { id: number; kind: "read"; recs: RecId[]; strips: Strip[] };

export type PhotoResponse =
  | { id: number; kind: "progress"; p: number; status: string }
  /** Strips read so far in a "read" job */
  | { id: number; kind: "batch"; n: number }
  | {
      id: number;
      kind: "done";
      boxes?: number;
      strips?: Strip[];
      reads?: Read[][];
    }
  | { id: number; kind: "error"; message: string };

/* ---------- Runtime and models ---------- */

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
    o.env.logLevel = "error";
    return o;
  })();
  ortP.catch(() => (ortP = null));
  return ortP;
}

/** Same cache the service worker uses for big files, so a model is stored once */
const CACHE = "kmra-runtime";
const url = (file: string) => `/models/${file}`;

async function cached(file: string): Promise<Response | undefined> {
  try {
    return await caches.match(url(file));
  } catch {
    return undefined;
  }
}

/** A model file's bytes, from the cache or downloaded (with progress) and then cached */
async function fetchBytes(
  file: string,
  onBytes: (n: number) => void,
): Promise<Uint8Array> {
  const hit = await cached(file);
  if (hit) return new Uint8Array(await hit.arrayBuffer());
  const res = await fetch(url(file));
  if (!res.ok || !res.body) throw new Error(`${file}: HTTP ${res.status}`);
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    n += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  try {
    const c = await caches.open(CACHE);
    await c.put(
      url(file),
      new Response(out.slice(), {
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );
  } catch {
    // No Cache API (e.g. private browsing): the HTTP cache still helps
  }
  return out;
}

const sessions = new Map<string, Promise<Ort.InferenceSession>>();
const dicts = new Map<RecId, Promise<string[]>>();

function session(
  m: ModelFile,
  onBytes: (n: number) => void = () => {},
): Promise<Ort.InferenceSession> {
  let s = sessions.get(m.file);
  if (!s) {
    s = (async () => {
      const [o, bytes] = await Promise.all([
        ort(),
        fetchBytes(m.file, onBytes),
      ]);
      return o.InferenceSession.create(bytes, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
        logSeverityLevel: 3,
      });
    })();
    s.catch(() => sessions.delete(m.file));
    sessions.set(m.file, s);
  }
  return s;
}

/** CTC classes: blank, the model's character list, then space */
function dict(id: RecId): Promise<string[]> {
  let d = dicts.get(id);
  if (!d) {
    d = (async () => {
      const res = await fetch(url(REC[id].dict));
      if (!res.ok) throw new Error(`${REC[id].dict}: HTTP ${res.status}`);
      const lines = (await res.text())
        .split("\n")
        .map((l) => l.replace(/\r$/, ""));
      if (lines.at(-1) === "") lines.pop();
      return ["", ...lines, " "];
    })();
    d.catch(() => dicts.delete(id));
    dicts.set(id, d);
  }
  return d;
}

async function load(
  id: number,
  recs: RecId[],
  detect: boolean,
  post: (m: PhotoResponse) => void,
) {
  const files: ModelFile[] = [
    ...(detect ? [DET, CLS] : []),
    ...recs.map((r) => REC[r]),
  ];
  const missing: ModelFile[] = [];
  for (const f of files)
    if (!sessions.has(f.file) && !(await cached(f.file))) missing.push(f);
  const total = missing.reduce((n, f) => n + f.bytes, 0);
  let got = 0;
  const status = total ? S.download : S.load;
  post({ id, kind: "progress", p: 0, status });
  await Promise.all([
    ...files.map((f) =>
      session(f, (n) => {
        got += n;
        post({ id, kind: "progress", p: got / Math.max(1, total), status });
      }),
    ),
    ...recs.map(dict),
  ]);
}

/* ---------- Geometry ---------- */

function cross(o: Pt, a: Pt, b: Pt) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Monotone-chain convex hull */
function hull(pts: Pt[]): Pt[] {
  pts.sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const lo: Pt[] = [];
  for (const p of pts) {
    while (
      lo.length >= 2 &&
      cross(lo[lo.length - 2]!, lo[lo.length - 1]!, p) <= 0
    )
      lo.pop();
    lo.push(p);
  }
  const up: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (
      up.length >= 2 &&
      cross(up[up.length - 2]!, up[up.length - 1]!, p) <= 0
    )
      up.pop();
    up.push(p);
  }
  lo.pop();
  up.pop();
  return lo.concat(up);
}

interface Rect {
  cx: number;
  cy: number;
  /** Reading direction (unit vector pointing right) */
  ux: number;
  uy: number;
  /** Length along and height across the reading direction */
  w: number;
  h: number;
}

/** Minimum-area rectangle around a convex polygon (the frame turned to each edge) */
function minRect(h: Pt[]): Rect {
  let best: Rect | null = null;
  let bestArea = Infinity;
  const n = h.length;
  for (let i = 0; i < n; i++) {
    const a = h[i]!;
    const b = h[(i + 1) % n]!;
    let ux = b.x - a.x;
    let uy = b.y - a.y;
    const len = Math.hypot(ux, uy);
    if (len < 1e-9) continue;
    ux /= len;
    uy /= len;
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of h) {
      const u = p.x * ux + p.y * uy;
      const v = -p.x * uy + p.y * ux;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < bestArea) {
      bestArea = area;
      const cu = (minU + maxU) / 2;
      const cv = (minV + maxV) / 2;
      best = {
        cx: cu * ux - cv * uy,
        cy: cu * uy + cv * ux,
        ux,
        uy,
        w: maxU - minU,
        h: maxV - minV,
      };
    }
  }
  if (!best) {
    const xs = h.map((p) => p.x);
    const ys = h.map((p) => p.y);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const x1 = Math.max(...xs);
    const y1 = Math.max(...ys);
    best = {
      cx: (x0 + x1) / 2,
      cy: (y0 + y1) / 2,
      ux: 1,
      uy: 0,
      w: x1 - x0,
      h: y1 - y0,
    };
  }
  // Read along the axis closer to horizontal, left to right
  if (Math.abs(best.uy) > Math.abs(best.ux))
    best = { ...best, ux: best.uy, uy: -best.ux, w: best.h, h: best.w };
  if (best.ux < 0) best = { ...best, ux: -best.ux, uy: -best.uy };
  return best;
}

function corners(r: Rect): Quad {
  const ax = (r.ux * r.w) / 2;
  const ay = (r.uy * r.w) / 2;
  // Down the page: perpendicular to the reading direction
  const bx = (-r.uy * r.h) / 2;
  const by = (r.ux * r.h) / 2;
  return [
    { x: r.cx - ax - bx, y: r.cy - ay - by },
    { x: r.cx + ax - bx, y: r.cy + ay - by },
    { x: r.cx + ax + bx, y: r.cy + ay + by },
    { x: r.cx - ax + bx, y: r.cy - ay + by },
  ];
}

/** Tall, narrow boxes are vertical text, read top to bottom */
function readingQuad(q: Quad): Quad {
  if (dist(q[0], q[3]) / Math.max(1, dist(q[0], q[1])) >= 1.5)
    return [q[1], q[2], q[3], q[0]];
  return q;
}

const flip = (q: Quad): Quad => [q[2], q[3], q[0], q[1]];

/* ---------- Detection ---------- */

/** Long side of the detection input: full size for screenshots, less for big photos */
const DET_MAX = 1920;
/** Small images are enlarged so small text is still found */
const DET_MIN = 960;
const BIN_THRESH = 0.3;
const BOX_THRESH = 0.6;
const UNCLIP = 1.6;

function detSize(w: number, h: number): [number, number] {
  const long = Math.max(w, h);
  let s = 1;
  if (long > DET_MAX) s = DET_MAX / long;
  else if (long < DET_MIN) s = Math.min(2, DET_MIN / long);
  const r32 = (v: number) => Math.max(32, Math.round((v * s) / 32) * 32);
  return [r32(w), r32(h)];
}

/** RGBA pixels → normalised planar BGR (the models were trained on OpenCV's channel order) */
function planarBGR(
  px: Uint8ClampedArray,
  out: Float32Array,
  offset: number,
  w: number,
  h: number,
  stride: number,
  mean: number[],
  std: number[],
) {
  const plane = stride * h;
  const k = [0, 1, 2].map((c) => 1 / 255 / std[c]!);
  const m = [0, 1, 2].map((c) => mean[c]! / std[c]!);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const j = offset + y * stride + x;
      out[j] = px[i + 2]! * k[0]! - m[0]!;
      out[j + plane] = px[i + 1]! * k[1]! - m[1]!;
      out[j + 2 * plane] = px[i]! * k[2]! - m[2]!;
    }
}

async function detect(
  o: typeof Ort,
  s: Ort.InferenceSession,
  bmp: ImageBitmap,
): Promise<Quad[]> {
  const [dw, dh] = detSize(bmp.width, bmp.height);
  const c = new OffscreenCanvas(dw, dh);
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.imageSmoothingQuality = "high";
  x.drawImage(bmp, 0, 0, dw, dh);
  const px = x.getImageData(0, 0, dw, dh).data;
  const data = new Float32Array(3 * dw * dh);
  planarBGR(
    px,
    data,
    0,
    dw,
    dh,
    dw,
    [0.485, 0.456, 0.406],
    [0.229, 0.224, 0.225],
  );
  const out = await s.run({
    [s.inputNames[0]!]: new o.Tensor("float32", data, [1, 3, dh, dw]),
  });
  const t = out[s.outputNames[0]!]!;
  const [, , ph, pw] = t.dims as number[];
  const sx = bmp.width / pw!;
  const sy = bmp.height / ph!;
  return dbBoxes(t.data as Float32Array, pw!, ph!).map(
    (q) => q.map((p) => ({ x: p.x * sx, y: p.y * sy })) as Quad,
  );
}

/** DB post-processing: binarise, connected parts, minimum-area rectangles, grow (unclip) */
function dbBoxes(prob: Float32Array, W: number, H: number): Quad[] {
  const n = W * H;
  const seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (prob[i]! <= BIN_THRESH) seen[i] = 1;
  const stack = new Int32Array(n);
  const comp = new Int32Array(n);
  const quads: Quad[] = [];
  for (let start = 0; start < n; start++) {
    if (seen[start]) continue;
    // Flood fill (4-connected)
    let sp = 0;
    let len = 0;
    stack[sp++] = start;
    seen[start] = 1;
    let sum = 0;
    let y0 = H;
    let y1 = -1;
    while (sp) {
      const i = stack[--sp]!;
      comp[len++] = i;
      sum += prob[i]!;
      const y = (i / W) | 0;
      const xx = i - y * W;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (xx > 0 && !seen[i - 1]) {
        seen[i - 1] = 1;
        stack[sp++] = i - 1;
      }
      if (xx < W - 1 && !seen[i + 1]) {
        seen[i + 1] = 1;
        stack[sp++] = i + 1;
      }
      if (y > 0 && !seen[i - W]) {
        seen[i - W] = 1;
        stack[sp++] = i - W;
      }
      if (y < H - 1 && !seen[i + W]) {
        seen[i + W] = 1;
        stack[sp++] = i + W;
      }
    }
    if (len < 6 || sum / len < BOX_THRESH) continue;
    // Each row's leftmost and rightmost pixel is enough for the convex hull
    const rows = y1 - y0 + 1;
    const lo = new Int32Array(rows).fill(W);
    const hi = new Int32Array(rows).fill(-1);
    for (let k = 0; k < len; k++) {
      const i = comp[k]!;
      const y = (i / W) | 0;
      const xx = i - y * W;
      const r = y - y0;
      if (xx < lo[r]!) lo[r] = xx;
      if (xx > hi[r]!) hi[r] = xx;
    }
    const pts: Pt[] = [];
    for (let r = 0; r < rows; r++) {
      if (hi[r]! < 0) continue;
      const y = y0 + r;
      pts.push(
        { x: lo[r]!, y },
        { x: lo[r]!, y: y + 1 },
        { x: hi[r]! + 1, y },
        { x: hi[r]! + 1, y: y + 1 },
      );
    }
    const rect = minRect(hull(pts));
    if (Math.min(rect.w, rect.h) < 3) continue;
    // DB predicts a shrunk text core; grow it by area × ratio / perimeter
    const d = (rect.w * rect.h * UNCLIP) / (2 * (rect.w + rect.h));
    const grown = { ...rect, w: rect.w + 2 * d, h: rect.h + 2 * d };
    if (Math.min(grown.w, grown.h) < 5) continue;
    quads.push(corners(grown));
  }
  return quads;
}

/* ---------- Strips and orientation ---------- */

const REC_H = 48;
const REC_MAX_W = 3200;

/** Cut a rotated box out of the image as a horizontal strip REC_H pixels tall */
function cut(bmp: ImageBitmap, q: Quad): { px: Uint8ClampedArray; w: number } {
  const len = dist(q[0], q[1]);
  const ht = Math.max(1, dist(q[0], q[3]));
  const W = Math.max(8, Math.min(REC_MAX_W, Math.ceil((REC_H * len) / ht)));
  const H = REC_H;
  const c = new OffscreenCanvas(W, H);
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.imageSmoothingQuality = "high";
  // Strip (u, v) ← source q0 + u·ex + v·ey; the canvas transform is the inverse
  const ex = { x: (q[1].x - q[0].x) / W, y: (q[1].y - q[0].y) / W };
  const ey = { x: (q[3].x - q[0].x) / H, y: (q[3].y - q[0].y) / H };
  const det = ex.x * ey.y - ey.x * ex.y;
  const a = ey.y / det;
  const b = -ex.y / det;
  const cc = -ey.x / det;
  const d = ex.x / det;
  x.setTransform(
    a,
    b,
    cc,
    d,
    -(a * q[0].x + cc * q[0].y),
    -(b * q[0].x + d * q[0].y),
  );
  x.drawImage(bmp, 0, 0);
  return { px: x.getImageData(0, 0, W, H).data, w: W };
}

/** Line classifier: probability that each strip is upside down */
async function upsideDown(
  o: typeof Ort,
  s: Ort.InferenceSession,
  strips: Strip[],
): Promise<number[]> {
  const CW = 192;
  const out: number[] = [];
  for (let i = 0; i < strips.length; i += 16) {
    const part = strips.slice(i, i + 16);
    const data = new Float32Array(part.length * 3 * REC_H * CW);
    part.forEach((st, k) => {
      // Wider strips are squeezed to the classifier's width, as in PaddleOCR
      const w = Math.min(CW, st.w);
      const src = new OffscreenCanvas(st.w, REC_H);
      src
        .getContext("2d")!
        .putImageData(
          new ImageData(st.px as ImageDataArray, st.w, REC_H),
          0,
          0,
        );
      const c = new OffscreenCanvas(w, REC_H);
      const x = c.getContext("2d", { willReadFrequently: true })!;
      x.drawImage(src, 0, 0, w, REC_H);
      planarBGR(
        x.getImageData(0, 0, w, REC_H).data,
        data,
        k * 3 * REC_H * CW,
        w,
        REC_H,
        CW,
        [0.5, 0.5, 0.5],
        [0.5, 0.5, 0.5],
      );
    });
    const r = await s.run({
      [s.inputNames[0]!]: new o.Tensor("float32", data, [
        part.length,
        3,
        REC_H,
        CW,
      ]),
    });
    const p = r[s.outputNames[0]!]!.data as Float32Array;
    for (let k = 0; k < part.length; k++) out.push(p[k * 2 + 1]!);
  }
  return out;
}

/** Find the text and cut it into strips; boxes that look upside down get a flipped strip too */
async function strips(bmp: ImageBitmap) {
  const o = await ort();
  const quads = (await detect(o, await session(DET), bmp)).map(readingQuad);
  const out: Strip[] = quads.map((quad, box) => ({
    quad,
    box,
    ...cut(bmp, quad),
  }));
  const flips = await upsideDown(o, await session(CLS), out);
  flips.forEach((p, box) => {
    if (p > 0.9) {
      const quad = flip(out[box]!.quad);
      out.push({ quad, box, ...cut(bmp, quad) });
    }
  });
  return { boxes: quads.length, strips: out };
}

/* ---------- Recognition ---------- */

const BATCH = 6;

async function recognise(
  s: Ort.InferenceSession,
  classes: string[],
  strips: Strip[],
  onBatch: (n: number) => void,
): Promise<Read[]> {
  const o = await ort();
  // Similar widths together, so little of each batch is padding
  const order = strips
    .map((_, i) => i)
    .sort((a, b) => strips[a]!.w - strips[b]!.w);
  const reads: Read[] = new Array(strips.length);
  for (let i = 0; i < order.length; i += BATCH) {
    const idx = order.slice(i, i + BATCH);
    const W = Math.max(64, ...idx.map((k) => strips[k]!.w));
    const plane = REC_H * W;
    // Padding is 0 after normalising (mid grey), as in PaddleOCR
    const data = new Float32Array(idx.length * 3 * plane);
    idx.forEach((k, b) => {
      const st = strips[k]!;
      planarBGR(
        st.px,
        data,
        b * 3 * plane,
        st.w,
        REC_H,
        W,
        [0.5, 0.5, 0.5],
        [0.5, 0.5, 0.5],
      );
    });
    const r = await s.run({
      [s.inputNames[0]!]: new o.Tensor("float32", data, [
        idx.length,
        3,
        REC_H,
        W,
      ]),
    });
    const t = r[s.outputNames[0]!]!;
    const [, T, C] = t.dims as [number, number, number];
    const p = t.data as Float32Array;
    const step = W / T;
    idx.forEach((k, b) => {
      const st = strips[k]!;
      // Greedy CTC: best class per step, repeats merged, blanks dropped
      let prev = 0;
      let sum = 0;
      let text = "";
      const chars: Read["chars"] = [];
      for (let ti = 0; ti < T; ti++) {
        const base = (b * T + ti) * C;
        let best = 0;
        let bp = p[base]!;
        for (let ci = 1; ci < C; ci++) {
          const v = p[base + ci]!;
          if (v > bp) {
            bp = v;
            best = ci;
          }
        }
        if (best !== 0 && best !== prev) {
          const ch = classes[best] ?? "";
          text += ch;
          sum += bp;
          chars.push({
            ch,
            at: Math.min(1, ((ti + 0.5) * step) / st.w),
            p: bp,
          });
        }
        prev = best;
      }
      reads[k] = {
        text,
        conf: chars.length ? (sum / chars.length) * 100 : 0,
        chars,
      };
    });
    onBatch(Math.min(order.length, i + BATCH));
  }
  return reads;
}

/* ---------- Messages ---------- */

class LoadError extends Error {}

const post = (m: PhotoResponse, transfer: Transferable[] = []) =>
  (self as DedicatedWorkerGlobalScope).postMessage(m, transfer);

async function handle(req: PhotoRequest) {
  const { id } = req;
  if (req.kind === "load") {
    try {
      await load(id, req.recs, req.detect, post);
    } catch (err) {
      throw new LoadError(String(err));
    }
    post({ id, kind: "done" });
  } else if (req.kind === "detect") {
    const r = await strips(req.bitmap);
    req.bitmap.close();
    post(
      { id, kind: "done", ...r },
      r.strips.map((s) => s.px.buffer),
    );
  } else {
    const reads: Read[][] = [];
    let done = 0;
    for (const rec of req.recs) {
      const base = done;
      reads.push(
        await recognise(
          await session(REC[rec]),
          await dict(rec),
          req.strips,
          (n) => {
            done = base + n;
            post({ id, kind: "batch", n: done });
          },
        ),
      );
      done = base + req.strips.length;
    }
    post({ id, kind: "done", reads });
  }
}

// One job at a time, in order
let queue: Promise<unknown> = Promise.resolve();
self.onmessage = (e: MessageEvent<PhotoRequest>) => {
  const req = e.data;
  queue = queue.then(() =>
    handle(req).catch((err: unknown) => {
      console.warn(err);
      post({
        id: req.id,
        kind: "error",
        message: err instanceof LoadError ? S.loadFailed : S.failed,
      });
    }),
  );
};
