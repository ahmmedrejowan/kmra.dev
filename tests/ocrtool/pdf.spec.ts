/**
 * OCRTool PDF tools: PDF to text (text layer copied exactly, scanned pages read with OCR, the
 * "read every page" preset) and Searchable PDF (the output's invisible text layer is read back in
 * Node with pdf.js and pdf-lib). Runs the real OCR engine, so the tests are slow.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Page } from "@playwright/test";
import {
  addFiles,
  bytes,
  download,
  expect,
  gen,
  openTool,
  test,
} from "../helpers.ts";
import {
  HIDDEN,
  recall,
  SCAN_PAGES,
  TEXT_PAGES,
} from "../fixtures/ocrtool-pdf.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const req = createRequire(join(ROOT, "apps", "ocrtool", "package.json"));
const PDFLib = req("pdf-lib") as typeof import("pdf-lib");

const SCANNED = gen("ocr-scanned.pdf");
const TEXT = gen("ocr-text.pdf");
const MIXED = gen("ocr-mixed.pdf");
const PASSWORD = join(
  ROOT,
  "tests",
  "fixtures",
  "static",
  "password-protected.pdf",
);
const SCAN_TEXT = SCAN_PAGES.map((p) => p.join("\n"));

test.describe.configure({ timeout: 240_000 });

type PdfJs = typeof import("pdfjs-dist");
let pdfjs: Promise<PdfJs> | null = null;
const getPdfJs = () =>
  (pdfjs ??= import(
    pathToFileURL(req.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href
  ) as Promise<PdfJs>);

/** Text of each page as pdf.js reads it (items in order, line ends kept) */
async function pdfTexts(b: Uint8Array): Promise<string[]> {
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
        .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : ""))
        .join(""),
    );
  }
  await task.destroy();
  return out;
}

async function sizes(b: Uint8Array) {
  const doc = await PDFLib.PDFDocument.load(b, { updateMetadata: false });
  return doc.getPages().map((p) => {
    const { width, height } = p.getSize();
    return [Math.round(width), Math.round(height)];
  });
}

const badges = (page: Page) => page.locator(".tool-area .op-rail .op-badge");

/** Wait until no page is waiting or being read */
async function settled(page: Page, n: number) {
  await expect(badges(page)).toHaveCount(n);
  await expect(page.locator(".tool-area .op-run")).toHaveCount(0, {
    timeout: 200_000,
  });
  await expect(
    badges(page).filter({ hasText: /Checking|Waiting|%/ }),
  ).toHaveCount(0, { timeout: 200_000 });
}

async function downloadText(page: Page) {
  const d = await download(page, () =>
    page
      .locator(".tool-area")
      .getByRole("button", { name: "Download .txt" })
      .click(),
  );
  return {
    name: d.suggestedFilename(),
    text: (await bytes(d)).toString("utf8"),
  };
}

test("PDF to text copies text-layer pages exactly, without OCR", async ({
  page,
}) => {
  await openTool(page, "/pdf-to-text");
  await addFiles(page, TEXT);
  await settled(page, 2);
  await expect(badges(page)).toHaveText(["Text layer", "Text layer"]);
  // The white line can't be seen by OCR: it's there only because the text layer was used
  await expect(page.locator(".op-text")).toHaveValue(
    `${TEXT_PAGES[0]!.join("\n")}\n\n${HIDDEN[0]}`,
  );
  const { name, text } = await downloadText(page);
  expect(name).toBe("ocr-text-pdf-to-text-kmra.txt");
  expect(text).toBe(
    `--- Page 1 ---\n${TEXT_PAGES[0]!.join("\n")}\n\n${HIDDEN[0]}\n\n` +
      `--- Page 2 ---\n${TEXT_PAGES[1]!.join("\n")}\n\n${HIDDEN[1]}\n`,
  );
  // Without separators
  await page.getByLabel("Page separators").uncheck();
  const plain = await downloadText(page);
  expect(plain.text).not.toContain("--- Page");
  expect(plain.text).toContain(HIDDEN[1]);
});

test("PDF to text reads scanned pages with OCR", async ({ page }) => {
  await openTool(page, "/pdf-to-text");
  await addFiles(page, SCANNED);
  await settled(page, 2);
  await expect(badges(page)).toHaveText(["OCR", "OCR"]);
  const { text } = await downloadText(page);
  const parts = text.split(/--- Page \d ---\n/).slice(1);
  expect(parts).toHaveLength(2);
  for (let i = 0; i < 2; i++)
    expect(recall(SCAN_TEXT[i]!, parts[i]!)).toBeGreaterThanOrEqual(0.9);
  // Markdown has a heading per page
  const md = await download(page, () =>
    page.locator(".tool-area").getByRole("button", { name: ".md" }).click(),
  );
  expect(md.suggestedFilename()).toBe("ocr-scanned-pdf-to-text-kmra.md");
  const mdText = (await bytes(md)).toString("utf8");
  expect(mdText).toContain("## Page 1");
  expect(mdText).toContain("## Page 2");
});

test("PDF to text mixes text-layer and OCR pages, and keeps a page range", async ({
  page,
}) => {
  await openTool(page, "/pdf-to-text");
  await addFiles(page, MIXED);
  await settled(page, 3);
  await expect(badges(page)).toHaveText(["Text layer", "OCR", "Text layer"]);
  const { text } = await downloadText(page);
  const parts = text.split(/--- Page \d ---\n/).slice(1);
  expect(parts[0]).toContain(HIDDEN[0]);
  expect(recall(SCAN_TEXT[0]!, parts[1]!)).toBeGreaterThanOrEqual(0.9);
  expect(parts[1]).not.toContain("kiwi");
  expect(parts[2]).toContain(HIDDEN[1]);

  await page.getByLabel("Page range, e.g. 1-3, 5").fill("2-3");
  const ranged = await downloadText(page);
  expect(ranged.text).not.toContain("--- Page 1 ---");
  expect(ranged.text).toContain("--- Page 3 ---");
});

test("Scanned PDF to text reads every page with OCR, text layer or not", async ({
  page,
}) => {
  await openTool(page, "/scanned-pdf-to-text");
  await addFiles(page, TEXT);
  await settled(page, 2);
  await expect(badges(page)).toHaveText(["OCR", "OCR"]);
  const { text } = await downloadText(page);
  // OCR can't see the white line
  expect(text).not.toContain("kiwi-7731");
  expect(recall(TEXT_PAGES.flat().join(" "), text)).toBeGreaterThanOrEqual(0.9);
});

async function searchable(page: Page, files: string | string[], pages: number) {
  await openTool(page, "/searchable-pdf");
  await addFiles(page, files);
  await settled(page, pages);
  const btn = page
    .locator(".tool-area")
    .getByRole("button", { name: "Download searchable PDF" });
  await expect(btn).toBeEnabled({ timeout: 60_000 });
  await expect(page.locator(".op-found")).toContainText(
    /Text found: \d+ words/,
  );
  const d = await download(page, () => btn.click());
  return { name: d.suggestedFilename(), bytes: new Uint8Array(await bytes(d)) };
}

/** Each line's first word comes after the previous line's in the text */
function inOrder(text: string, lines: string[]) {
  const low = text.toLowerCase();
  let at = -1;
  for (const l of lines) {
    const w = l.split(" ")[0]!.toLowerCase();
    const i = low.indexOf(w, at + 1);
    if (i <= at) return false;
    at = i;
  }
  return true;
}

test("Searchable PDF adds an invisible text layer that pdf.js reads in order", async ({
  page,
}) => {
  const out = await searchable(page, SCANNED, 2);
  expect(out.name).toBe("ocr-scanned-searchable-pdf-kmra.pdf");
  expect(await sizes(out.bytes)).toEqual(await sizes(readFileSync(SCANNED)));
  const texts = await pdfTexts(out.bytes);
  expect(texts).toHaveLength(2);
  for (let i = 0; i < 2; i++) {
    expect(recall(SCAN_TEXT[i]!, texts[i]!)).toBeGreaterThanOrEqual(0.9);
    expect(inOrder(texts[i]!, SCAN_PAGES[i]!)).toBe(true);
    // Lines stay lines, words keep their spaces
    expect(
      texts[i]!.split("\n").filter((l) => l.trim()).length,
    ).toBeGreaterThanOrEqual(SCAN_PAGES[i]!.length);
  }
  expect(texts[0]).toMatch(/quick brown fox/i);
});

test("Searchable PDF keeps text-layer pages as they are", async ({ page }) => {
  const out = await searchable(page, MIXED, 3);
  expect(await sizes(out.bytes)).toEqual(await sizes(readFileSync(MIXED)));
  const texts = await pdfTexts(out.bytes);
  // The text pages are untouched: their text appears once, with the hidden line
  expect(texts[0]).toContain(HIDDEN[0]);
  expect(texts[0]!.match(/Alpha report/g)).toHaveLength(1);
  expect(recall(SCAN_TEXT[0]!, texts[1]!)).toBeGreaterThanOrEqual(0.9);
  expect(texts[2]).toContain(HIDDEN[1]);
});

test("Searchable PDF from images: one page per image", async ({ page }) => {
  const out = await searchable(
    page,
    [gen("ocr-scan-1.png"), gen("ocr-scan-2.png")],
    2,
  );
  expect(out.name).toBe("ocr-scan-1-searchable-pdf-kmra.pdf");
  // 2480 × 3508 px at 300 dpi = A4
  expect(await sizes(out.bytes)).toEqual([
    [595, 842],
    [595, 842],
  ]);
  const texts = await pdfTexts(out.bytes);
  expect(recall(SCAN_TEXT[1]!, texts[1]!)).toBeGreaterThanOrEqual(0.9);
});

for (const path of ["/pdf-to-text", "/searchable-pdf"])
  test(`${path} explains password-protected PDFs`, async ({ page }) => {
    await openTool(page, path);
    await addFiles(page, PASSWORD);
    await expect(page.locator(".tool-area .op-problem")).toContainText(
      "This PDF is password-protected. Remove the password in the app that made it, then try again.",
    );
  });
