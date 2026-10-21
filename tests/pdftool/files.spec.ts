/**
 * Several files in one run: a file that can't be done is left out (and named) while the others
 * still come out; removing a whole file; picks that follow deleted pages and removed files;
 * metadata edits that survive adding files; download names that drop an earlier kmra tag.
 */
import { copyFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test, expect, openTool, addFiles, gen, mode } from "../helpers.ts";
import {
  load,
  loaded,
  pageCount,
  pageTexts,
  rotations,
  runAndDownload,
  unzip,
} from "./util.ts";

const TEXT6 = gen("text6.pdf");
const WIDE2 = gen("landscape2.pdf");
const word = (t: string) => t.split(" ")[2];
const skipped = (page: Page) =>
  page.locator(".tool-area .skipped");

test("remove pages: a file that would lose every page is left out, the other still comes out", async ({
  page,
}) => {
  await openTool(page, "/remove-pages");
  await addFiles(page, [TEXT6, WIDE2]);
  await loaded(page, 8);
  // "1-2" is every page of the two-page file
  await page.getByLabel("Pages to remove").fill("1-2");
  const out = await runAndDownload(page, "Remove pages");
  expect(out.name).toBe("text6-remove-pages-kmra.pdf");
  expect((await pageTexts(out.bytes)).map(word)).toEqual([
    "Cherry",
    "Damson",
    "Elder",
    "Fig",
  ]);
  await expect(skipped(page)).toHaveCount(1);
  await expect(skipped(page)).toContainText("landscape2.pdf was left out");
});

test("split: ranges that don't fit a short file skip only that file", async ({
  page,
}) => {
  await openTool(page, "/split");
  await addFiles(page, [TEXT6, WIDE2]);
  await loaded(page, 8);
  await page.getByLabel("Ranges (one PDF each)").fill("1-2, 3-6");
  const out = await runAndDownload(page, "Split", "Download 2 files (zip)");
  const files = unzip(out.bytes);
  expect(Object.keys(files).sort()).toEqual([
    "text6-split-pages-1-2-kmra.pdf",
    "text6-split-pages-3-6-kmra.pdf",
  ]);
  expect(await pageCount(files["text6-split-pages-3-6-kmra.pdf"]!)).toBe(4);
  await expect(skipped(page)).toContainText("landscape2.pdf was left out");
});

test("advanced: a file whose pages were all deleted is left out, not saved empty", async ({
  page,
}) => {
  await openTool(page, "/rotate");
  await addFiles(page, [TEXT6, WIDE2]);
  await loaded(page, 8);
  await mode(page, "advanced");
  const cards = page.locator(".page-grid .pg");
  await expect(cards).toHaveCount(8);
  // The landscape file's two pages are the last two
  await cards.nth(7).getByRole("button", { name: "Delete page" }).click();
  await cards.nth(6).getByRole("button", { name: "Delete page" }).click();
  await expect(cards).toHaveCount(6);
  const out = await runAndDownload(page, "Rotate");
  expect(out.name).toBe("text6-rotate-kmra.pdf");
  expect(await rotations(out.bytes)).toEqual([90, 90, 90, 90, 90, 90]);
  await expect(skipped(page)).toContainText(
    "landscape2.pdf was left out: Every page was deleted.",
  );
});

test("advanced: remove a whole file from the file bar, and its picks go with it", async ({
  page,
}) => {
  await openTool(page, "/extract-pages");
  await addFiles(page, [TEXT6, WIDE2]);
  await loaded(page, 8);
  await mode(page, "advanced");
  const tool = page.locator(".tool-area");
  await tool.getByRole("button", { name: "Page 7", exact: true }).click();
  await tool.getByRole("button", { name: "Page 1", exact: true }).click();
  await expect(tool.getByText("Picked: 2")).toBeVisible();
  await tool.getByRole("button", { name: "Remove landscape2.pdf" }).click();
  await expect(page.locator(".page-grid .pg")).toHaveCount(6);
  await expect(tool.getByText("Picked: 1")).toBeVisible();
  await loaded(page, 6);
  const out = await runAndDownload(page, "Split");
  expect(out.name).toBe("text6-split-extract-kmra.pdf");
  expect((await pageTexts(out.bytes)).map(word)).toEqual(["Apple"]);
});

test("advanced: deleting a picked page takes it out of the picks", async ({
  page,
}) => {
  await openTool(page, "/remove-pages");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  await mode(page, "advanced");
  const tool = page.locator(".tool-area");
  await tool.getByRole("button", { name: "Page 2", exact: true }).click();
  await expect(tool.getByText("Picked: 1")).toBeVisible();
  await page
    .locator(".page-grid .pg")
    .nth(1)
    .getByRole("button", { name: "Delete page" })
    .click();
  await expect(tool.getByText("Picked: 0")).toBeVisible();
});

test("metadata: edits stay when another file is added", async ({ page }) => {
  await openTool(page, "/metadata");
  await addFiles(page, TEXT6);
  await loaded(page, 6);
  const title = page.getByLabel("Title", { exact: true });
  await expect(title).toHaveValue("Fixture text document");
  await title.fill("Kept by the test");
  await addFiles(page, WIDE2);
  await loaded(page, 8);
  await expect(title).toHaveValue("Kept by the test");
  const out = await runAndDownload(page, "Save info", "Download 2 files (zip)");
  const files = unzip(out.bytes);
  const first = await load(files["text6-metadata-kmra.pdf"]!);
  expect(first.getTitle()).toBe("Kept by the test");
});

test("a file that already carries the kmra tag isn't tagged twice", async ({
  page,
}, info) => {
  const tagged = info.outputPath("text6-compress-kmra.pdf");
  copyFileSync(TEXT6, tagged);
  await openTool(page, "/rotate");
  await addFiles(page, tagged);
  await loaded(page, 6);
  const out = await runAndDownload(page, "Rotate");
  expect(out.name).toBe("text6-compress-rotate-kmra.pdf");
});

test("sign: remove the PDF to go back to the drop box", async ({ page }) => {
  await openTool(page, "/sign");
  await addFiles(page, TEXT6);
  await expect(page.getByText("Page 1 of 6")).toBeVisible();
  await page.getByRole("button", { name: "Remove text6.pdf" }).click();
  await expect(page.getByText("Drop the PDF to sign")).toBeVisible();
  // A new file opens with nothing placed on it
  await addFiles(page, WIDE2);
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
});
