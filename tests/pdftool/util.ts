/**
 * Helpers for the pdftool tests: run a tool, then read the result in Node with the same libraries
 * the app uses (pdf-lib for structure, pdf.js legacy build for text, fflate for zips).
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Page } from "@playwright/test";
import { bytes, download, expect } from "../helpers.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const req = createRequire(join(ROOT, "apps", "pdftool", "package.json"));

export const PDFLib = req("pdf-lib") as typeof import("pdf-lib");
const fflate = req("fflate") as typeof import("fflate");

export const load = (b: Uint8Array) =>
  PDFLib.PDFDocument.load(b, { updateMetadata: false });

export async function pageCount(b: Uint8Array) {
  return (await load(b)).getPageCount();
}

export async function rotations(b: Uint8Array) {
  return (await load(b)).getPages().map((p) => p.getRotation().angle);
}

/** Page sizes as [width, height] in points (before /Rotate) */
export async function sizes(b: Uint8Array) {
  return (await load(b)).getPages().map((p) => {
    const { width, height } = p.getSize();
    return [Math.round(width), Math.round(height)];
  });
}

type PdfJs = typeof import("pdfjs-dist");
let pdfjs: Promise<PdfJs> | null = null;
function getPdfJs(): Promise<PdfJs> {
  pdfjs ??= import(
    pathToFileURL(req.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href
  ) as Promise<PdfJs>;
  return pdfjs;
}

/** Text of every page (pdf.js, as the app reads it) */
export async function pageTexts(b: Uint8Array): Promise<string[]> {
  const { getDocument } = await getPdfJs();
  const task = getDocument({
    data: new Uint8Array(b),
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const doc = await task.promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(
      c.items
        .map((it) => ("str" in it ? it.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  await task.destroy();
  return out;
}

/** Files inside a zip, by name */
export function unzip(b: Uint8Array): Record<string, Uint8Array> {
  return fflate.unzipSync(new Uint8Array(b));
}

/** Image XObjects drawn on each page */
export async function imagesPerPage(b: Uint8Array): Promise<number[]> {
  const doc = await load(b);
  const { PDFName, PDFDict, PDFRawStream } = PDFLib;
  return doc.getPages().map((p) => {
    const res = p.node.Resources();
    const xo = res?.lookupMaybe(PDFName.of("XObject"), PDFDict);
    if (!xo) return 0;
    return xo.keys().filter((k) => {
      const s = xo.lookup(k);
      return (
        s instanceof PDFRawStream &&
        s.dict.get(PDFName.of("Subtype"))?.toString() === "/Image"
      );
    }).length;
  });
}

/** Raw bytes of the first JPEG (DCTDecode) image on a page, if any */
export async function firstJpeg(
  b: Uint8Array,
  pageIndex = 0,
): Promise<Uint8Array | null> {
  const doc = await load(b);
  const { PDFName, PDFDict, PDFRawStream } = PDFLib;
  const res = doc.getPage(pageIndex).node.Resources();
  const xo = res?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  for (const k of xo?.keys() ?? []) {
    const s = xo!.lookup(k);
    if (
      s instanceof PDFRawStream &&
      s.dict.get(PDFName.of("Filter"))?.toString() === "/DCTDecode"
    )
      return s.contents;
  }
  return null;
}

/** The tool's main button (Merge, Split, Compress…) inside the tool area */
export const toolButton = (page: Page, name: string | RegExp) =>
  page.locator(".tool-area").getByRole("button", { name, exact: true });

/**
 * Click the tool's action button, wait for the result, then click Download and return its bytes.
 * `download` is the result button's name ("Download" or "Download N files (zip)").
 */
export async function runAndDownload(
  page: Page,
  action: string | RegExp,
  dl: string | RegExp = "Download",
) {
  const run = toolButton(page, action);
  await expect(run).toBeEnabled();
  await run.click();
  const btn = toolButton(page, dl);
  await expect(btn).toBeVisible({ timeout: 60_000 });
  const d = await download(page, () => btn.click());
  return { name: d.suggestedFilename(), bytes: new Uint8Array(await bytes(d)) };
}

/** Wait until a PDF has been opened by the tool (the result line shows its page count) */
export async function loaded(page: Page, pages: number) {
  await expect(page.locator(".tool-area .result small").first()).toContainText(
    `${pages} page`,
  );
}
