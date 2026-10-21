/**
 * OCRTool file handling: removing a file or one image, a second PDF opened while the first is
 * still being read, files left out when a PDF is dropped with images, and Batch OCR's names
 * (no spaces or brackets, -2 for a repeated name), labels and Retry. Runs the real OCR engine.
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
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
import { HIDDEN, TEXT_PAGES } from "../fixtures/ocrtool-pdf.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const req = createRequire(join(ROOT, "apps", "ocrtool", "package.json"));
const PDFLib = req("pdf-lib") as typeof import("pdf-lib");
const { unzipSync } = req("fflate") as typeof import("fflate");

const SCANNED = gen("ocr-scanned.pdf");
const TEXT = gen("ocr-text.pdf");

test.describe.configure({ timeout: 240_000 });

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

test("PDF to text: a second PDF opened while the first is read replaces it cleanly", async ({
  page,
}) => {
  await openTool(page, "/pdf-to-text");
  await addFiles(page, SCANNED);
  // The scanned PDF is open and being read with OCR
  await expect(badges(page)).toHaveCount(2);
  await addFiles(page, TEXT);
  await settled(page, 2);
  await expect(badges(page)).toHaveText(["Text layer", "Text layer"]);
  await expect(page.locator(".tool-area .op-problem")).toHaveCount(0);
  await expect(page.locator(".toast")).toHaveCount(0);
  await expect(page.locator(".op-text")).toHaveValue(
    `${TEXT_PAGES[0]!.join("\n")}\n\n${HIDDEN[0]}`,
  );
  // Remove goes back to the drop box
  await page
    .locator(".tool-area")
    .getByRole("button", { name: "Remove ocr-text.pdf" })
    .click();
  await expect(page.getByText("Drop a PDF here")).toBeVisible();
});

test("Searchable PDF says which files were left out when a PDF comes with images", async ({
  page,
}) => {
  await openTool(page, "/searchable-pdf");
  await addFiles(page, [TEXT, gen("ocr-scan-1.png"), gen("ocr-scan-2.png")]);
  await expect(page.locator(".toast")).toContainText(
    "Only ocr-text.pdf was opened. A PDF opens on its own, so 2 other files were left out.",
  );
  await settled(page, 2);
});

test("Searchable PDF: remove one image, the PDF is made from the rest", async ({
  page,
}) => {
  await openTool(page, "/searchable-pdf");
  await addFiles(page, [gen("ocr-scan-1.png"), gen("ocr-scan-2.png")]);
  await settled(page, 2);
  const btn = page
    .locator(".tool-area")
    .getByRole("button", { name: "Download searchable PDF" });
  await expect(btn).toBeEnabled({ timeout: 60_000 });
  // Page 1 is selected: take it out
  await page.getByRole("button", { name: "Remove this image" }).click();
  await settled(page, 1);
  await expect(btn).toBeEnabled({ timeout: 60_000 });
  const d = await download(page, () => btn.click());
  const doc = await PDFLib.PDFDocument.load(new Uint8Array(await bytes(d)), {
    updateMetadata: false,
  });
  expect(doc.getPageCount()).toBe(1);
  // Named after the image that's left
  expect(d.suggestedFilename()).toBe("ocr-scan-2-searchable-pdf-kmra.pdf");
});

test("image to text: remove the image to go back to the drop box", async ({
  page,
}) => {
  await openTool(page, "/image-to-text");
  await addFiles(page, gen("ocr-note.png"));
  await expect(page.locator(".dev-status")).toContainText(/Confidence \d+%/, {
    timeout: 200_000,
  });
  await page.getByRole("button", { name: "Remove ocr-note.png" }).click();
  await expect(page.getByText("Drop an image, screenshot or scan")).toBeVisible();
  await expect(page.locator(".oi-text textarea")).toHaveCount(0);
});

test("batch OCR: same names get -2, a blank scan says no text, stopped files can be retried", async ({
  page,
}, info) => {
  // A second "ocr-note.png" from another folder
  const twin = info.outputPath(join("twin", "ocr-note.png"));
  mkdirSync(dirname(twin), { recursive: true });
  copyFileSync(gen("ocr-note.png"), twin);
  // A scanned-looking PDF with nothing on it: no text layer, nothing for OCR to find
  const blank = info.outputPath("blank-scan.pdf");
  const doc = await PDFLib.PDFDocument.create();
  doc.addPage([595, 842]);
  writeFileSync(blank, await doc.save());

  await openTool(page, "/batch-ocr");
  await addFiles(page, [gen("ocr-note.png"), twin, blank]);
  // Stop right away: what hasn't been read is marked stopped
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  const failed = page.locator(".oi-row.failed");
  await expect(failed.first()).toBeVisible();
  // Retry every stopped file
  while ((await failed.count()) > 0)
    await failed
      .first()
      .getByRole("button", { name: /^Retry / })
      .click();
  await expect(page.locator(".oi-batch-foot")).toContainText("3 of 3 read", {
    timeout: 220_000,
  });
  const blankRow = page.locator(".oi-row", { hasText: "blank-scan.pdf" });
  await expect(blankRow).toContainText("No text found");
  await expect(blankRow).not.toContainText("Text layer");

  const z = await download(page, () =>
    page.getByRole("button", { name: "Zip of .txt files" }).click(),
  );
  const names = Object.keys(unzipSync(new Uint8Array(await bytes(z)))).sort();
  expect(names).toEqual([
    "blank-scan-batch-ocr-kmra.txt",
    "ocr-note-batch-ocr-2-kmra.txt",
    "ocr-note-batch-ocr-kmra.txt",
  ]);
  for (const n of names) expect(n).not.toMatch(/[\s()]/);
});
