/**
 * Generated inputs for the OCRTool PDF tests (called from make.ts). Pages of English text are
 * drawn on a canvas in Chromium (like a 300 dpi scan) and wrapped into PDFs with pdf-lib:
 *
 *   ocr-scanned.pdf  2 A4 pages that are only pictures of text (SCAN_PAGES), no text layer
 *   ocr-text.pdf     2 A4 pages with a real text layer (TEXT_PAGES), plus a white line
 *                    (HIDDEN) that OCR can't see: finding it proves the text layer was used
 *   ocr-mixed.pdf    text page, scanned page, text page (TEXT_PAGES[0], SCAN_PAGES[0], TEXT_PAGES[1])
 *   ocr-scan-1.png, ocr-scan-2.png   the scanned pages as images (for images → searchable PDF)
 */
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = join(import.meta.dirname, "..", "..");
const req = createRequire(join(ROOT, "apps", "ocrtool", "package.json"));

export const SCAN_PAGES = [
  [
    "The quick brown fox jumps over the lazy dog.",
    "Pack my box with five dozen liquor jugs.",
    "Invoice number 4821 was paid on March 12.",
    "Searchable documents save everyone time.",
    "Please keep this letter for your records.",
  ],
  [
    "Bright morning light filled the quiet library.",
    "Seven students studied history and science.",
    "The garden needs water every second evening.",
    "Please return the borrowed books by Friday.",
    "Thank you for visiting our reading room.",
  ],
];

export const TEXT_PAGES = [
  [
    "Alpha report: quarterly numbers look healthy.",
    "Revenue rose by 12 percent in the north.",
  ],
  [
    "Beta summary: the team shipped three releases.",
    "Support tickets fell to a record low.",
  ],
];
/** Drawn in white on each text page: invisible to OCR, present in the text layer */
export const HIDDEN = ["Hidden marker kiwi-7731", "Hidden marker mango-4402"];

/** Words of a text, lower-cased, without punctuation */
export const wordsOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Share of the expected words found in `got` (each counted as often as it appears) */
export function recall(expected: string, got: string) {
  const want = wordsOf(expected);
  const have = new Map<string, number>();
  for (const w of wordsOf(got)) have.set(w, (have.get(w) ?? 0) + 1);
  let hit = 0;
  for (const w of want) {
    const n = have.get(w) ?? 0;
    if (n > 0) {
      hit++;
      have.set(w, n - 1);
    }
  }
  return want.length ? hit / want.length : 1;
}

/** A4 at 300 dpi */
const W = 2480;
const H = 3508;

export async function makeOcrPdfFixtures(dir: string) {
  const { PDFDocument, StandardFonts, rgb } = req(
    "pdf-lib",
  ) as typeof import("pdf-lib");

  // Scanned pages: drawn in Chromium, black text on a slightly off-white page
  const browser = await chromium.launch();
  let scans: Buffer[];
  try {
    const page = await browser.newPage();
    scans = [];
    for (const lines of SCAN_PAGES) {
      const dataUrl = await page.evaluate(
        ({ lines, W, H }) => {
          const c = document.createElement("canvas");
          c.width = W;
          c.height = H;
          const x = c.getContext("2d")!;
          x.fillStyle = "#fbfaf6";
          x.fillRect(0, 0, W, H);
          x.fillStyle = "#151515";
          x.font = "50px Arial, Helvetica, sans-serif";
          x.textBaseline = "alphabetic";
          lines.forEach((l, i) => x.fillText(l, 240, 420 + i * 110));
          return c.toDataURL("image/png");
        },
        { lines, W, H },
      );
      scans.push(Buffer.from(dataUrl.split(",")[1]!, "base64"));
    }
  } finally {
    await browser.close();
  }
  for (let i = 0; i < scans.length; i++)
    await writeFile(join(dir, `ocr-scan-${i + 1}.png`), scans[i]!);

  const A4: [number, number] = [595.28, 841.89];

  async function addScan(doc: InstanceType<typeof PDFDocument>, n: number) {
    const img = await doc.embedPng(scans[n]!);
    const p = doc.addPage(A4);
    p.drawImage(img, { x: 0, y: 0, width: A4[0], height: A4[1] });
  }
  async function addText(doc: InstanceType<typeof PDFDocument>, n: number) {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const p = doc.addPage(A4);
    TEXT_PAGES[n]!.forEach((l, i) =>
      p.drawText(l, { x: 60, y: 760 - i * 28, size: 14, font }),
    );
    p.drawText(HIDDEN[n]!, {
      x: 60,
      y: 640,
      size: 12,
      font,
      color: rgb(1, 1, 1),
    });
  }

  {
    const doc = await PDFDocument.create();
    await addScan(doc, 0);
    await addScan(doc, 1);
    await writeFile(join(dir, "ocr-scanned.pdf"), await doc.save());
  }
  {
    const doc = await PDFDocument.create();
    await addText(doc, 0);
    await addText(doc, 1);
    await writeFile(join(dir, "ocr-text.pdf"), await doc.save());
  }
  {
    const doc = await PDFDocument.create();
    await addText(doc, 0);
    await addScan(doc, 0);
    await addText(doc, 1);
    await writeFile(join(dir, "ocr-mixed.pdf"), await doc.save());
  }
}
