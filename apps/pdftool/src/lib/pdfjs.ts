import type { PDFDocumentProxy } from "pdfjs-dist";

/**
 * pdf.js (Apache-2.0) for reading and drawing pages. Loaded only when a PDF is opened; its worker,
 * fonts and CMaps are served from this site.
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

/** Open a PDF for drawing. Throws PasswordError for protected files. */
export async function openPdf(
  bytes: Uint8Array,
  password?: string,
): Promise<PDFDocumentProxy> {
  const m = await pdfjs();
  try {
    return await m.getDocument({
      // pdf.js takes ownership of the buffer, so give it a copy
      data: bytes.slice(),
      password,
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
}

/**
 * Draw page `n` (1-based) to a canvas. `scale` 1 = 72 dpi. `extra` rotation is added to the page's
 * own rotation. White background, like paper.
 */
export async function renderPage(
  doc: PDFDocumentProxy,
  n: number,
  scale: number,
  extra = 0,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({
    scale,
    rotation: (((page.rotate + extra) % 360) + 360) % 360,
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // "print" renders without requestAnimationFrame, so exports keep going when the tab is in the
  // background (and it includes form-field appearances, as a printout would)
  await page.render({ canvas, canvasContext: ctx, viewport, intent: "print" })
    .promise;
  page.cleanup();
  return canvas;
}

/** Page size in points (1/72 in), as displayed (after the page's own rotation). */
export async function pageSize(doc: PDFDocumentProxy, n: number) {
  const page = await doc.getPage(n);
  const v = page.getViewport({ scale: 1 });
  return { w: v.width, h: v.height, rotate: page.rotate };
}

/** Plain text of every page, keeping line breaks where the text moves down the page. */
export async function pageText(
  doc: PDFDocumentProxy,
  n: number,
): Promise<string> {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();
  let out = "";
  let lastY: number | null = null;
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const y = item.transform[5] as number;
    if (lastY !== null && Math.abs(y - lastY) > 2) out += "\n";
    else if (out && !out.endsWith(" ") && item.str && !item.str.startsWith(" "))
      out += item.hasEOL ? "\n" : "";
    out += item.str;
    if (item.hasEOL) out += "\n";
    lastY = y;
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
