import type { OcrResult, RecognizeOptions } from "./types";
import type { PhotoRequest, PhotoResponse, Strip } from "./photo.worker";
import { LANG_MODEL, bytesFor, modelsFor } from "./photo-models";
import { PHOTO_STATUS } from "./photo-status";
import { layout, segments, type Quad, type Read } from "./photo-layout";

/**
 * The photo engine (PaddleOCR PP-OCRv5 mobile on onnxruntime-web) for screenshots, photos and
 * uneven text. Everything heavy runs in workers: the first finds the text, then a small pool
 * reads the lines in parallel (WebAssembly runs one thread per worker here). Models load on
 * first use from /models and stay cached; later calls reuse the running workers.
 */

/** Tesseract codes the photo engine reads */
export const PHOTO_LANGS: string[] = Object.keys(LANG_MODEL);

/** Download size in bytes for a language choice when nothing is cached yet */
export const photoDownloadBytes = bytesFor;

/** Every English status and error string the engine reports (translate with T()) */
export { PHOTO_STATUS };

type Payload = Extract<PhotoResponse, { kind: "done" }>;

interface Job {
  resolve: (r: Payload) => void;
  reject: (e: Error) => void;
  onMessage?: (m: PhotoResponse) => void;
}

/** Reader workers; the first also finds the text. Started when first needed. */
let pool: (Worker | undefined)[] = [];
let nextId = 1;
const jobs = new Map<number, Job>();

/** Readers in parallel: a few on laptops, fewer on small devices */
function poolSize() {
  const cores = navigator.hardwareConcurrency || 2;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  return Math.max(1, Math.min(3, cores - 1, mem <= 2 ? 1 : mem <= 4 ? 2 : 3));
}

function spawn(): Worker {
  const w = new Worker(new URL("./photo.worker.ts", import.meta.url), {
    type: "module",
    name: "photo-ocr",
  });
  w.onmessage = (e: MessageEvent<PhotoResponse>) => {
    const m = e.data;
    const job = jobs.get(m.id);
    if (!job) return;
    if (m.kind === "done") {
      jobs.delete(m.id);
      job.resolve(m);
    } else if (m.kind === "error") {
      jobs.delete(m.id);
      job.reject(new Error(m.message));
    } else job.onMessage?.(m);
  };
  w.onerror = (e) => {
    e.preventDefault();
    stop(new Error(PHOTO_STATUS.failed));
  };
  return w;
}

/** How many readers this device gets */
function size(): number {
  if (!pool.length) pool = new Array<Worker | undefined>(poolSize());
  return pool.length;
}

function worker(i: number): Worker {
  size();
  return (pool[i] ??= spawn());
}

/** Stop all workers and fail what they were doing (the models load again next time) */
function stop(err: Error) {
  for (const w of pool) w?.terminate();
  pool = [];
  for (const job of jobs.values()) job.reject(err);
  jobs.clear();
}

/** Distributive Omit, so each request kind keeps its own fields */
type Req = PhotoRequest extends infer R
  ? R extends PhotoRequest
    ? Omit<R, "id">
    : never
  : never;

function call(
  w: Worker,
  req: Req,
  onMessage?: (m: PhotoResponse) => void,
  transfer: Transferable[] = [],
): Promise<Payload> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    jobs.set(id, { resolve, reject, onMessage });
    w.postMessage({ ...req, id } as PhotoRequest, transfer);
  });
}

/** Split strips over n readers so each gets about the same total width */
function share(strips: Strip[], n: number): Strip[][] {
  const parts: Strip[][] = Array.from({ length: n }, () => []);
  const load = new Array<number>(n).fill(0);
  for (const s of [...strips].sort((a, b) => b.w - a.w)) {
    const i = load.indexOf(Math.min(...load));
    parts[i]!.push(s);
    // Each batch costs a little on top of its width
    load[i]! += s.w + 200;
  }
  return parts.filter((p) => p.length);
}

export async function recognizePhoto(
  image: ImageBitmap,
  opts: RecognizeOptions,
): Promise<OcrResult> {
  const { signal, onProgress } = opts;
  const aborted = () => new DOMException("Aborted", "AbortError");
  if (signal?.aborted) throw aborted();
  const { recs, used } = modelsFor(opts.langs);
  if (!recs.length) throw new Error(PHOTO_STATUS.noLangs);
  const t0 = performance.now();
  const progress = (p: number, status: string) => onProgress?.(p, status);
  const onAbort = () => stop(aborted());
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    // 1. Models (downloaded once), on the first worker
    await call(worker(0), { kind: "load", recs, detect: true }, (m) => {
      if (m.kind === "progress") progress(0.4 * m.p, m.status);
    });
    // The other readers start from the cache while the text is found
    const n = size();
    const warm = Array.from({ length: n - 1 }, (_, i) =>
      call(worker(i + 1), { kind: "load", recs, detect: false }),
    );
    warm.forEach((p) => p.catch(() => {}));

    // 2. Find the text (the worker gets its own copy of the image and closes it)
    progress(0.42, PHOTO_STATUS.find);
    const bitmap = await createImageBitmap(image);
    const found = await call(worker(0), { kind: "detect", bitmap }, undefined, [
      bitmap,
    ]);
    const strips = found.strips ?? [];
    const boxes = found.boxes ?? 0;

    // 3. Read the strips, in parallel when there are enough of them
    progress(0.5, PHOTO_STATUS.read);
    const parts = share(strips, strips.length > 2 ? n : 1);
    const total = strips.length * recs.length;
    const doneBy = new Array<number>(parts.length).fill(0);
    const results = await Promise.all(
      parts.map((part, i) =>
        call(
          worker(i),
          { kind: "read", recs, strips: part },
          (m) => {
            if (m.kind !== "batch") return;
            doneBy[i] = m.n;
            const done = doneBy.reduce((a, b) => a + b, 0);
            progress(
              0.5 + (0.5 * done) / Math.max(1, total),
              PHOTO_STATUS.read,
            );
          },
          part.map((s) => s.px.buffer),
        ),
      ),
    );

    // 4. Best read per box (models, or both ways round for boxes that looked upside down)
    const best: (Read & { quad: Quad })[] = new Array(boxes);
    const score = (r: Read) => r.conf + Math.min(5, r.text.trim().length);
    parts.forEach((part, i) => {
      for (const reads of results[i]!.reads ?? [])
        reads.forEach((r, k) => {
          const st = part[k]!;
          const cur = best[st.box];
          if (r.text.trim() && (!cur || score(r) > score(cur)))
            best[st.box] = { ...r, quad: st.quad };
        });
    });
    // PaddleOCR drops reads under 0.5 mean probability
    const kept = best.filter((b) => b && b.conf >= 50);
    const { lines, text } = layout(segments(kept), image.width, image.height);
    progress(1, PHOTO_STATUS.read);
    return {
      engine: "photo",
      langs: used,
      text,
      lines,
      confidence: lines.length
        ? Math.round(lines.reduce((s, l) => s + l.confidence, 0) / lines.length)
        : 0,
      width: image.width,
      height: image.height,
      ms: Math.round(performance.now() - t0),
    };
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}
