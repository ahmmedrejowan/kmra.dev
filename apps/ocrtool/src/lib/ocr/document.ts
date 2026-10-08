import type Tess from "tesseract.js";
import type { Line, OcrResult, RecognizeOptions, Word } from "./types";

/**
 * The document engine: Tesseract 5 (tesseract.js, Apache-2.0), LSTM models only. tesseract.js runs
 * Tesseract in its own Web Worker; one worker is kept and reused, and jobs run one at a time.
 *
 * Everything is served from this site (copied into public/tesseract by astro.config.mjs):
 *   /tesseract/ocr-worker.js          the worker (tesseract.js's worker.min.js, quieter console)
 *   /tesseract/core/…-lstm.wasm.js    the wasm core (plain, SIMD or relaxed SIMD, picked per browser)
 *   /tesseract/lang/<code>.traineddata.gz   language data ("best_int" models)
 * Language data is kept in IndexedDB after the first download (tesseract.js's own cache), so it
 * works offline from then on.
 */

const BASE = "/tesseract";

type Progress = NonNullable<RecognizeOptions["onProgress"]>;

let workerP: Promise<Tess.Worker> | null = null;
/** Languages the current worker was set up with, "chi_sim+eng" */
let workerLangs = "";
/** The running job's progress callback (tesseract.js has one logger per worker) */
let report: ((status: string, p: number) => void) | null = null;
/** Jobs run one after another */
let queue: Promise<unknown> = Promise.resolve();

/** Languages already downloaded and kept in this browser */
export async function cachedLangs(): Promise<Set<string>> {
  try {
    const { keys } = await import("idb-keyval");
    const all = await keys();
    return new Set(
      all
        .map(String)
        // tesseract.js's cache keys: cachePath "." + "/<code>.traineddata"
        .filter((k) => k.startsWith("./") && k.endsWith(".traineddata"))
        .map((k) => k.slice(2, -".traineddata".length)),
    );
  } catch {
    return new Set();
  }
}

/** Which of `langs` still need downloading */
export async function missingLangs(langs: readonly string[]) {
  const have = await cachedLangs();
  return langs.filter((l) => !have.has(l));
}

const abortError = () => new DOMException("Aborted", "AbortError");

/** `p`, or an AbortError as soon as `signal` aborts (a terminated worker never answers) */
function guard<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(abortError());
    signal.addEventListener("abort", stop, { once: true });
    p.then(resolve, reject).finally(() =>
      signal.removeEventListener("abort", stop),
    );
  });
}

/** Download one language's data with byte progress */
async function download(
  code: string,
  signal: AbortSignal | undefined,
  onBytes: (got: number, total: number) => void,
): Promise<Uint8Array> {
  const res = await fetch(`${BASE}/lang/${code}.traineddata.gz`, { signal });
  if (!res.ok) throw new Error(`Language data for ${code}: HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onBytes(got, total);
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** `langs`: codes joined with "+", e.g. "chi_sim+eng" */
async function newWorker(langs: string): Promise<Tess.Worker> {
  const { createWorker, OEM } = await import("tesseract.js");
  const w = await createWorker(langs, OEM.LSTM_ONLY, {
    workerPath: `${BASE}/ocr-worker.js`,
    corePath: `${BASE}/core`,
    langPath: `${BASE}/lang`,
    // Load the worker script from this site directly (no blob: wrapper)
    workerBlobURL: false,
    gzip: true,
    cacheMethod: "write",
    logger: (m) => report?.(m.status, m.progress),
    errorHandler: () => {},
  });
  await params(w);
  return w;
}

function params(w: Tess.Worker) {
  return w.setParameters({
    // Automatic page segmentation (columns, blocks), no orientation detection
    tessedit_pageseg_mode: "3" as Tess.PSM,
    // Keep runs of spaces (tables, aligned columns)
    preserve_interword_spaces: "1",
    // Images carry no reliable dpi; 300 is what the models expect and avoids a warning
    user_defined_dpi: "300",
  });
}

/** Stop the current job and drop the worker (a new one starts on the next job) */
export function resetDocumentEngine() {
  const w = workerP;
  workerP = null;
  workerLangs = "";
  void w?.then((x) => x.terminate()).catch(() => {});
}

/**
 * Scale for reading: Tesseract wants text about 20–40 px tall. Small images (screenshots, crops)
 * are enlarged up to 3×; big ones are read as they are.
 */
function readScale(w: number, h: number) {
  const side = Math.max(w, h);
  if (side >= 1800) return 1;
  return Math.min(3, 1800 / side);
}

async function encode(image: ImageBitmap, k: number): Promise<Blob> {
  const w = Math.round(image.width * k);
  const h = Math.round(image.height * k);
  const c = new OffscreenCanvas(w, h);
  const x = c.getContext("2d")!;
  // Transparent pixels would read as black: put the picture on white
  x.fillStyle = "#fff";
  x.fillRect(0, 0, w, h);
  x.imageSmoothingQuality = "high";
  x.drawImage(image, 0, 0, w, h);
  return c.convertToBlob({ type: "image/png" });
}

const box = (b: Tess.Bbox, k: number) => ({
  x: Math.round(b.x0 / k),
  y: Math.round(b.y0 / k),
  w: Math.round((b.x1 - b.x0) / k),
  h: Math.round((b.y1 - b.y0) / k),
});

/** Tesseract's blocks → the shared result shape */
function toResult(
  page: Tess.Page,
  k: number,
  image: ImageBitmap,
  langs: string[],
  ms: number,
): OcrResult {
  const lines: Line[] = [];
  const paras: string[] = [];
  for (const block of page.blocks ?? [])
    for (const para of block.paragraphs) {
      const texts: string[] = [];
      for (const line of para.lines) {
        const text = line.text.replace(/\s+$/, "");
        if (!text.trim()) continue;
        const words: Word[] = line.words
          .filter((w) => w.text.trim())
          .map((w) => ({
            text: w.text,
            box: box(w.bbox, k),
            confidence: Math.round(w.confidence),
          }));
        lines.push({
          text,
          box: box(line.bbox, k),
          confidence: Math.round(line.confidence),
          words,
        });
        texts.push(text);
      }
      if (texts.length) paras.push(texts.join("\n"));
    }
  const confidence = lines.length
    ? Math.round(lines.reduce((s, l) => s + l.confidence, 0) / lines.length)
    : 0;
  return {
    engine: "document",
    langs,
    text: paras.join("\n\n"),
    lines,
    confidence,
    width: image.width,
    height: image.height,
    ms,
  };
}

/** Status text from tesseract.js's logger → the shared short status */
function stage(status: string): [string, number, number] {
  // [status, start, span] of the overall 0–1 progress
  if (status === "recognizing text") return ["Reading text", 0.15, 0.85];
  if (status.includes("traineddata"))
    return ["Loading language data", 0.05, 0.05];
  return ["Loading engine", 0, 0.05];
}

export function recognizeDocument(
  image: ImageBitmap,
  opts: RecognizeOptions,
): Promise<OcrResult> {
  const job = queue.then(() => run(image, opts));
  queue = job.catch(() => {});
  return job;
}

async function run(
  image: ImageBitmap,
  opts: RecognizeOptions,
): Promise<OcrResult> {
  const { signal } = opts;
  if (signal?.aborted) throw abortError();
  const langs = opts.langs.length ? [...opts.langs] : ["eng"];
  const key = langs.join("+");
  const t0 = performance.now();
  const progress: Progress = (p, s) => opts.onProgress?.(Math.min(1, p), s);

  // 1. Language data not downloaded yet: fetch it here, with byte progress, and put it where
  //    tesseract.js looks first (its IndexedDB cache; it unpacks gzipped data itself). Should
  //    storage fail (private windows), tesseract.js fetches the same file itself.
  const missing = await missingLangs(langs);
  if (missing.length) {
    const totals = new Map<string, [number, number]>();
    const tick = () => {
      let got = 0;
      let total = 0;
      for (const [g, t] of totals.values()) {
        got += g;
        total += t || g;
      }
      progress(total ? (got / total) * 0.9 : 0, "Downloading language data");
    };
    const { set } = await import("idb-keyval");
    await Promise.all(
      missing.map(async (code) => {
        const data = await download(code, signal, (g, t) => {
          totals.set(code, [g, t]);
          tick();
        });
        await set(`./${code}.traineddata`, data).catch(() => {});
      }),
    );
  }
  if (signal?.aborted) throw abortError();

  // 2. The worker, set up for these languages
  let jobStage = "Loading engine";
  report = (status, p) => {
    const [s, start, span] = stage(status);
    jobStage = s;
    progress(start + span * (p || 0), s);
  };
  const onAbort = () => resetDocumentEngine();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    progress(0, "Loading engine");
    if (!workerP) {
      workerP = newWorker(key);
      workerLangs = key;
      workerP.catch(() => {
        workerP = null;
        workerLangs = "";
      });
    }
    const w = await guard(workerP, signal);
    if (signal?.aborted) throw abortError();
    if (workerLangs !== key) {
      const { OEM } = await import("tesseract.js");
      await guard(w.reinitialize(key, OEM.LSTM_ONLY), signal);
      await guard(params(w), signal);
      workerLangs = key;
    }
    if (signal?.aborted) throw abortError();

    // 3. Read
    const k = readScale(image.width, image.height);
    const png = await encode(image, k);
    if (signal?.aborted) throw abortError();
    progress(0.15, "Reading text");
    const { data } = await guard(
      w.recognize(png, {}, { text: true, blocks: true }),
      signal,
    );
    if (signal?.aborted) throw abortError();
    progress(1, "Done");
    return toResult(data, k, image, langs, Math.round(performance.now() - t0));
  } catch (err) {
    if (signal?.aborted) throw abortError();
    // A broken worker (failed wasm load, bad data) shouldn't poison later jobs
    if (jobStage !== "Reading text") resetDocumentEngine();
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    signal?.removeEventListener("abort", onAbort);
    report = null;
  }
}
