/**
 * One smoke test per pdftool tool, in Simple mode (the default), asserting on the real output:
 * page counts, rotation and text read back from the downloaded file in Node.
 */
import { readFileSync } from "node:fs";
import { test, expect, openTool, addFiles, gen } from "../helpers.ts";
import { WORDS } from "../fixtures/docs.ts";
import {
  firstJpeg,
  imagesPerPage,
  load,
  loaded,
  pageCount,
  pageTexts,
  rotations,
  runAndDownload,
  sizes,
  toolButton,
  unzip,
} from "./util.ts";

const TEXT6 = gen("text6.pdf");
const WIDE2 = gen("landscape2.pdf");
const HEAVY = gen("heavy.pdf");

test("merge joins two PDFs in order, and Move up swaps them", async ({
  page,
}) => {
  await openTool(page, "/merge");
  await addFiles(page, [TEXT6, WIDE2]);
  await loaded(page, 8);
  let out = await runAndDownload(page, "Merge 2 PDFs");
  expect(out.name).toBe("text6-merge-kmra.pdf");
  let texts = await pageTexts(out.bytes);
  expect(texts).toHaveLength(8);
  expect(texts[0]).toContain("Apple");
  expect(texts[6]).toContain("Wide one");

  // Put the landscape file first: the result is rebuilt in the new order
  await page.getByRole("button", { name: "Move up" }).nth(1).click();
  out = await runAndDownload(page, "Merge 2 PDFs");
  texts = await pageTexts(out.bytes);
  expect(texts[0]).toContain("Wide one");
  expect(texts[2]).toContain("Apple");
});

test("split by ranges makes one PDF per range", async ({ page }) => {
  await openTool(page, "/split");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  await page.getByLabel("Ranges (one PDF each)").fill("1-2, 3-6");
  await expect(page.getByText("Makes 2 PDFs")).toBeVisible();
  const out = await runAndDownload(page, "Split", "Download 2 files (zip)");
  const files = unzip(out.bytes);
  const names = Object.keys(files).sort();
  expect(names).toEqual(["text6-split-pages-1-2-kmra.pdf", "text6-split-pages-3-6-kmra.pdf"]);
  expect(await pageCount(files["text6-split-pages-1-2-kmra.pdf"]!)).toBe(2);
  const last = await pageTexts(files["text6-split-pages-3-6-kmra.pdf"]!);
  expect(last.map((t) => t.split(" ")[2])).toEqual(WORDS.slice(2));
});

test("organize: drag a page, rotate one, delete one", async ({ page }) => {
  await openTool(page, "/organize");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  const cards = page.locator(".page-grid .pg");
  await expect(cards).toHaveCount(6);
  // Page 3 dropped on page 1 moves it to the front
  await cards.nth(2).dragTo(cards.nth(0));
  await expect(cards.nth(0).locator(".pg-face img")).toHaveAttribute(
    "alt",
    "Page 3",
  );
  // Rotate the new first page, delete the last one
  await cards.nth(0).getByRole("button", { name: "Rotate page" }).click();
  await cards.nth(5).getByRole("button", { name: "Delete page" }).click();
  await expect(cards).toHaveCount(5);
  const out = await runAndDownload(page, "Save PDF");
  const texts = await pageTexts(out.bytes);
  expect(texts.map((t) => t.split(" ")[2])).toEqual([
    "Cherry",
    "Apple",
    "Banana",
    "Damson",
    "Elder",
  ]);
  expect(await rotations(out.bytes)).toEqual([90, 0, 0, 0, 0]);
});

test("remove pages: click pages in the strip to drop them", async ({
  page,
}) => {
  await openTool(page, "/remove-pages");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  const tool = page.locator(".tool-area");
  await tool.getByRole("button", { name: "Page 2", exact: true }).click();
  await tool.getByRole("button", { name: "Page 5", exact: true }).click();
  await expect(tool.getByText("4 kept, 2 removed")).toBeVisible();
  const out = await runAndDownload(page, "Remove pages");
  const texts = await pageTexts(out.bytes);
  expect(texts.map((t) => t.split(" ")[2])).toEqual([
    "Apple",
    "Cherry",
    "Damson",
    "Fig",
  ]);
});

test("rotate turns every page left", async ({ page }) => {
  await openTool(page, "/rotate");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  await page
    .getByRole("group", { name: "Rotate every page" })
    .getByRole("button", { name: "Left" })
    .click();
  const out = await runAndDownload(page, "Rotate");
  expect(out.name).toBe("text6-rotate-kmra.pdf");
  expect(await rotations(out.bytes)).toEqual([270, 270, 270, 270, 270, 270]);
  expect(await pageTexts(out.bytes)).toHaveLength(6);
});

test("compress makes a picture-heavy PDF much smaller", async ({ page }) => {
  await openTool(page, "/compress");
  await addFiles(page, HEAVY);
  await loaded(page, 2);
  const out = await runAndDownload(page, "Compress");
  const inSize = readFileSync(HEAVY).length;
  expect(out.name).toBe("heavy-compress-kmra.pdf");
  expect(await pageCount(out.bytes)).toBe(2);
  expect(out.bytes.length).toBeLessThan(inSize * 0.5);
  await expect(page.locator(".tool-area .result .delta").first()).toContainText(
    "smaller",
  );
});

test("grayscale redraws pages in black and white", async ({ page }) => {
  await openTool(page, "/grayscale");
  await addFiles(page, HEAVY);
  await loaded(page, 2);
  const out = await runAndDownload(page, "Make black and white");
  expect(await pageCount(out.bytes)).toBe(2);
  // The page is now one JPEG; decode it in the browser and check its pixels have no colour
  const jpg = await firstJpeg(out.bytes);
  expect(jpg, "a JPEG on page 1").not.toBeNull();
  const spread = await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(
      new Blob([bin], { type: "image/jpeg" }),
    );
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const x = c.getContext("2d")!;
    x.drawImage(bmp, 0, 0);
    const d = x.getImageData(0, 0, bmp.width, bmp.height).data;
    let max = 0;
    for (let i = 0; i < d.length; i += 4 * 97)
      max = Math.max(
        max,
        Math.abs(d[i]! - d[i + 1]!),
        Math.abs(d[i + 1]! - d[i + 2]!),
      );
    return max;
  }, Buffer.from(jpg!).toString("base64"));
  // JPEG chroma noise allows a few levels; the input differs by up to ~200
  expect(spread).toBeLessThan(12);
});

test("sign: draw a signature, place it, download", async ({ page }) => {
  await openTool(page, "/sign");
  await addFiles(page, TEXT6);
  await expect(page.getByText("Page 1 of 6")).toBeVisible();
  const pad = page.getByLabel("Draw your signature here");
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++)
    await page.mouse.move(
      box.x + 20 + i * ((box.width - 40) / 12),
      box.y + box.height / 2 + (i % 2 ? -15 : 15),
    );
  await page.mouse.up();
  await page.getByRole("button", { name: "Place on this page" }).click();
  await expect(page.getByText("1 item on 1 page")).toBeVisible();
  const btn = page.getByRole("button", { name: "Download signed PDF" });
  const [d] = await Promise.all([page.waitForEvent("download"), btn.click()]);
  expect(d.suggestedFilename()).toBe("text6-sign-kmra.pdf");
  const b = new Uint8Array(readFileSync((await d.path())!));
  expect(Buffer.compare(Buffer.from(b), readFileSync(TEXT6))).not.toBe(0);
  expect(await pageCount(b)).toBe(6);
  // The signature is an image on page 1 only; the text is untouched
  expect(await imagesPerPage(b)).toEqual([1, 0, 0, 0, 0, 0]);
  expect((await pageTexts(b))[0]).toContain("Apple");
});

test("sign: a typed signature and a text item", async ({ page }) => {
  await openTool(page, "/sign");
  await addFiles(page, TEXT6);
  await expect(page.getByText("Page 1 of 6")).toBeVisible();
  await page
    .getByRole("group", { name: "Signature" })
    .getByRole("button", { name: "Type" })
    .click();
  await page.getByPlaceholder("Your name").fill("Jane Tester");
  await page.getByRole("button", { name: "Place on this page" }).click();
  // Second item on page 3
  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 3 of 6")).toBeVisible();
  await page.getByLabel("Text (name, date, initials)").fill("J. Tester");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("2 items on 2 pages")).toBeVisible();
  const [d] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download signed PDF" }).click(),
  ]);
  const b = new Uint8Array(readFileSync((await d.path())!));
  expect(await imagesPerPage(b)).toEqual([1, 0, 1, 0, 0, 0]);
});

test("page numbers: 'Page N of 6' at the bottom of every page", async ({
  page,
}) => {
  await openTool(page, "/page-numbers");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  const out = await runAndDownload(page, "Add page numbers");
  expect(out.name).toBe("text6-page-numbers-kmra.pdf");
  const texts = await pageTexts(out.bytes);
  texts.forEach((t, i) => expect(t).toContain(`Page ${i + 1} of 6`));
});

test("page numbers: plain numbers starting at 5, cover skipped", async ({
  page,
}) => {
  await openTool(page, "/page-numbers");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  await page
    .getByRole("group", { name: "Format" })
    .getByRole("button", { name: "Page 1", exact: true })
    .click();
  await page.getByLabel("Start at").fill("5");
  await page.getByLabel("Skip the first page (cover)").check();
  const out = await runAndDownload(page, "Add page numbers");
  const texts = await pageTexts(out.bytes);
  const numbers = texts.map((t) => /Page (\d+)$/.exec(t)?.[1] ?? null);
  // Page 1 has no number; the second page starts the count at 5
  expect(numbers).toEqual([null, "5", "6", "7", "8", "9"]);
});

test("watermark stamps every page", async ({ page }) => {
  await openTool(page, "/watermark");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  await page.getByLabel("Text", { exact: true }).fill("DRAFT COPY");
  const out = await runAndDownload(page, "Add watermark");
  expect(out.name).toBe("text6-watermark-kmra.pdf");
  expect(await imagesPerPage(out.bytes)).toEqual([1, 1, 1, 1, 1, 1]);
  // The original text stays selectable under the mark
  expect((await pageTexts(out.bytes))[3]).toContain("Damson");
});

test("metadata: edit the title, then remove everything", async ({ page }) => {
  await openTool(page, "/metadata");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  const title = page.getByLabel("Title", { exact: true });
  await expect(title).toHaveValue("Fixture text document");
  await expect(page.getByLabel("Author", { exact: true })).toHaveValue(
    "kmra tests",
  );
  await title.fill("Renamed by the test");
  let out = await runAndDownload(page, "Save info");
  let doc = await load(out.bytes);
  expect(doc.getTitle()).toBe("Renamed by the test");
  expect(doc.getAuthor()).toBe("kmra tests");
  expect(doc.getPageCount()).toBe(6);

  await page.getByLabel("Remove all document info").check();
  out = await runAndDownload(page, "Remove info");
  doc = await load(out.bytes);
  expect(doc.getTitle() ?? "").toBe("");
  expect(doc.getAuthor() ?? "").toBe("");
});

test("image to PDF: one page per picture, orientation follows the picture", async ({
  page,
}) => {
  await openTool(page, "/from-image");
  await addFiles(page, [gen("photo-wide.png"), gen("photo-tall.png")]);
  const [d] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Make PDF and download" }).click(),
  ]);
  expect(d.suggestedFilename()).toBe("photo-wide-from-image-kmra.pdf");
  const b = new Uint8Array(readFileSync((await d.path())!));
  // A4 by default, landscape for the wide picture
  expect(await sizes(b)).toEqual([
    [842, 595],
    [595, 842],
  ]);
  expect(await imagesPerPage(b)).toEqual([1, 1]);
});

test("PDF to images: every page as a JPG in a zip", async ({ page }) => {
  await openTool(page, "/to-image");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  const out = await runAndDownload(
    page,
    "Convert to images",
    "Download 6 files (zip)",
  );
  expect(out.name).toBe("text6-to-image-kmra.zip");
  const files = unzip(out.bytes);
  expect(Object.keys(files).sort()).toEqual(
    [1, 2, 3, 4, 5, 6].map((n) => `text6-to-image-page-${n}-kmra.jpg`),
  );
  for (const f of Object.values(files)) expect(f[0]).toBe(0xff);
});

test("PDF to images: only the ticked pages", async ({ page }) => {
  await openTool(page, "/to-image");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  const tool = page.locator(".tool-area");
  await tool.getByRole("checkbox", { name: "Page 2", exact: true }).check();
  await tool.getByRole("checkbox", { name: "Page 4", exact: true }).check();
  await expect(tool.getByText("2 pages picked")).toBeVisible();
  const out = await runAndDownload(
    page,
    "Convert to images",
    "Download 2 files (zip)",
  );
  expect(Object.keys(unzip(out.bytes)).sort()).toEqual([
    "text6-to-image-page-2-kmra.jpg",
    "text6-to-image-page-4-kmra.jpg",
  ]);
});

test("PDF to text: every word comes back", async ({ page }) => {
  await openTool(page, "/to-text");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  const out = await runAndDownload(page, "Extract text");
  expect(out.name).toBe("text6-to-text-kmra.txt");
  const txt = Buffer.from(out.bytes).toString("utf8");
  for (const [i, w] of WORDS.entries()) {
    expect(txt).toContain(w);
    expect(txt).toContain(`Page ${i + 1}`);
  }
  // Pages are separated by form feeds
  expect(txt.split("\f")).toHaveLength(6);
  await expect(
    page.locator(".tool-area").getByRole("button", { name: "Copy text" }),
  ).toBeVisible();
  await expect(toolButton(page, "Download")).toBeVisible();
});
