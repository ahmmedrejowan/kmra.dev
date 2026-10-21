/**
 * Every control of the image tools, one by one, checked on the downloaded file: sizes, formats,
 * file sizes, transparency and pixel colours in the regions a control should (and shouldn't)
 * change. The smoke tests in basics.spec.ts and effects.spec.ts cover each tool's main job; these
 * cover what each setting does.
 */
import type { Page } from "@playwright/test";
import { test, expect, gen } from "../helpers.ts";
import {
  info,
  save,
  start,
  file,
  stats,
  diff,
  unzip,
  resultPanel,
  type Region,
} from "./lib.ts";

const photo = () => file(gen("photo.jpg"));
const lum = (m: number[]) => (m[0]! + m[1]! + m[2]!) / 3;

/**
 * After a change: the preview starts over after a short pause. Wait for that render to start
 * (a fast one may finish before it's seen, hence the cap), then save its result.
 */
async function fresh(page: Page) {
  await expect(resultPanel(page))
    .toHaveClass(/working/, { timeout: 2_000 })
    .catch(() => {});
  return save(page);
}

/** Mean difference allowed for "unchanged": one more JPEG generation (MozJPEG in Safari) */
const SAME = 6;
const pick = (page: Page, group: string, name: string) =>
  page
    .getByRole("group", { name: group })
    .getByRole("button", { name, exact: true })
    .click();
const chip = (page: Page, name: string) =>
  page.locator(".controls").getByRole("button", { name, exact: true }).click();
const slider = (page: Page, name: string, value: number) =>
  page.locator(".controls").getByRole("slider", { name }).fill(String(value));
const ratio = (b: Buffer) => {
  const i = info(b);
  return i.w / i.h;
};

/* ---------- Compress ---------- */

test("compress: a lower quality gives a smaller file, step by step", async ({
  page,
}) => {
  await start(page, "/compress", gen("photo.jpg"));
  const sizes: number[] = [];
  for (const q of [90, 60, 30]) {
    await slider(page, "Quality", q);
    const { b } = await fresh(page);
    expect(info(b)).toEqual({ type: "jpeg", w: 1600, h: 1200 });
    sizes.push(b.length);
  }
  expect(sizes[1]).toBeLessThan(sizes[0]!);
  expect(sizes[2]).toBeLessThan(sizes[1]!);
});

test("compress: AVIF and WebP keep the size in pixels", async ({ page }) => {
  await start(page, "/compress", gen("photo.jpg"));
  for (const [name, type] of [
    ["AVIF", "avif"],
    ["WebP", "webp"],
  ] as const) {
    await pick(page, "Format", name);
    const { d, b } = await fresh(page);
    expect(info(b)).toEqual({ type, w: 1600, h: 1200 });
    expect(d.suggestedFilename()).toMatch(new RegExp(`\\.${type}$`));
  }
});

test("compress: exact size 50 KB stays under 50 KB", async ({ page }) => {
  await start(page, "/compress", gen("photo.jpg"));
  await chip(page, "Under 50 KB");
  const { b } = await fresh(page);
  expect(b.length).toBeLessThanOrEqual(50 * 1024);
  expect(info(b).type).toBe("jpeg");
});

/* ---------- Transparency ---------- */

test("transparent PNG: JPEG fills the clear parts with white, WebP keeps them clear", async ({
  page,
}) => {
  const src = file(gen("alpha.png"));
  // Find a corner of the test image that's see-through, to watch it in the results
  const corners: Region[] = [
    [0, 0, 0.08, 0.08],
    [0.92, 0, 1, 0.08],
    [0, 0.92, 0.08, 1],
    [0.92, 0.92, 1, 1],
  ];
  await start(page, "/convert", gen("alpha.png"));
  let clear: Region | undefined;
  for (const c of corners)
    if ((await stats(page, src, c)).transparent > 0.9) clear = c;
  expect(clear, "alpha.png has a transparent corner").toBeDefined();

  await pick(page, "Convert to", "JPEG");
  const jpg = (await fresh(page)).b;
  expect(info(jpg).type).toBe("jpeg");
  expect(lum((await stats(page, jpg, clear)).mean)).toBeGreaterThan(240);

  await pick(page, "Convert to", "WebP");
  const webp = (await fresh(page)).b;
  expect(info(webp).type).toBe("webp");
  expect((await stats(page, webp, clear)).transparent).toBeGreaterThan(0.9);
});

/* ---------- Convert ---------- */

test("convert: ICO is at most 256 pixels, GIF keeps the size", async ({
  page,
}) => {
  await start(page, "/convert", gen("photo.jpg"));
  await pick(page, "Convert to", "ICO");
  const ico = info((await fresh(page)).b);
  expect(ico.type).toBe("ico");
  expect(Math.max(ico.w, ico.h)).toBeLessThanOrEqual(256);
  await pick(page, "Convert to", "GIF");
  expect(info((await fresh(page)).b)).toEqual({
    type: "gif",
    w: 1600,
    h: 1200,
  });
});

/* ---------- Resize ---------- */

test("resize: height alone keeps the shape; unlocked takes both numbers as given", async ({
  page,
}) => {
  await start(page, "/resize", gen("photo.jpg"));
  await page.getByLabel("Height in pixels").fill("300");
  await expect(page.getByLabel("Width in pixels")).toHaveValue("400");
  expect(info((await fresh(page)).b)).toEqual({ type: "jpeg", w: 400, h: 300 });

  await page.getByRole("button", { name: "Keep aspect ratio" }).click();
  await page.getByLabel("Width in pixels").fill("500");
  await page.getByLabel("Height in pixels").fill("100");
  expect(info((await fresh(page)).b)).toEqual({ type: "jpeg", w: 500, h: 100 });

  await chip(page, "Original size");
  expect(info((await fresh(page)).b)).toEqual({
    type: "jpeg",
    w: 1600,
    h: 1200,
  });
});

test("resize: presets and Save as", async ({ page }) => {
  await start(page, "/resize", gen("photo.jpg"));
  await chip(page, "50%");
  expect(info((await fresh(page)).b)).toEqual({ type: "jpeg", w: 800, h: 600 });
  await chip(page, "Story 1080 × 1920");
  const story = info((await fresh(page)).b);
  expect([story.w, story.h]).toEqual([1080, 1920]);
  await chip(page, "Square 1080");
  expect(info((await fresh(page)).b)).toMatchObject({ w: 1080, h: 1080 });
  await pick(page, "Save as", "PNG");
  expect(info((await fresh(page)).b)).toEqual({
    type: "png",
    w: 1080,
    h: 1080,
  });
});

/* ---------- Crop ---------- */

test("crop: every aspect ratio gives its shape", async ({ page }) => {
  await start(page, "/crop", gen("photo.jpg"));
  for (const [name, r] of [
    ["4:5", 4 / 5],
    ["3:2", 3 / 2],
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
  ] as const) {
    await chip(page, name);
    const b = (await fresh(page)).b;
    expect(ratio(b), name).toBeCloseTo(r, 1);
  }
});

test("crop: a ratio crops each photo of a batch to that shape", async ({
  page,
}) => {
  await start(page, "/crop", [gen("photo.jpg"), gen("photo-tall.png")]);
  await chip(page, "1:1");
  await page.waitForTimeout(450);
  const { b } = await save(page, { button: "Download all 2 as zip" });
  for (const f of unzip(b)) {
    const i = info(f.data);
    expect(i.w, f.name).toBe(i.h);
  }
});

/* ---------- Rotate ---------- */

test("rotate: left, half a turn and both flips move the picture where they should", async ({
  page,
}) => {
  const src = photo();
  await start(page, "/rotate", gen("photo.jpg"));
  const q = (b: Buffer, r: Region) => stats(page, b, r).then((s) => s.mean);
  const close = (a: number[], b: number[]) =>
    expect(Math.abs(lum(a) - lum(b)) + Math.abs(a[0]! - b[0]!)).toBeLessThan(
      12,
    );

  await page.getByRole("button", { name: "Left" }).click();
  const left = (await fresh(page)).b;
  expect(info(left)).toMatchObject({ w: 1200, h: 1600 });
  // Turned left, the original's top-right corner is now top-left
  close(await q(left, [0, 0, 0.25, 0.25]), await q(src, [0.75, 0, 1, 0.25]));

  await page.getByRole("button", { name: "Left" }).click();
  const half = (await fresh(page)).b;
  expect(info(half)).toMatchObject({ w: 1600, h: 1200 });
  close(await q(half, [0, 0, 0.25, 0.25]), await q(src, [0.75, 0.75, 1, 1]));

  // Back to upright, then each flip
  await page.getByRole("button", { name: "Right" }).click();
  await page.getByRole("button", { name: "Right" }).click();
  await page.getByRole("button", { name: /Flip ↔/ }).click();
  const fh = (await fresh(page)).b;
  close(await q(fh, [0, 0, 0.25, 0.25]), await q(src, [0.75, 0, 1, 0.25]));
  await page.getByRole("button", { name: /Flip ↔/ }).click();
  await page.getByRole("button", { name: /Flip ↕/ }).click();
  const fv = (await fresh(page)).b;
  close(await q(fv, [0, 0, 0.25, 0.25]), await q(src, [0, 0.75, 0.25, 1]));
});

/* ---------- Exact size for forms ---------- */

for (const [preset, w, h, kb] of [
  ["Signature", 300, 80, 60],
  ["Passport / visa", 413, 531, 200],
  ["US visa / DV", 600, 600, 240],
] as const)
  test(`form size: ${preset} is ${w} × ${h} under ${kb} KB`, async ({
    page,
  }) => {
    await start(page, "/form-size", gen("photo.jpg"));
    await page
      .locator(".controls")
      .getByRole("button", {
        name: new RegExp(`^${preset.replace("/", "\\/")}`),
      })
      .click();
    const { b } = await fresh(page);
    expect(info(b)).toEqual({ type: "jpeg", w, h });
    expect(b.length).toBeLessThanOrEqual(kb * 1024);
  });

/* ---------- Adjust ---------- */

test("adjust: saturation, warmth, contrast, sharpen and vignette each change the picture their way", async ({
  page,
}) => {
  const src = photo();
  await start(page, "/adjust", gen("photo.jpg"));
  const base = await stats(page, src);

  await slider(page, "Saturation", -100);
  expect((await stats(page, (await fresh(page)).b)).colour).toBeLessThan(
    base.colour / 4,
  );
  await slider(page, "Saturation", 0);

  await slider(page, "Warmth", 60);
  const warm = await stats(page, (await fresh(page)).b);
  expect(warm.mean[0] - warm.mean[2]).toBeGreaterThan(
    base.mean[0] - base.mean[2] + 8,
  );
  await slider(page, "Warmth", 0);

  await slider(page, "Contrast", 60);
  expect(await diff(page, src, (await fresh(page)).b)).toBeGreaterThan(6);
  await slider(page, "Contrast", 0);

  await slider(page, "Sharpen", 80);
  expect(await diff(page, src, (await fresh(page)).b)).toBeGreaterThan(1);
  await slider(page, "Sharpen", 0);

  await slider(page, "Vignette", 80);
  const v = (await fresh(page)).b;
  const edge = (await stats(page, v, [0, 0, 0.1, 0.1])).mean;
  const edge0 = (await stats(page, src, [0, 0, 0.1, 0.1])).mean;
  const mid = (await stats(page, v, [0.45, 0.45, 0.55, 0.55])).mean;
  const mid0 = (await stats(page, src, [0.45, 0.45, 0.55, 0.55])).mean;
  // The corners darken a lot more than the middle
  expect(lum(edge0) - lum(edge)).toBeGreaterThan(lum(mid0) - lum(mid) + 10);
});

/* ---------- Filters ---------- */

test("filters: sepia is warm, invert flips the colours, strength 0 leaves the photo as it was", async ({
  page,
}) => {
  const src = photo();
  await start(page, "/filters", gen("photo.jpg"));
  const base = await stats(page, src);

  await chip(page, "Sepia");
  const sepia = await stats(page, (await fresh(page)).b);
  expect(sepia.mean[0]).toBeGreaterThan(sepia.mean[1]);
  expect(sepia.mean[1]).toBeGreaterThan(sepia.mean[2]);

  await chip(page, "Invert");
  const inv = await stats(page, (await fresh(page)).b);
  expect(Math.abs(lum(inv.mean) - (255 - lum(base.mean)))).toBeLessThan(12);

  await slider(page, "Strength", 0);
  expect(await diff(page, src, (await fresh(page)).b)).toBeLessThan(SAME);

  // Every look changes the photo
  await slider(page, "Strength", 100);
  for (const look of ["Noir", "Vintage", "Vivid", "Cool", "Fade", "Dramatic"]) {
    await chip(page, look);
    expect(await diff(page, src, (await fresh(page)).b), look).toBeGreaterThan(
      5,
    );
  }
});

/* ---------- Add text ---------- */

test("add text: bottom text, colour and size", async ({ page }) => {
  const src = photo();
  await start(page, "/add-text", gen("photo.jpg"));
  await page.getByRole("textbox", { name: "Bottom text" }).fill("BOTTOM LINE");
  const small = (await fresh(page)).b;
  const bottom: Region = [0.1, 0.8, 0.9, 1];
  expect(await diff(page, src, small, bottom)).toBeGreaterThan(
    (await diff(page, src, small, [0.1, 0, 0.9, 0.2])) + 8,
  );

  await slider(page, "Size", 20);
  const big = (await fresh(page)).b;
  expect(await diff(page, src, big, [0.05, 0.65, 0.95, 1])).toBeGreaterThan(
    await diff(page, src, small, [0.05, 0.65, 0.95, 1]),
  );

  await page.getByRole("button", { name: "Clean", exact: true }).click();
  expect(
    await diff(page, big, (await fresh(page)).b, bottom),
    "another font",
  ).toBeGreaterThan(2);
});

/* ---------- Watermark ---------- */

test("watermark: position, opacity, size and repeat", async ({ page }) => {
  const src = photo();
  await start(page, "/watermark", gen("photo.jpg"));
  const tl: Region = [0, 0, 0.35, 0.2];
  const br: Region = [0.65, 0.8, 1, 1];

  await pick(page, "Position", "tl");
  const atTl = (await fresh(page)).b;
  expect(await diff(page, src, atTl, tl)).toBeGreaterThan(
    (await diff(page, src, atTl, br)) + 2,
  );

  await slider(page, "Opacity", 100);
  const strong = (await fresh(page)).b;
  await slider(page, "Opacity", 20);
  const faint = (await fresh(page)).b;
  expect(await diff(page, src, strong, tl)).toBeGreaterThan(
    await diff(page, src, faint, tl),
  );

  await slider(page, "Opacity", 70);
  await slider(page, "Size", 12);
  const bigger = (await fresh(page)).b;
  expect(await diff(page, src, bigger)).toBeGreaterThan(
    await diff(page, src, atTl),
  );

  await page.getByRole("button", { name: "Repeat across" }).click();
  const tiled = (await fresh(page)).b;
  for (const r of [tl, br, [0.4, 0.4, 0.6, 0.6] as Region])
    expect(await diff(page, src, tiled, r), String(r)).toBeGreaterThan(1);
});

/* ---------- Border ---------- */

test("border: thicker grows the image, rounded corners are clear in a PNG", async ({
  page,
}) => {
  await start(page, "/border", gen("photo.jpg"));
  const thin = info((await fresh(page)).b);
  await slider(page, "Border", 10);
  const thick = info((await fresh(page)).b);
  expect(thick.w).toBeGreaterThan(thin.w);

  await slider(page, "Rounded corners", 10);
  await pick(page, "Save as", "PNG");
  const round = (await fresh(page)).b;
  expect(info(round).type).toBe("png");
  expect(
    (await stats(page, round, [0, 0, 0.01, 0.01])).transparent,
  ).toBeGreaterThan(0.5);
  expect(
    (await stats(page, round, [0.45, 0.45, 0.55, 0.55])).opaque,
  ).toBeGreaterThan(0.99);
});

/* ---------- Extend canvas and beautify ---------- */

test("extend canvas: each shape, and a plain colour behind", async ({
  page,
}) => {
  await start(page, "/extend-canvas", gen("photo.jpg"));
  for (const [name, r] of [
    ["4:5", 4 / 5],
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
  ] as const) {
    await chip(page, name);
    expect(ratio((await fresh(page)).b), name).toBeCloseTo(r, 1);
  }
  await pick(page, "Background", "Colour");
  const b = (await fresh(page)).b;
  // 9:16 from a 4:3 photo: bands above and below, in one flat colour
  expect((await stats(page, b, [0.2, 0, 0.8, 0.05])).colour).toBeLessThan(6);
});

test("beautify: the window bar and padding", async ({ page }) => {
  await start(page, "/beautify", gen("photo.jpg"));
  await pick(page, "Window bar", "None");
  const none = (await fresh(page)).b;
  await pick(page, "Window bar", "Dark");
  const dark = (await fresh(page)).b;
  expect(info(dark).h).toBeGreaterThanOrEqual(info(none).h);
  await slider(page, "Padding", 0);
  const tight = info((await fresh(page)).b);
  expect(tight.w).toBeLessThan(info(dark).w);
});

/* ---------- Blur areas ---------- */

test("blur: solid fills the area with one colour, oval leaves the area's corners", async ({
  page,
}) => {
  const src = photo();
  await start(page, "/blur", gen("photo.jpg"));
  const box = page.locator(".cropper.regions img").first();
  await expect(box).toBeVisible();
  const r = (await box.boundingBox())!;
  const drag = async () => {
    await page.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width * 0.7, r.y + r.height * 0.7, {
      steps: 6,
    });
    await page.mouse.up();
  };
  await pick(page, "Effect", "Solid");
  await drag();
  const solid = (await fresh(page)).b;
  expect((await stats(page, solid, [0.4, 0.4, 0.6, 0.6])).colour).toBeLessThan(
    3,
  );
  expect(await diff(page, src, solid, [0, 0, 0.2, 0.2])).toBeLessThan(SAME);

  await pick(page, "Shape", "Oval");
  const oval = (await fresh(page)).b;
  // The corner of the dragged box is outside the oval, so it's left as it was
  expect(await diff(page, src, oval, [0.31, 0.31, 0.34, 0.34])).toBeLessThan(
    await diff(page, src, solid, [0.31, 0.31, 0.34, 0.34]),
  );
});

/* ---------- Signature ---------- */

test("signature: ink colours, trimming and a white JPEG", async ({ page }) => {
  await start(page, "/signature", gen("signature.jpg"));
  const ink = async (b: Buffer) => {
    // The darkest strokes: measure the whole image's opaque colour balance
    const s = await stats(page, b);
    return s.mean;
  };
  await pick(page, "Ink colour", "Blue");
  const blue = await ink((await fresh(page)).b);
  expect(blue[2]).toBeGreaterThan(blue[0]);

  const keep = info((await fresh(page)).b);
  const trim = page.getByRole("checkbox", { name: "Trim empty space" });
  if (await trim.isChecked()) await trim.uncheck();
  else await trim.check();
  const other = info((await fresh(page)).b);
  expect(other.w * other.h).not.toBe(keep.w * keep.h);

  await pick(page, "Save as", "JPEG (white)");
  const jpg = (await fresh(page)).b;
  expect(info(jpg).type).toBe("jpeg");
  expect((await stats(page, jpg)).opaque).toBe(1);
});
