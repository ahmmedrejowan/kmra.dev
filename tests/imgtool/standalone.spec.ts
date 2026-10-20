/** Smoke tests for the tools that aren't one-image pipelines: collage, split, info, EXIF, histogram,
 * palette, colour picker, favicon, Base64 and GIF frames. */
import {
  test,
  expect,
  gen,
  openTool,
  addFiles,
  download,
  bytes,
} from "../helpers.ts";
import { info, kind, unzip, file } from "./lib.ts";

const area = (page: import("@playwright/test").Page) =>
  page.locator(".tool-area").first();

test("collage of two photos, side by side", async ({ page }) => {
  await openTool(page, "/collage");
  await addFiles(page, [gen("small.jpg"), gen("photo.jpg")]);
  await page.getByRole("button", { name: "Side by side" }).click();
  await page
    .getByRole("group", { name: "Size (long side)" })
    .getByRole("button", { name: "1080" })
    .click();
  await expect(area(page)).toContainText("1080 × 1080, 2 photos");
  const d = await download(page, () =>
    page.getByRole("button", { name: "Download collage" }).click(),
  );
  expect(d.suggestedFilename()).toMatch(/\.jpg$/);
  expect(info(await bytes(d))).toEqual({ type: "jpeg", w: 1080, h: 1080 });
});

test("split into a 3 × 3 grid downloads nine tiles", async ({ page }) => {
  await openTool(page, "/split");
  await addFiles(page, gen("photo.jpg"));
  await page.getByRole("button", { name: "Instagram grid 3 × 3" }).click();
  // The Instagram grid uses square tiles
  await expect(
    page.getByRole("checkbox", { name: /Square tiles/ }),
  ).toBeChecked();
  const d = await download(page, () =>
    page.getByRole("button", { name: "Download 9 tiles as zip" }).click(),
  );
  expect(d.suggestedFilename()).toMatch(/\.zip$/);
  const tiles = unzip(await bytes(d));
  expect(tiles).toHaveLength(9);
  for (const t of tiles)
    expect(info(t.data)).toEqual({ type: "jpeg", w: 400, h: 400 });
});

test("split default: carousel 1 × 3 as PNG", async ({ page }) => {
  await openTool(page, "/split");
  await addFiles(page, gen("photo.jpg"));
  await page
    .getByRole("group", { name: "Save as" })
    .getByRole("button", { name: "PNG" })
    .click();
  await expect(area(page)).toContainText("3 tiles of 533 × 1200");
  const d = await download(page, () =>
    page.getByRole("button", { name: "Download 3 tiles as zip" }).click(),
  );
  const tiles = unzip(await bytes(d));
  expect(tiles.map((t) => info(t.data))).toEqual(
    Array(3).fill({ type: "png", w: 533, h: 1200 }),
  );
});

test("image info shows size, dimensions and camera", async ({ page }) => {
  await openTool(page, "/image-info");
  await addFiles(page, gen("exif.jpg"));
  const dl = area(page).locator("dl").first();
  await expect(dl).toContainText("1600 × 1200 px");
  await expect(dl).toContainText("1,106,");
  await expect(dl).toContainText("KmraTestCam Model T1");
  await expect(dl).toContainText("4:3");
});

test("EXIF viewer lists tags and saves them as JSON", async ({ page }) => {
  await openTool(page, "/exif");
  await addFiles(page, gen("exif.jpg"));
  await expect(area(page)).toContainText("KmraTestCam");
  const d = await download(page, () =>
    page.getByRole("button", { name: "JSON", exact: true }).click(),
  );
  expect(d.suggestedFilename()).toBe("exif-metadata-kmra.json");
  const json = JSON.parse((await bytes(d)).toString("utf8"));
  expect(JSON.stringify(json)).toContain("KmraTestCam");
});

test("histogram draws and switches channels", async ({ page }) => {
  await openTool(page, "/histogram");
  await addFiles(page, gen("photo.jpg"));
  const canvas = page.getByLabel("Histogram");
  await expect(canvas).toBeVisible();
  await expect(area(page)).toContainText(/Average brightness\s*\d+%/);
  await page.getByRole("button", { name: "Red", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Red", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  // The canvas has something drawn on it
  const inked = await canvas.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n / (d.length / 4);
  });
  expect(inked).toBeGreaterThan(0.05);
});

test("palette finds colours and saves a PNG swatch", async ({ page }) => {
  await openTool(page, "/palette");
  await addFiles(page, gen("photo.jpg"));
  const swatches = area(page).getByRole("button", {
    name: /^#[0-9a-f]{6} \d+%$/,
  });
  await expect(swatches).toHaveCount(6);
  await page.getByRole("slider", { name: "Number of colours" }).fill("8");
  await expect(swatches).toHaveCount(8);
  const d = await download(page, () =>
    page.getByRole("button", { name: "PNG", exact: true }).click(),
  );
  expect(d.suggestedFilename()).toBe("photo-palette-kmra.png");
  expect(info(await bytes(d)).type).toBe("png");
});

test("colour picker keeps a clicked colour", async ({ page }) => {
  await openTool(page, "/color-picker");
  await addFiles(page, gen("photo.jpg"));
  await page
    .getByRole("img", { name: "photo.jpg" })
    .click({ position: { x: 20, y: 20 } });
  await expect(area(page)).toContainText("Kept 1");
  await expect(
    area(page)
      .getByRole("button", { name: /^#[0-9a-f]{6}$/i })
      .first(),
  ).toBeVisible();
});

test("favicon pack from an SVG logo", async ({ page }) => {
  await openTool(page, "/favicon");
  await addFiles(page, gen("logo.svg"));
  const d = await download(page, () =>
    page.getByRole("button", { name: "Download favicon pack" }).click(),
  );
  expect(d.suggestedFilename()).toBe("favicon-kmra.zip");
  const files = Object.fromEntries(
    unzip(await bytes(d)).map((f) => [f.name, f.data]),
  );
  expect(Object.keys(files)).toEqual(
    expect.arrayContaining([
      "favicon.ico",
      "favicon-16x16.png",
      "favicon-32x32.png",
      "apple-touch-icon.png",
      "site.webmanifest",
    ]),
  );
  expect(kind(files["favicon.ico"]!)).toBe("ico");
  expect(info(files["favicon-32x32.png"]!)).toEqual({
    type: "png",
    w: 32,
    h: 32,
  });
  expect(info(files["apple-touch-icon.png"]!)).toEqual({
    type: "png",
    w: 180,
    h: 180,
  });
  expect(JSON.parse(files["site.webmanifest"]!.toString()).name).toBe(
    "My site",
  );
});

test("Base64: image to data URI and back to an image", async ({ page }) => {
  await openTool(page, "/base64");
  await addFiles(page, gen("small.jpg"));
  const out = page.getByRole("textbox", { name: "Base64 output" });
  await expect(out).toHaveValue(/^data:image\/jpeg;base64,/);
  const uri = await out.inputValue();
  expect(
    Buffer.from(uri.split(",")[1]!, "base64").equals(file(gen("small.jpg"))),
  ).toBe(true);

  const txt = await download(page, () =>
    page.getByRole("button", { name: "Save as .txt" }).click(),
  );
  expect((await bytes(txt)).toString().trim()).toBe(uri);

  await page.getByRole("button", { name: "Base64 to image" }).click();
  await page.getByLabel("Base64 or data URI").fill(uri);
  await expect(page.getByRole("img", { name: "Decoded image" })).toBeVisible();
  const d = await download(page, () =>
    page.getByRole("button", { name: "Download image" }).click(),
  );
  expect((await bytes(d)).equals(file(gen("small.jpg")))).toBe(true);
});

test("GIF frames: all frames as a zip and a sprite sheet", async ({ page }) => {
  await openTool(page, "/gif-frames");
  await addFiles(page, gen("anim.gif"));
  await expect(area(page)).toContainText("64 × 48");
  const z = await download(page, () =>
    page.getByRole("button", { name: "Download 3 frames as zip" }).click(),
  );
  const frames = unzip(await bytes(z));
  expect(frames.map((f) => info(f.data))).toEqual(
    Array(3).fill({ type: "png", w: 64, h: 48 }),
  );
  // Different frames really differ
  expect(frames[0]!.data.equals(frames[1]!.data)).toBe(false);

  const s = await download(page, () =>
    page.getByRole("button", { name: "Sprite sheet (one PNG)" }).click(),
  );
  expect(info(await bytes(s))).toEqual({ type: "png", w: 192, h: 48 });
});
