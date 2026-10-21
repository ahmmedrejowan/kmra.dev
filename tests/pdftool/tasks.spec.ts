/**
 * Task landing pages (a tool with a preset) and the Advanced workspace (every page in a grid).
 */
import { readFileSync } from "node:fs";
import { test, expect, openTool, addFiles, gen, mode } from "../helpers.ts";
import { WORDS } from "../fixtures/docs.ts";
import {
  loaded,
  pageCount,
  pageTexts,
  rotations,
  runAndDownload,
  sizes,
  unzip,
} from "./util.ts";

const TEXT6 = gen("text6.pdf");
const WIDE2 = gen("landscape2.pdf");
const HEAVY = gen("heavy.pdf");
const word = (t: string) => t.split(" ")[2];

test.describe("compress to a size", () => {
  // Fitting a size draws the pages at up to four resolutions
  test.slow();

  test("compress-pdf-200kb gets a 2.9 MB picture PDF under 200 KB", async ({
    page,
  }) => {
    await openTool(page, "/compress-pdf-200kb");
    await addFiles(page, HEAVY);
    await loaded(page, 2);
    // The preset picks the size chip
    await expect(
      page.locator(".tool-area").getByRole("button", { name: "200 KB" }),
    ).toHaveAttribute("aria-pressed", "true");
    const out = await runAndDownload(page, "Compress");
    expect(out.bytes.length).toBeLessThanOrEqual(200 * 1024);
    expect(await pageCount(out.bytes)).toBe(2);
    await expect(page.getByText("Couldn't get under the limit")).toHaveCount(0);
  });

  test("compress-pdf-100kb fits, or says it couldn't", async ({ page }) => {
    await openTool(page, "/compress-pdf-100kb");
    await addFiles(page, HEAVY);
    await loaded(page, 2);
    const out = await runAndDownload(page, "Compress");
    expect(await pageCount(out.bytes)).toBe(2);
    if (out.bytes.length > 100 * 1024)
      await expect(
        page.getByText("Couldn't get under the limit"),
      ).toBeVisible();
    else
      await expect(page.getByText("Couldn't get under the limit")).toHaveCount(
        0,
      );
  });

  test("compress-pdf-1mb keeps a small text PDF selectable (lossless)", async ({
    page,
  }) => {
    await openTool(page, "/compress-pdf-1mb");
    await addFiles(page, TEXT6);
    await loaded(page, 6);
    const out = await runAndDownload(page, "Compress");
    expect(out.bytes.length).toBeLessThanOrEqual(1024 * 1024);
    // Under the limit already, so the pages are re-saved, not turned into pictures
    expect((await pageTexts(out.bytes)).map(word)).toEqual(WORDS);
  });
});

test("split-every-page: a zip with one PDF per page", async ({ page }) => {
  await openTool(page, "/split-every-page");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  await expect(
    page.getByRole("group", { name: "Split" }).getByRole("button", {
      name: "Every page",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  const out = await runAndDownload(page, "Split", "Download 6 files (zip)");
  const files = unzip(out.bytes);
  const names = Object.keys(files).sort();
  expect(names).toEqual(
    [1, 2, 3, 4, 5, 6].map((n) => `text6-split-page-${n}-kmra.pdf`),
  );
  for (const [i, n] of names.entries()) {
    expect(await pageCount(files[n]!)).toBe(1);
    expect((await pageTexts(files[n]!))[0]).toContain(WORDS[i]!);
  }
});

test("extract-pages: typed pages become one PDF", async ({ page }) => {
  await openTool(page, "/extract-pages");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  await page.getByLabel("Pages to keep in one PDF").fill("2, 4-5");
  await expect(page.getByText("Makes 1 PDF")).toBeVisible();
  const out = await runAndDownload(page, "Split");
  expect(out.name).toBe("text6-split-extract-kmra.pdf");
  expect((await pageTexts(out.bytes)).map(word)).toEqual([
    "Banana",
    "Damson",
    "Elder",
  ]);
});

test("extract-pages: clicked pages become one PDF", async ({ page }) => {
  await openTool(page, "/extract-pages");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  const tool = page.locator(".tool-area");
  await tool.getByRole("button", { name: "Page 6", exact: true }).click();
  await tool.getByRole("button", { name: "Page 1", exact: true }).click();
  await expect(tool.getByText("Picked: 2")).toBeVisible();
  const out = await runAndDownload(page, "Split");
  // Pages keep document order
  expect((await pageTexts(out.bytes)).map(word)).toEqual(["Apple", "Fig"]);
});

test("pdf-to-png: landscape pages as PNGs at 150 dpi", async ({ page }) => {
  await openTool(page, "/pdf-to-png");
  await addFiles(page, WIDE2);
  await loaded(page, 2);
  const out = await runAndDownload(
    page,
    "Convert to images",
    "Download 2 files (zip)",
  );
  const files = unzip(out.bytes);
  expect(Object.keys(files).sort()).toEqual([
    "landscape2-to-image-page-1-kmra.png",
    "landscape2-to-image-page-2-kmra.png",
  ]);
  for (const f of Object.values(files)) {
    const b = Buffer.from(f);
    expect(b.subarray(1, 4).toString()).toBe("PNG");
    // 842 × 595 pt at 150 dpi
    expect(b.readUInt32BE(16)).toBeGreaterThanOrEqual(1750);
    expect(b.readUInt32BE(20)).toBeGreaterThanOrEqual(1235);
    expect(b.readUInt32BE(16)).toBeGreaterThan(b.readUInt32BE(20));
  }
});

test("pdf-to-jpg: one page saves straight as a JPG", async ({ page }) => {
  await openTool(page, "/pdf-to-jpg");
  await addFiles(page, WIDE2);
  await loaded(page, 2);
  await page
    .locator(".tool-area")
    .getByRole("checkbox", { name: "Page 2", exact: true })
    .check();
  const out = await runAndDownload(page, "Convert to images");
  expect(out.name).toBe("landscape2-to-image-page-2-kmra.jpg");
  expect(out.bytes[0]).toBe(0xff);
  expect(out.bytes[1]).toBe(0xd8);
});

for (const slug of ["jpg-to-pdf", "scan-to-pdf"])
  test(`${slug}: a picture becomes a one-page PDF`, async ({ page }) => {
    await openTool(page, `/${slug}`);
    await addFiles(page, gen("photo-tall.png"));
    const [d] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Make PDF and download" }).click(),
    ]);
    expect(d.suggestedFilename()).toBe("photo-tall-from-image-kmra.pdf");
    const b = new Uint8Array(readFileSync((await d.path())!));
    expect(await sizes(b)).toEqual([[595, 842]]);
  });

/* ---------- Advanced ---------- */

test("Advanced remove pages: click pages in the grid", async ({ page }) => {
  await openTool(page, "/remove-pages");
  await mode(page, "advanced");
  await expect(page.locator("[data-mode=advanced]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  const grid = page.locator(".page-grid");
  await expect(grid.locator(".pg")).toHaveCount(6);
  await grid.getByRole("button", { name: "Page 1", exact: true }).click();
  await grid.getByRole("button", { name: "Page 3", exact: true }).click();
  await expect(
    grid.getByRole("button", { name: "Page 3", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Picked: 2")).toBeVisible();
  // Typed pages add to the clicked ones
  await page.getByLabel("Pages to remove").fill("6");
  const out = await runAndDownload(page, "Remove pages");
  expect((await pageTexts(out.bytes)).map(word)).toEqual([
    "Banana",
    "Damson",
    "Elder",
  ]);
});

test("Advanced organize: reorder across two files, insert a blank page", async ({
  page,
}) => {
  await openTool(page, "/organize");
  await mode(page, "advanced");
  await addFiles(page, [TEXT6, WIDE2]);
  await loaded(page, 8);
  const cards = page.locator(".page-grid .pg");
  await expect(cards).toHaveCount(8);
  // "Wide two" (last) dropped on the first page
  await cards.nth(7).dragTo(cards.nth(0));
  await expect(cards.nth(0).locator(".pg-face img")).toHaveAttribute(
    "alt",
    "Page 2",
  );
  await cards
    .nth(0)
    .getByRole("button", { name: "Insert blank page after" })
    .click();
  await expect(cards).toHaveCount(9);
  const out = await runAndDownload(page, "Save PDF");
  expect(out.name).toBe("text6-organize-kmra.pdf");
  const texts = await pageTexts(out.bytes);
  expect(texts).toHaveLength(9);
  expect(texts[0]).toBe("Wide two");
  expect(texts[1]).toBe("");
  expect(texts[2]).toContain("Apple");
  expect(texts[8]).toBe("Wide one");
  expect((await sizes(out.bytes))[0]).toEqual([842, 595]);
});

test("Advanced rotate: one page turned by hand plus the whole-file turn", async ({
  page,
}) => {
  await openTool(page, "/rotate");
  await mode(page, "advanced");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  const cards = page.locator(".page-grid .pg");
  await cards.nth(1).getByRole("button", { name: "Rotate page" }).click();
  const out = await runAndDownload(page, "Rotate");
  expect(await rotations(out.bytes)).toEqual([90, 180, 90, 90, 90, 90]);
});
