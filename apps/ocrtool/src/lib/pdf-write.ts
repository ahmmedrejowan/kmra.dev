import {
  beginText,
  endText,
  ParseSpeeds,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  type PDFPage,
  type PDFRef,
  PDFString,
  setCharacterSqueeze,
  setFontAndSize,
  setTextMatrix,
  setTextRenderingMode,
  showText,
  TextRenderingMode,
} from "pdf-lib";
import type { OcrResult } from "./ocr/types";
import {
  ASCENT,
  DESCENT,
  encodeHex,
  GLYPH_WIDTH,
  glyphlessFont,
  identityToUnicode,
} from "./glyphless";

/**
 * Writing searchable PDFs with pdf-lib (MIT): the original pages are copied untouched and the
 * recognised words are drawn over them as invisible text, each word stretched to its box, so
 * search, selection and copy line up with the picture. Everything happens in memory.
 */

export class LockedError extends Error {
  constructor() {
    super("locked");
  }
}

/** One output page */
export type PageJob =
  /** Page `index` of the source PDF, with OCR to lay over it (null: copy as it is) */
  | { kind: "pdf"; index: number; ocr: OcrResult | null }
  /** The page replaced by a picture of it (to drop an old text layer), plus the new OCR */
  | {
      kind: "raster";
      index: number;
      image: Uint8Array;
      ocr: OcrResult | null;
    }
  /** An image turned into a page */
  | {
      kind: "image";
      image: Uint8Array;
      format: "jpg" | "png";
      /** Page size in points */
      w: number;
      h: number;
      ocr: OcrResult | null;
    };

/** Load a PDF with pdf-lib in one go (pdf-lib otherwise yields to timers, slow in background tabs). */
export async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, {
      updateMetadata: false,
      parseSpeed: ParseSpeeds.Fastest,
    });
  } catch (err) {
    if (/encrypt/i.test(String(err))) throw new LockedError();
    throw err;
  }
}

/** Register the invisible-text font once per document */
function addFont(doc: PDFDocument): PDFRef {
  const ctx = doc.context;
  const file = ctx.flateStream(glyphlessFont());
  const fileRef = ctx.register(file);
  const descriptor = ctx.register(
    ctx.obj({
      Type: "FontDescriptor",
      FontName: "GlyphLessFont",
      Flags: 5,
      FontBBox: [0, DESCENT, GLYPH_WIDTH, ASCENT],
      ItalicAngle: 0,
      Ascent: ASCENT,
      Descent: DESCENT,
      CapHeight: ASCENT,
      StemV: 80,
      FontFile2: fileRef,
    }),
  );
  // Every code (a UTF-16 unit) uses glyph 1
  const map = new Uint8Array(65536 * 2);
  for (let i = 1; i < map.length; i += 2) map[i] = 1;
  const cidToGid = ctx.register(ctx.flateStream(map));
  const cidFont = ctx.register(
    ctx.obj({
      Type: "Font",
      Subtype: "CIDFontType2",
      BaseFont: "GlyphLessFont",
      // Plain strings become names in ctx.obj(); these two must be strings
      CIDSystemInfo: {
        Registry: PDFString.of("Adobe"),
        Ordering: PDFString.of("Identity"),
        Supplement: 0,
      },
      FontDescriptor: descriptor,
      DW: GLYPH_WIDTH,
      CIDToGIDMap: cidToGid,
    }),
  );
  const toUnicode = ctx.register(ctx.flateStream(identityToUnicode()));
  return ctx.register(
    ctx.obj({
      Type: "Font",
      Subtype: "Type0",
      BaseFont: "GlyphLessFont",
      Encoding: "Identity-H",
      DescendantFonts: [cidFont],
      ToUnicode: toUnicode,
    }),
  );
}

const FONT = PDFName.of("FOcrText");

/**
 * The page as you see it (after its /Rotate): visual width/height, and a function that turns a
 * visual point (origin bottom-left) into page coordinates. Text must be turned by `rot` degrees
 * (counter-clockwise in page space) to run left to right on screen.
 */
function view(page: PDFPage) {
  const box = page.getCropBox();
  const R = ((page.getRotation().angle % 360) + 360) % 360;
  const W = box.width;
  const H = box.height;
  const turned = R === 90 || R === 270;
  const vw = turned ? H : W;
  const vh = turned ? W : H;
  const map = (vx: number, vy: number) => {
    let x = vx;
    let y = vy;
    if (R === 90) [x, y] = [W - vy, vx];
    else if (R === 180) [x, y] = [W - vx, H - vy];
    else if (R === 270) [x, y] = [vy, H - vx];
    return { x: x + box.x, y: y + box.y };
  };
  return { vw, vh, map, rot: R };
}

/** Keep the page's own drawing state from leaking into ours: q … original … Q, then our text. */
function isolate(page: PDFPage) {
  const doc = page.doc;
  page.node.normalize();
  const start = doc.context.register(doc.context.stream("q\n", {}));
  const end = doc.context.register(doc.context.stream("\nQ\n", {}));
  page.node.wrapContentStreams(start, end);
}

/** Words the OCR found, in reading order */
export function wordCount(ocr: OcrResult | null): number {
  if (!ocr) return 0;
  return ocr.lines.reduce(
    (n, l) => n + l.words.filter((w) => w.text.trim()).length,
    0,
  );
}

/**
 * Draw the OCR result invisibly on `page`. Boxes are in the OCR image's pixels, which show the
 * whole page as displayed. Each word gets a font size from its line's height and is stretched
 * (Tz) to its box; a space is added after every word but the last of a line, stretched to reach
 * the next word, so copied text keeps its spaces and lines.
 */
export function drawTextLayer(page: PDFPage, ocr: OcrResult) {
  if (!wordCount(ocr)) return;
  const { vw, vh, map, rot } = view(page);
  const sx = vw / ocr.width;
  const sy = vh / ocr.height;
  const t = (rot * Math.PI) / 180;
  const cos = Math.round(Math.cos(t));
  const sin = Math.round(Math.sin(t));
  const unitW = GLYPH_WIDTH / 1000;
  const emH = (ASCENT - DESCENT) / 1000;

  isolate(page);
  const ops = [beginText(), setTextRenderingMode(TextRenderingMode.Invisible)];
  let lastSize = -1;
  const put = (
    text: string,
    x: number,
    width: number,
    baseVy: number,
    size: number,
  ) => {
    const natural = text.length * unitW * size;
    const squeeze = (Math.max(0.5, width) / natural) * 100;
    const at = map(x, baseVy);
    if (size !== lastSize) {
      ops.push(setFontAndSize(FONT, size));
      lastSize = size;
    }
    ops.push(
      setCharacterSqueeze(PDFNumber.of(+squeeze.toFixed(3))),
      setTextMatrix(cos, sin, -sin, cos, at.x, at.y),
      showText(PDFHexString.of(encodeHex(text))),
    );
  };
  for (const line of ocr.lines) {
    const words = line.words.filter((w) => w.text.trim());
    if (!words.length) continue;
    // One size and baseline per line, from the line's box, so selection is even
    const size = Math.max(1, line.box.h * sy) / emH;
    const baseVy =
      vh - (line.box.y + line.box.h) * sy + (-DESCENT / 1000) * size;
    const logical = words.map((w) => w.text.trim()).join(" ");
    if (isRtl(logical)) {
      // Right-to-left: PDF text is in visual order, so the line is written as one run, reversed
      put(visualOrder(logical), line.box.x * sx, line.box.w * sx, baseVy, size);
      continue;
    }
    const ltr = [...words].sort((a, b) => a.box.x - b.box.x);
    ltr.forEach((w, i) => {
      const next = ltr[i + 1];
      // Reach the next word, so the space covers the gap
      const right = next ? next.box.x : w.box.x + w.box.w;
      put(
        w.text.trim() + (next ? " " : ""),
        w.box.x * sx,
        (right - w.box.x) * sx,
        baseVy,
        size,
      );
    });
  }
  ops.push(endText());
  page.pushOperators(...ops);
}

const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
const LTR = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/g;
function isRtl(s: string) {
  return (s.match(RTL)?.length ?? 0) > (s.match(LTR)?.length ?? 0);
}
/** Logical right-to-left text in visual order: words reversed, letters of RTL words reversed */
function visualOrder(s: string) {
  return s
    .split(/(\s+)/)
    .reverse()
    .map((tok) =>
      /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(tok)
        ? [...tok].reverse().join("")
        : tok,
    )
    .join("");
}

/**
 * The searchable PDF. `source` is the original PDF's bytes (null when made from images); pages
 * come out in `jobs` order.
 */
export async function buildSearchable(
  source: Uint8Array | null,
  jobs: PageJob[],
  title?: string,
): Promise<Blob> {
  const out = await PDFDocument.create();
  const src = source ? await loadPdf(source) : null;
  const font = addFont(out);
  const fromSrc = jobs.filter((j) => j.kind === "pdf");
  const copied =
    src && fromSrc.length
      ? await out.copyPages(
          src,
          fromSrc.map((j) => j.index),
        )
      : [];
  let k = 0;
  for (const job of jobs) {
    let page: PDFPage;
    if (job.kind === "pdf") {
      page = copied[k++]!;
      out.addPage(page);
    } else if (job.kind === "raster") {
      // Same visual size as the original page, upright
      const orig = src!.getPage(job.index);
      const { vw, vh } = view(orig);
      const img = await out.embedJpg(job.image);
      page = out.addPage([vw, vh]);
      page.drawImage(img, { x: 0, y: 0, width: vw, height: vh });
    } else {
      const img =
        job.format === "jpg"
          ? await out.embedJpg(job.image)
          : await out.embedPng(job.image);
      page = out.addPage([job.w, job.h]);
      page.drawImage(img, { x: 0, y: 0, width: job.w, height: job.h });
    }
    if (job.ocr && wordCount(job.ocr)) {
      page.node.setFontDictionary(FONT, font);
      drawTextLayer(page, job.ocr);
    }
  }
  if (title) out.setTitle(title);
  if (src) {
    const t = src.getTitle();
    if (t && !title) out.setTitle(t);
    const a = src.getAuthor();
    if (a) out.setAuthor(a);
  }
  out.setProducer("OCRTool (kmra.dev)");
  const bytes = await out.save({
    useObjectStreams: true,
    objectsPerTick: Infinity,
  });
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
