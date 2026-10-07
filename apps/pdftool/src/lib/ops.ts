import {
  degrees,
  ParseSpeeds,
  PDFDocument,
  PDFName,
  rgb,
  StandardFonts,
  type PDFPage,
} from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPage } from "./pdfjs";

/**
 * Building and changing PDFs with pdf-lib (MIT). Everything happens in memory on this device.
 */

/** One page of the output: a page from an opened file, or a blank page. */
export interface PageRef {
  id: string;
  /** Source file key, or "" for a blank page */
  file: string;
  /** 0-based page index in the source */
  index: number;
  /** Extra clockwise rotation in degrees */
  rotate: number;
  /** Size in points for blank pages */
  blank?: { w: number; h: number };
}

export class LockedError extends Error {
  constructor() {
    super("locked");
  }
}

const loaded = new Map<string, Promise<PDFDocument>>();
/** pdf-lib documents per source file, loaded once */
export function source(key: string, bytes: Uint8Array): Promise<PDFDocument> {
  let d = loaded.get(key);
  if (!d) {
    // Parse in one go: pdf-lib otherwise yields to timers, which background tabs slow to a crawl
    d = PDFDocument.load(bytes, {
      updateMetadata: false,
      parseSpeed: ParseSpeeds.Fastest,
    }).catch((err) => {
      loaded.delete(key);
      if (/encrypt/i.test(String(err))) throw new LockedError();
      throw err;
    });
    loaded.set(key, d);
  }
  return d;
}
export function forget(key: string) {
  loaded.delete(key);
}

/** New PDF made of `pages`, in order. */
export async function build(
  pages: readonly PageRef[],
  bytesOf: (key: string) => Uint8Array,
): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  // Copy each file's pages in one go, then place them in order
  const byFile = new Map<string, number[]>();
  for (const p of pages)
    if (p.file) byFile.set(p.file, [...(byFile.get(p.file) ?? []), p.index]);
  const copies = new Map<string, Map<number, PDFPage>>();
  for (const [key, indices] of byFile) {
    const src = await source(key, bytesOf(key));
    const unique = [...new Set(indices)];
    const copied = await out.copyPages(src, unique);
    copies.set(key, new Map(unique.map((i, k) => [i, copied[k]!])));
  }
  const used = new Set<PDFPage>();
  for (const p of pages) {
    if (!p.file) {
      out.addPage([p.blank?.w ?? 595.28, p.blank?.h ?? 841.89]);
      continue;
    }
    let page = copies.get(p.file)!.get(p.index)!;
    // The same page twice needs its own copy
    if (used.has(page)) {
      const src = await source(p.file, bytesOf(p.file));
      page = (await out.copyPages(src, [p.index]))[0]!;
    }
    used.add(page!);
    if (p.rotate)
      page!.setRotation(degrees((page!.getRotation().angle + p.rotate) % 360));
    out.addPage(page!);
  }
  return out;
}

export async function save(doc: PDFDocument): Promise<Blob> {
  const bytes = await doc.save({
    useObjectStreams: true,
    objectsPerTick: Infinity,
  });
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/* ---------- Placing things the way the page is shown ---------- */

/**
 * The page as you see it (after its /Rotate): visual width/height, and a function that turns a
 * visual point (origin bottom-left) into page coordinates. Anything drawn must also be rotated
 * by `rot` degrees to look upright.
 */
export function view(page: PDFPage) {
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

/** Bottom-left corner for an item of size w×h rotated by `angle` (ccw) around its centre (cx, cy). */
function cornerFor(
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
) {
  const t = (angle * Math.PI) / 180;
  return {
    x: cx - ((w / 2) * Math.cos(t) - (h / 2) * Math.sin(t)),
    y: cy - ((w / 2) * Math.sin(t) + (h / 2) * Math.cos(t)),
  };
}

/** Images placed by fractions of the visible page (top-left origin), e.g. signatures and text. */
export interface Stamp {
  page: number;
  /** Fractions of the visible page */
  x: number;
  y: number;
  w: number;
  h: number;
  png: Uint8Array;
}

export async function stamp(doc: PDFDocument, stamps: readonly Stamp[]) {
  const pages = doc.getPages();
  const cache = new Map<
    Uint8Array,
    Awaited<ReturnType<PDFDocument["embedPng"]>>
  >();
  for (const s of stamps) {
    const page = pages[s.page];
    if (!page) continue;
    let img = cache.get(s.png);
    if (!img) {
      img = await doc.embedPng(s.png);
      cache.set(s.png, img);
    }
    const v = view(page);
    const w = s.w * v.vw;
    const h = s.h * v.vh;
    // Visual bottom-left of the stamp, then into page space
    const p = v.map(s.x * v.vw, v.vh - (s.y + s.h) * v.vh);
    page.drawImage(img, {
      x: p.x,
      y: p.y,
      width: w,
      height: h,
      rotate: degrees(v.rot),
    });
  }
}

/* ---------- Page numbers ---------- */

export type Corner = "tl" | "tc" | "tr" | "bl" | "bc" | "br";

export interface NumberOpts {
  pos: Corner;
  format: "n" | "page-n" | "n-of" | "page-n-of";
  start: number;
  size: number;
  /** Distance from the edge in points */
  margin: number;
  skipFirst: boolean;
}

export async function pageNumbers(doc: PDFDocument, o: NumberOpts) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const counted = o.skipFirst ? pages.length - 1 : pages.length;
  pages.forEach((page, i) => {
    if (o.skipFirst && i === 0) return;
    const n = o.start + (o.skipFirst ? i - 1 : i);
    const total = o.start + counted - 1;
    const text =
      o.format === "n"
        ? `${n}`
        : o.format === "page-n"
          ? `Page ${n}`
          : o.format === "n-of"
            ? `${n} / ${total}`
            : `Page ${n} of ${total}`;
    const v = view(page);
    const tw = font.widthOfTextAtSize(text, o.size);
    const th = font.heightAtSize(o.size, { descender: false });
    const col = o.pos[1];
    const cx =
      col === "l"
        ? o.margin + tw / 2
        : col === "r"
          ? v.vw - o.margin - tw / 2
          : v.vw / 2;
    const cy = o.pos[0] === "t" ? v.vh - o.margin - th / 2 : o.margin + th / 2;
    const c = v.map(cx, cy);
    const at = cornerFor(c.x, c.y, tw, th, v.rot);
    page.drawText(text, {
      x: at.x,
      y: at.y,
      size: o.size,
      font,
      color: rgb(0.2, 0.2, 0.2),
      rotate: degrees(v.rot),
    });
  });
}

/* ---------- Watermark ---------- */

export interface WatermarkOpts {
  text: string;
  /** Text height as % of the page's shorter side */
  size: number;
  /** 0..100 */
  opacity: number;
  color: string;
  /** Visual angle in degrees, counter-clockwise */
  angle: number;
  tile: boolean;
}

/** Text drawn to a PNG, so any language and script works (the PDF's built-in fonts can't). */
export async function textPng(
  text: string,
  px: number,
  color: string,
  font = "600 {px}px system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif",
): Promise<{ png: Uint8Array; w: number; h: number }> {
  const f = font.replace("{px}", String(px));
  const c = document.createElement("canvas");
  const x = c.getContext("2d")!;
  x.font = f;
  const lines = text.split("\n");
  const w =
    Math.ceil(Math.max(...lines.map((l) => x.measureText(l).width))) + 4;
  const lh = Math.ceil(px * 1.25);
  c.width = Math.max(1, w);
  c.height = Math.max(1, lh * lines.length);
  x.font = f;
  x.fillStyle = color;
  x.textBaseline = "middle";
  lines.forEach((l, i) => x.fillText(l, 2, lh * i + lh / 2));
  const blob = await new Promise<Blob>((r) =>
    c.toBlob((b) => r(b!), "image/png"),
  );
  return {
    png: new Uint8Array(await blob.arrayBuffer()),
    w: c.width,
    h: c.height,
  };
}

export async function watermark(doc: PDFDocument, o: WatermarkOpts) {
  if (!o.text.trim()) return;
  const art = await textPng(o.text, 160, o.color);
  const img = await doc.embedPng(art.png);
  for (const page of doc.getPages()) {
    const v = view(page);
    const h = (Math.min(v.vw, v.vh) * o.size) / 100;
    const w = (h * art.w) / art.h;
    const spots: [number, number][] = [];
    if (o.tile) {
      const stepX = w * 1.6;
      const stepY = h * 4;
      for (let y = -v.vh; y < v.vh * 2; y += stepY)
        for (let x = -v.vw; x < v.vw * 2; x += stepX) spots.push([x, y]);
    } else spots.push([v.vw / 2, v.vh / 2]);
    for (const [vx, vy] of spots) {
      const c = v.map(vx, vy);
      const angle = o.angle + v.rot;
      const at = cornerFor(c.x, c.y, w, h, angle);
      page.drawImage(img, {
        x: at.x,
        y: at.y,
        width: w,
        height: h,
        rotate: degrees(angle),
        opacity: o.opacity / 100,
      });
    }
  }
}

/* ---------- Metadata ---------- */

export interface Meta {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
}

export function readMeta(doc: PDFDocument): Meta {
  return {
    title: doc.getTitle() ?? "",
    author: doc.getAuthor() ?? "",
    subject: doc.getSubject() ?? "",
    keywords: doc.getKeywords() ?? "",
    creator: doc.getCreator() ?? "",
    producer: doc.getProducer() ?? "",
  };
}

export function writeMeta(doc: PDFDocument, m: Meta, strip: boolean) {
  if (strip) {
    // Remove the info dictionary fields and the XMP stream
    const info = doc.context.lookup(doc.context.trailerInfo.Info);
    if (info && "delete" in info)
      for (const k of [
        "Title",
        "Author",
        "Subject",
        "Keywords",
        "Creator",
        "Producer",
        "CreationDate",
        "ModDate",
      ])
        (info as { delete(n: PDFName): void }).delete(PDFName.of(k));
    doc.catalog.delete(PDFName.of("Metadata"));
    return;
  }
  doc.setTitle(m.title);
  doc.setAuthor(m.author);
  doc.setSubject(m.subject);
  doc.setKeywords(m.keywords ? m.keywords.split(/\s*,\s*/) : []);
  doc.setCreator(m.creator);
  doc.setProducer(m.producer);
  doc.setModificationDate(new Date());
}

/* ---------- Images to PDF ---------- */

export const PAPER: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
};

export interface ImageOpts {
  /** "fit" = each page the size of its image */
  paper: "a4" | "letter" | "legal" | "fit";
  orientation: "auto" | "portrait" | "landscape";
  /** Points */
  margin: number;
}

/** Images (JPEG or PNG bytes) as pages. Other formats should be converted to PNG/JPEG first. */
export async function imagesToPdf(
  images: readonly {
    bytes: Uint8Array;
    type: "jpg" | "png";
    w: number;
    h: number;
  }[],
  o: ImageOpts,
): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  for (const im of images) {
    const img =
      im.type === "jpg"
        ? await doc.embedJpg(im.bytes)
        : await doc.embedPng(im.bytes);
    let pw: number;
    let ph: number;
    if (o.paper === "fit") {
      // 1 image pixel = 0.75 pt (96 dpi), so photos come out a sensible size
      pw = im.w * 0.75 + o.margin * 2;
      ph = im.h * 0.75 + o.margin * 2;
    } else {
      [pw, ph] = PAPER[o.paper]!;
      const landscape =
        o.orientation === "landscape" ||
        (o.orientation === "auto" && im.w > im.h);
      if (landscape) [pw, ph] = [ph, pw];
    }
    const page = doc.addPage([pw, ph]);
    const bw = pw - o.margin * 2;
    const bh = ph - o.margin * 2;
    const s = Math.min(bw / im.w, bh / im.h);
    const w = im.w * s;
    const h = im.h * s;
    page.drawImage(img, {
      x: (pw - w) / 2,
      y: (ph - h) / 2,
      width: w,
      height: h,
    });
  }
  return doc;
}

/* ---------- Rasterize (compress, grayscale) ---------- */

export interface RasterOpts {
  dpi: number;
  /** JPEG quality 0..1 */
  quality: number;
  gray: boolean;
  onPage?: (done: number, total: number) => void;
}

/**
 * Redraw every page as a JPEG at `dpi`. Shrinks scans and image-heavy PDFs a lot; text becomes
 * part of the picture (it can't be selected or searched afterwards).
 */
export async function rasterize(
  src: PDFDocumentProxy,
  o: RasterOpts,
  pageList?: readonly { index: number; rotate: number }[],
): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const list =
    pageList ??
    Array.from({ length: src.numPages }, (_, i) => ({ index: i, rotate: 0 }));
  for (let k = 0; k < list.length; k++) {
    const { index, rotate } = list[k]!;
    const canvas = await renderPage(src, index + 1, o.dpi / 72, rotate);
    if (o.gray) {
      const x = canvas.getContext("2d")!;
      const img = x.getImageData(0, 0, canvas.width, canvas.height);
      const p = img.data;
      for (let i = 0; i < p.length; i += 4) {
        const l = 0.299 * p[i]! + 0.587 * p[i + 1]! + 0.114 * p[i + 2]!;
        p[i] = p[i + 1] = p[i + 2] = l;
      }
      x.putImageData(img, 0, 0);
    }
    const blob = await new Promise<Blob>((r) =>
      canvas.toBlob((b) => r(b!), "image/jpeg", o.quality),
    );
    const jpg = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const pw = (canvas.width * 72) / o.dpi;
    const ph = (canvas.height * 72) / o.dpi;
    const page = doc.addPage([pw, ph]);
    page.drawImage(jpg, { x: 0, y: 0, width: pw, height: ph });
    canvas.width = canvas.height = 0;
    o.onPage?.(k + 1, list.length);
  }
  return doc;
}

/**
 * Like `rasterize`, but each page is drawn once and saved at several JPEG qualities, giving one
 * document per quality. Used to find the best quality under a size limit without re-rendering.
 */
export async function rasterizeEach(
  src: PDFDocumentProxy,
  dpi: number,
  qualities: readonly number[],
  pageList: readonly { index: number; rotate: number }[],
  onPage?: (done: number, total: number) => void,
): Promise<PDFDocument[]> {
  const docs = await Promise.all(qualities.map(() => PDFDocument.create()));
  for (let k = 0; k < pageList.length; k++) {
    const { index, rotate } = pageList[k]!;
    const canvas = await renderPage(src, index + 1, dpi / 72, rotate);
    const pw = (canvas.width * 72) / dpi;
    const ph = (canvas.height * 72) / dpi;
    for (let i = 0; i < qualities.length; i++) {
      const blob = await new Promise<Blob>((r) =>
        canvas.toBlob((b) => r(b!), "image/jpeg", qualities[i]),
      );
      const doc = docs[i]!;
      const jpg = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      doc
        .addPage([pw, ph])
        .drawImage(jpg, { x: 0, y: 0, width: pw, height: ph });
    }
    canvas.width = canvas.height = 0;
    onPage?.(k + 1, pageList.length);
  }
  return docs;
}
