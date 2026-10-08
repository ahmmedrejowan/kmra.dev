/**
 * OCRTool image tools: Image to text (document and UI screenshot, boxes on the picture, line
 * marking, output formats, .txt download, language presets) and Batch OCR (several files, zip and
 * combined downloads). Runs the real document engine (Tesseract), so the first read in each test
 * downloads the engine and language data from the local server.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
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
import { recall } from "../fixtures/ocrtool-pdf.ts";
import {
  CHINESE,
  DOC_LINES,
  NOTE_LINES,
  UI_LINES,
} from "../fixtures/ocrtool.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const req = createRequire(join(ROOT, "apps", "ocrtool", "package.json"));
const { unzipSync, strFromU8 } = req("fflate") as typeof import("fflate");

test.describe.configure({ timeout: 180_000 });

const text = (page: Page) => page.locator(".oi-text textarea");

/** Wait until the image has been read (the status line shows the confidence) */
async function waitRead(page: Page) {
  await expect(page.locator(".dev-status")).toContainText(/Confidence \d+%/, {
    timeout: 150_000,
  });
}

/** Every request the page makes stays on this site */
function sameOrigin(page: Page, origin: string) {
  const off: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !/^(blob|data):/.test(u)) off.push(u);
  });
  return off;
}

test("image to text reads a document, shows boxes and downloads .txt", async ({
  page,
  baseURL,
}) => {
  const off = sameOrigin(page, baseURL!);
  await openTool(page, "/image-to-text");
  await addFiles(page, gen("ocr-doc.png"));
  // First use: the language download is announced
  await waitRead(page);
  const got = await text(page).inputValue();
  expect(recall(DOC_LINES.join("\n"), got)).toBeGreaterThan(0.9);
  // One box per line on the picture
  expect(await page.locator("svg .oi-line").count()).toBeGreaterThanOrEqual(
    DOC_LINES.length,
  );

  // Hovering a line on the picture marks it in the text
  await page.locator("svg .oi-line").nth(1).hover();
  await expect(page.locator(".oi-hl mark")).toContainText(/parcel/i);

  const d = await download(page, () =>
    page.getByRole("button", { name: "Download .txt" }).click(),
  );
  expect(d.suggestedFilename()).toBe("ocr-doc.txt");
  const file = (await bytes(d)).toString("utf8");
  expect(recall(DOC_LINES.join("\n"), file)).toBeGreaterThan(0.9);

  // JSON output carries the boxes
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const json = JSON.parse(await text(page).inputValue());
  expect(json.lines.length).toBeGreaterThanOrEqual(DOC_LINES.length);
  expect(json.lines[0].box.w).toBeGreaterThan(100);
  expect(json.lines[0].words.length).toBeGreaterThan(3);

  // The text can be edited, and the download takes the edit
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await text(page).fill("Edited by hand");
  const d2 = await download(page, () =>
    page.getByRole("button", { name: "Download .txt" }).click(),
  );
  expect((await bytes(d2)).toString("utf8")).toBe("Edited by hand");

  expect(off, "requests to other sites").toEqual([]);
});

test("image to text reads a small UI screenshot", async ({ page }) => {
  await openTool(page, "/image-to-text");
  await addFiles(page, gen("ocr-ui.png"));
  await waitRead(page);
  const got = await text(page).inputValue();
  expect(recall(UI_LINES.join("\n"), got)).toBeGreaterThan(0.75);
});

test("the document engine reads the UI screenshot too (scan preset)", async ({
  page,
}) => {
  await openTool(page, "/scan-to-text");
  await addFiles(page, gen("ocr-ui.png"));
  await waitRead(page);
  await expect(page.locator(".dev-status")).toContainText(
    "Read with the document engine",
  );
  const got = await text(page).inputValue();
  expect(recall(UI_LINES.join("\n"), got)).toBeGreaterThan(0.75);
});

test("a language preset page preselects its language", async ({ page }) => {
  await openTool(page, "/chinese-ocr");
  const btn = page.locator(".oi-lang-btn");
  await expect(btn).toContainText("Chinese (Simplified)");
  await expect(btn).toContainText("English");
  // The picker searches by English and native names
  await btn.click();
  await page.getByRole("searchbox", { name: "Search languages" }).fill("日本");
  await expect(page.getByRole("option")).toHaveCount(2);
  await expect(page.getByRole("option").first()).toContainText("Japanese");
});

test("Chinese text is read with the Chinese preset", async ({ page }) => {
  test.skip(!existsSync(gen("ocr-chinese.png")), "No system font for Chinese");
  await openTool(page, "/chinese-ocr");
  await addFiles(page, gen("ocr-chinese.png"));
  await waitRead(page);
  const got = (await text(page).inputValue()).replace(/\s/g, "");
  const want = [...CHINESE];
  const hits = want.filter((c) => got.includes(c)).length;
  expect(hits / want.length).toBeGreaterThan(0.7);
});

test("batch OCR reads several files and downloads a zip and a combined file", async ({
  page,
}) => {
  await openTool(page, "/batch-ocr");
  await addFiles(page, [
    gen("ocr-doc.png"),
    gen("ocr-note.png"),
    gen("ocr-ui.png"),
  ]);
  await expect(page.locator(".oi-batch-foot")).toContainText("3 of 3 read", {
    timeout: 170_000,
  });
  await expect(page.locator(".oi-row.done")).toHaveCount(3);

  const z = await download(page, () =>
    page.getByRole("button", { name: "Zip of .txt files" }).click(),
  );
  const files = unzipSync(new Uint8Array(await bytes(z)));
  expect(Object.keys(files).sort()).toEqual([
    "ocr-doc.txt",
    "ocr-note.txt",
    "ocr-ui.txt",
  ]);
  expect(
    recall(NOTE_LINES.join(" "), strFromU8(files["ocr-note.txt"]!)),
  ).toBeGreaterThan(0.85);

  const md = await download(page, () =>
    page.getByRole("button", { name: "One .md" }).click(),
  );
  const body = (await bytes(md)).toString("utf8");
  expect(body).toContain("## ocr-doc.png");
  expect(body).toContain("## ocr-ui.png");
  expect(recall(DOC_LINES.join(" "), body)).toBeGreaterThan(0.9);
});
