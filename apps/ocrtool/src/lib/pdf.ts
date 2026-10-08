import type { PDFDocumentProxy } from "pdfjs-dist";

/**
 * Reading PDFs for the OCR tools with pdf.js (Apache-2.0): open, text layer, and pages drawn as
 * pictures for OCR. Loaded only when a PDF is opened; its worker, fonts and CMaps are served from
 * this site (copied into public/pdfjs by astro.config.mjs).
 */

let lib: Promise<typeof import("pdfjs-dist")> | null = null;
export function pdfjs() {
  lib ??= (async () => {
    const m = await import("pdfjs-dist");
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
      .default;
    m.GlobalWorkerOptions.workerSrc = worker;
    return m;
  })();
  return lib;
}

export class PasswordError extends Error {
  constructor() {
    super("password");
  }
}
/** A PDF without a single page. */
export class EmptyPdfError extends Error {
  constructor() {
    super("empty");
  }
}

export const isPdf = (f: File) =>
  f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/** Open a PDF. Throws PasswordError for protected files, EmptyPdfError for no pages. */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const m = await pdfjs();
  let doc: PDFDocumentProxy;
  try {
    doc = await m.getDocument({
      // pdf.js takes ownership of the buffer, so give it a copy
      data: bytes.slice(),
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      wasmUrl: "/pdfjs/wasm/",
      iccUrl: "/pdfjs/iccs/",
    }).promise;
  } catch (err) {
    if ((err as { name?: string }).name === "PasswordException")
      throw new PasswordError();
    throw err;
  }
  if (doc.numPages < 1) {
    void doc.loadingTask.destroy();
    throw new EmptyPdfError();
  }
  return doc;
}

/** OCR resolution. 300 dpi is what OCR engines are tuned for. */
export const OCR_DPI = 300;
/** Longest side of a page drawn for OCR, so posters and huge pages stay within memory */
const MAX_SIDE = 4600;

/**
 * Draw page `n` (1-based) to a canvas at `dpi`, after the page's own rotation, on white. Uses the
 * print intent, which doesn't wait for animation frames, so it keeps going in background tabs.
 */
export async function renderPage(
  doc: PDFDocumentProxy,
  n: number,
  dpi: number,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(
    dpi / 72,
    MAX_SIDE / Math.max(base.width, base.height),
  );
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport, intent: "print" })
    .promise;
  page.cleanup();
  return canvas;
}

/** Small picture of a page for the page rail, as an object URL. */
export async function thumbnail(
  doc: PDFDocumentProxy,
  n: number,
  width = 220,
): Promise<{ url: string; w: number; h: number }> {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const canvas = await renderPage(doc, n, (width / base.width) * 72);
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/png"),
  );
  return { url: URL.createObjectURL(blob), w: base.width, h: base.height };
}

/** Plain text of page `n` from its text layer, with line breaks where the text moves down. */
export async function pageText(
  doc: PDFDocumentProxy,
  n: number,
): Promise<string> {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();
  let out = "";
  let lastY: number | null = null;
  let lastEnd: number | null = null;
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const y = item.transform[5] as number;
    const x = item.transform[4] as number;
    const h = Math.abs((item.transform[3] as number) || item.height || 10);
    if (lastY !== null && Math.abs(y - lastY) > Math.max(2, h * 0.5)) {
      // A bigger jump than a line means a new paragraph
      out =
        out.replace(/\n+$/, "") +
        (Math.abs(y - lastY) > h * 2.2 ? "\n\n" : "\n");
    } else if (
      lastEnd !== null &&
      out &&
      !/\s$/.test(out) &&
      item.str &&
      !/^\s/.test(item.str) &&
      x - lastEnd > h * 0.15
    )
      // Same line with a visible gap: the words are separate items
      out += " ";
    out += item.str;
    if (item.hasEOL) out += "\n";
    lastY = y;
    lastEnd = x + (item.width || 0);
  }
  page.cleanup();
  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Letters and digits in `text` (any script) */
const alnum = (s: string) => s.match(/[\p{L}\p{N}]/gu)?.length ?? 0;

/**
 * Is this text layer real text? Some PDFs carry garbage (fonts without a Unicode map give
 * symbols, private-use characters or replacement marks) or only a stray line (a scanner's stamp).
 *   "text"  enough readable text: use it as it is
 *   "short" a little readable text: real only when the page has no pictures
 *   "none"  nothing usable: read the page with OCR
 */
export function judgeText(text: string): "text" | "short" | "none" {
  const chars = text.replace(/\s+/g, "");
  if (!chars) return "none";
  const good = alnum(chars);
  const bad = chars.match(/[�-\p{Cc}\p{Co}]/gu)?.length ?? 0;
  if (good / chars.length < 0.5 || bad / chars.length > 0.05) return "none";
  if (good >= 40) return "text";
  return good >= 3 ? "short" : "none";
}

/** Does page `n` paint any picture? (Scans are pictures; a short text layer on one is a stamp.) */
export async function hasPictures(
  doc: PDFDocumentProxy,
  n: number,
): Promise<boolean> {
  const { OPS } = await pdfjs();
  const page = await doc.getPage(n);
  const ops = await page.getOperatorList();
  page.cleanup();
  const pics = new Set<number>([
    OPS.paintImageXObject,
    OPS.paintInlineImageXObject,
    OPS.paintImageXObjectRepeat,
    OPS.paintImageMaskXObject,
  ]);
  return ops.fnArray.some((f) => pics.has(f));
}

/** The text layer of page `n` when it's real text, else null (the page needs OCR). */
export async function realText(
  doc: PDFDocumentProxy,
  n: number,
): Promise<string | null> {
  const text = await pageText(doc, n);
  const verdict = judgeText(text);
  if (verdict === "text") return text;
  if (verdict === "short" && !(await hasPictures(doc, n))) return text;
  return null;
}

/**
 * Parse "1-3, 5, 8-" into 0-based page indexes (in order, no repeats). Empty means every page.
 * Returns null when the text can't be read.
 */
export function parseRange(spec: string, total: number): number[] | null {
  const s = spec.trim();
  if (!s) return Array.from({ length: total }, (_, i) => i);
  const out = new Set<number>();
  for (const part of s.split(/[,;]+/)) {
    const p = part.trim();
    if (!p) continue;
    const m = /^(\d*)\s*[-–]\s*(\d*)$/.exec(p) ?? /^(\d+)$/.exec(p);
    if (!m) return null;
    const a = m[1] ? +m[1] : 1;
    const b = m[2] !== undefined ? (m[2] ? +m[2] : total) : a;
    if (a < 1 || b < a) return null;
    for (let i = a; i <= Math.min(b, total); i++) out.add(i - 1);
  }
  return [...out].sort((x, y) => x - y);
}

/**
 * Every page (or `pages`, 0-based) of a PDF as a picture for OCR, one at a time, with the page's
 * text layer when it has real text (then OCR isn't needed). For batch OCR.
 */
export async function* renderPdfPages(
  file: Blob,
  { dpi = OCR_DPI, pages }: { dpi?: number; pages?: number[] } = {},
): AsyncGenerator<{ index: number; bitmap: ImageBitmap; text?: string }> {
  const doc = await openPdf(new Uint8Array(await file.arrayBuffer()));
  try {
    const list = pages ?? Array.from({ length: doc.numPages }, (_, i) => i);
    for (const index of list) {
      if (index < 0 || index >= doc.numPages) continue;
      const text = await realText(doc, index + 1);
      const canvas = await renderPage(doc, index + 1, dpi);
      const bitmap = await createImageBitmap(canvas);
      canvas.width = canvas.height = 0;
      yield text === null ? { index, bitmap } : { index, bitmap, text };
    }
  } finally {
    void doc.loadingTask.destroy();
  }
}
