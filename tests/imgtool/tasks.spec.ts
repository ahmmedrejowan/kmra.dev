/** Task landing pages: a tool opened with a preset. Each must produce what its title promises. */
import { test, expect, gen, local, hasLocal } from "../helpers.ts";
import { info, save, start, stats } from "./lib.ts";

const KB = 1024;

for (const target of [100, 20]) {
  test(`compress to ${target} KB stays under ${target} KB`, async ({
    page,
  }) => {
    await start(page, `/compress-to-${target}kb`, gen("photo.jpg"));
    const { b } = await save(page, { summary: /Best quality that fits/ });
    const i = info(b);
    expect(i.type).toBe("jpeg");
    expect(b.length).toBeLessThanOrEqual(target * KB);
    expect(b.length).toBeGreaterThan(target * KB * 0.3); // uses the budget, not a blank image
    expect(i.w / i.h).toBeCloseTo(4 / 3, 1);
  });
}

test("compress to 100 KB shows its target as the chosen exact size", async ({
  page,
}) => {
  await start(page, "/compress-to-100kb", gen("photo.jpg"));
  await expect(
    page.getByRole("button", { name: "Under 100 KB" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("compress to 20 KB shows its target as the chosen exact size", async ({
  page,
}) => {
  await start(page, "/compress-to-20kb", gen("photo.jpg"));
  await expect(page.getByRole("button", { name: /20 KB/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("photo 300 × 300 under 100 KB", async ({ page }) => {
  await start(page, "/photo-300x300-100kb", gen("photo.jpg"));
  const { b } = await save(page, { summary: /300 × 300/ });
  expect(info(b)).toEqual({ type: "jpeg", w: 300, h: 300 });
  expect(b.length).toBeLessThanOrEqual(100 * KB);
});

test("signature 300 × 80 under 60 KB", async ({ page }) => {
  await start(page, "/signature-300x80-60kb", gen("signature.jpg"));
  const { b } = await save(page, { summary: /300 × 80/ });
  expect(info(b)).toMatchObject({ w: 300, h: 80 });
  expect(b.length).toBeLessThanOrEqual(60 * KB);
});

test("YouTube thumbnail is 1280 × 720", async ({ page }) => {
  await start(page, "/youtube-thumbnail", gen("photo.jpg"));
  const { b } = await save(page, { summary: /1280 × 720/ });
  expect(info(b)).toMatchObject({ w: 1280, h: 720 });
});

test("crop to square", async ({ page }) => {
  await start(page, "/crop-to-square", gen("photo.jpg"));
  const { b } = await save(page);
  const i = info(b);
  expect(i.w).toBe(i.h);
  expect(i.w).toBe(1200);
});

test("Instagram without cropping pads to 4:5", async ({ page }) => {
  await start(page, "/instagram-no-crop", gen("photo.jpg"));
  const { b } = await save(page);
  const i = info(b);
  expect(i.h / i.w).toBeCloseTo(5 / 4, 2);
  expect(i.w).toBeGreaterThanOrEqual(1600);
});

test("SVG to PNG", async ({ page }) => {
  await start(page, "/svg-to-png", gen("logo.svg"));
  const { d, b } = await save(page);
  expect(d.suggestedFilename()).toBe("logo-kmra.png");
  const i = info(b);
  expect(i.type).toBe("png");
  expect(i.w / i.h).toBeCloseTo(240 / 160, 2);
  const s = await stats(page, b, [0.25, 0.4, 0.4, 0.6]); // inside the yellow circle
  expect(s.mean[0]).toBeGreaterThan(200);
  expect(s.mean[2]).toBeLessThan(150);
});

test("JPG to WebP", async ({ page }) => {
  await start(page, "/jpg-to-webp", gen("photo.jpg"));
  const { d, b } = await save(page);
  expect(d.suggestedFilename()).toMatch(/\.webp$/);
  expect(info(b)).toEqual({ type: "webp", w: 1600, h: 1200 });
});

test("PNG to JPG keeps the size", async ({ page }) => {
  await start(page, "/png-to-jpg", gen("alpha.png"));
  const { b } = await save(page);
  expect(info(b)).toEqual({ type: "jpeg", w: 400, h: 400 });
  // Transparent areas become white, not black
  const corner = await stats(page, b, [0, 0, 0.1, 0.1]);
  expect(Math.min(...corner.mean.slice(0, 3))).toBeGreaterThan(245);
});

test("black and white", async ({ page }) => {
  await start(page, "/black-and-white", gen("photo.jpg"));
  const { b } = await save(page);
  expect((await stats(page, b)).colour).toBeLessThan(3);
});

test("transparent signature", async ({ page }) => {
  await start(page, "/transparent-signature", gen("signature.jpg"));
  const { b } = await save(page);
  expect(info(b).type).toBe("png");
  expect((await stats(page, b)).transparent).toBeGreaterThan(0.5);
});

test("HEIC to JPG", async ({ page }) => {
  test.skip(!hasLocal("sample.heic"), "needs local fixture sample.heic");
  await start(page, "/heic-to-jpg", local("sample.heic"), 60_000);
  const { d, b } = await save(page);
  expect(d.suggestedFilename()).toBe("sample-kmra.jpg");
  const i = info(b);
  expect(i.type).toBe("jpeg");
  expect(i.w).toBeGreaterThan(100);
  expect(i.h).toBeGreaterThan(100);
});
