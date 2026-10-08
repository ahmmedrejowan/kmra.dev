/** Smoke tests for the core ImageTool tools: compress, resize, convert, strip metadata, form size, crop, rotate. */
import { test, expect, gen } from "../helpers.ts";
import { info, hasExif, save, start, file, unzip } from "./lib.ts";

test("compress makes a smaller JPEG at the same size", async ({ page }) => {
  await start(page, "/compress", gen("photo.jpg"));
  const { d, b } = await save(page);
  expect(d.suggestedFilename()).toMatch(/\.jpg$/);
  expect(info(b)).toEqual({ type: "jpeg", w: 1600, h: 1200 });
  expect(b.length).toBeLessThan(file(gen("photo.jpg")).length * 0.8);
});

test("compress to WebP", async ({ page }) => {
  await start(page, "/compress", gen("photo.jpg"));
  await page
    .getByRole("group", { name: "Format" })
    .getByRole("button", { name: "WebP" })
    .click();
  const { d, b } = await save(page, { summary: /WebP/ });
  expect(d.suggestedFilename()).toMatch(/\.webp$/);
  expect(info(b)).toEqual({ type: "webp", w: 1600, h: 1200 });
});

test("resize to a width keeps the aspect ratio", async ({ page }) => {
  await start(page, "/resize", gen("photo.jpg"));
  await page.getByLabel("Width in pixels").fill("800");
  await expect(page.getByLabel("Height in pixels")).toHaveValue("600");
  const { b } = await save(page, { summary: /800 × 600/ });
  expect(info(b)).toEqual({ type: "jpeg", w: 800, h: 600 });
});

test("resize preset: YouTube 1280 × 720", async ({ page }) => {
  await start(page, "/resize", gen("photo.jpg"));
  await page.getByRole("button", { name: "YouTube 1280 × 720" }).click();
  const { b } = await save(page, { summary: /1280 × 720/ });
  expect(info(b)).toMatchObject({ w: 1280, h: 720 });
});

test("convert PNG to WebP", async ({ page }) => {
  await start(page, "/convert", gen("photo.png"));
  await page
    .getByRole("group", { name: "Convert to" })
    .getByRole("button", { name: "WebP" })
    .click();
  const { d, b } = await save(page, { summary: /WebP/ });
  expect(d.suggestedFilename()).toMatch(/\.webp$/);
  expect(info(b)).toEqual({ type: "webp", w: 800, h: 600 });
});

test("convert WebP to JPEG", async ({ page }) => {
  await start(page, "/convert", gen("photo.webp"));
  const { d, b } = await save(page);
  expect(d.suggestedFilename()).toMatch(/\.jpg$/);
  expect(info(b)).toEqual({ type: "jpeg", w: 800, h: 600 });
});

test("strip metadata removes EXIF", async ({ page }) => {
  const input = file(gen("exif.jpg"));
  expect(hasExif(input)).toBe(true);
  await start(page, "/strip-metadata", gen("exif.jpg"));
  const { b } = await save(page);
  expect(info(b)).toEqual({ type: "jpeg", w: 1600, h: 1200 });
  expect(hasExif(b)).toBe(false);
  expect(b.includes("KmraTestCam")).toBe(false);
});

test("form size: job photo default is 300 × 300 under 100 KB", async ({
  page,
}) => {
  await start(page, "/form-size", gen("photo.jpg"));
  const { b } = await save(page, { summary: /300 × 300/ });
  expect(info(b)).toEqual({ type: "jpeg", w: 300, h: 300 });
  expect(b.length).toBeLessThanOrEqual(100 * 1024);
});

test("form size: admission photo preset is 300 × 400", async ({ page }) => {
  await start(page, "/form-size", gen("photo.jpg"));
  await page.getByRole("button", { name: /Admission photo/ }).click();
  const { b } = await save(page, { summary: /300 × 400/ });
  expect(info(b)).toEqual({ type: "jpeg", w: 300, h: 400 });
  expect(b.length).toBeLessThanOrEqual(100 * 1024);
});

test("crop to 1:1 gives a square", async ({ page }) => {
  await start(page, "/crop", gen("photo.jpg"));
  await page.getByRole("button", { name: "1:1", exact: true }).click();
  const { b } = await save(page, { summary: /1200 × 1200/ });
  expect(info(b)).toEqual({ type: "jpeg", w: 1200, h: 1200 });
});

test("rotate right swaps width and height", async ({ page }) => {
  await start(page, "/rotate", gen("photo.jpg"));
  await page.getByRole("button", { name: "Right", exact: true }).click();
  const { b } = await save(page, { summary: /1200 × 1600/ });
  expect(info(b)).toEqual({ type: "jpeg", w: 1200, h: 1600 });
});

test("several files download as one zip", async ({ page }) => {
  await start(page, "/compress", [gen("photo.jpg"), gen("small.jpg")]);
  const { d, b } = await save(page, { button: "Download all 2 as zip" });
  expect(d.suggestedFilename()).toMatch(/\.zip$/);
  const entries = unzip(b);
  expect(entries.map((e) => e.name).sort()).toEqual([
    "photo-kmra.jpg",
    "small-kmra.jpg",
  ]);
  expect(entries.map((e) => info(e.data))).toEqual(
    expect.arrayContaining([
      { type: "jpeg", w: 1600, h: 1200 },
      { type: "jpeg", w: 640, h: 480 },
    ]),
  );
});
