/** Smoke tests for the effect tools: adjust, filters, text, watermark, border, extend canvas, beautify, blur, signature. */
import { test, expect, gen } from "../helpers.ts";
import { info, save, start, file, stats, diff } from "./lib.ts";

const photo = () => file(gen("photo.jpg"));

test("adjust: more brightness gives a brighter image", async ({ page }) => {
  await start(page, "/adjust", gen("photo.jpg"));
  await page.getByRole("slider", { name: "Brightness" }).fill("50");
  const { b } = await save(page);
  expect(info(b)).toEqual({ type: "jpeg", w: 1600, h: 1200 });
  const before = await stats(page, photo());
  const after = await stats(page, b);
  const lum = (s: typeof before) => (s.mean[0] + s.mean[1] + s.mean[2]) / 3;
  expect(lum(after)).toBeGreaterThan(lum(before) + 10);
});

test("filters: Mono makes a greyscale image", async ({ page }) => {
  await start(page, "/filters", gen("photo.jpg"));
  await page.getByRole("button", { name: "Mono", exact: true }).click();
  const { b } = await save(page);
  expect(info(b)).toEqual({ type: "jpeg", w: 1600, h: 1200 });
  expect((await stats(page, photo())).colour).toBeGreaterThan(30);
  expect((await stats(page, b)).colour).toBeLessThan(3);
});

test("add text draws on the top of the image only", async ({ page }) => {
  await start(page, "/add-text", gen("photo.jpg"));
  await page.getByRole("textbox", { name: "Top text" }).fill("HELLO WORLD");
  const { b } = await save(page);
  expect(info(b)).toEqual({ type: "jpeg", w: 1600, h: 1200 });
  const top = await diff(page, photo(), b, [0.2, 0, 0.8, 0.2]);
  const middle = await diff(page, photo(), b, [0.2, 0.4, 0.8, 0.6]);
  expect(top).toBeGreaterThan(middle + 8);
});

test("watermark is placed bottom right", async ({ page }) => {
  await start(page, "/watermark", gen("photo.jpg"));
  await expect(page.getByRole("textbox", { name: "Text" })).toHaveValue(
    "© Your name",
  );
  const { b } = await save(page);
  expect(info(b)).toEqual({ type: "jpeg", w: 1600, h: 1200 });
  const corner = await diff(page, photo(), b, [0.6, 0.85, 1, 1]);
  const opposite = await diff(page, photo(), b, [0, 0, 0.4, 0.15]);
  expect(corner).toBeGreaterThan(opposite + 3);
});

test("border adds a frame around the image", async ({ page }) => {
  await start(page, "/border", gen("photo.jpg"));
  const { b } = await save(page, { summary: /1672 × 1272/ });
  expect(info(b)).toEqual({ type: "jpeg", w: 1672, h: 1272 });
  // White border on the default settings
  const edge = await stats(page, b, [0, 0, 1, 0.02]);
  expect(Math.min(...edge.mean.slice(0, 3))).toBeGreaterThan(245);
});

test("extend canvas to 1:1 without cropping", async ({ page }) => {
  await start(page, "/extend-canvas", gen("photo.jpg"));
  const { b } = await save(page, { summary: /1600 × 1600/ });
  expect(info(b)).toEqual({ type: "jpeg", w: 1600, h: 1600 });
});

test("beautify puts the image on a larger PNG backdrop", async ({ page }) => {
  await start(page, "/beautify", gen("small.jpg"));
  const { d, b } = await save(page);
  expect(d.suggestedFilename()).toMatch(/\.png$/);
  const i = info(b);
  expect(i.type).toBe("png");
  expect(i.w).toBeGreaterThan(640);
  expect(i.h).toBeGreaterThan(480);
});

test("blur: a dragged area is pixelated, the rest is untouched", async ({
  page,
}) => {
  await start(page, "/blur", gen("photo.jpg"));
  const img = page.getByRole("img", { name: /Choose areas to blur/ });
  const box = (await img.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4, {
    steps: 5,
  });
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(page.locator(".tool-area")).toContainText(/Areas\s*1/);
  const { b } = await save(page);
  expect(info(b)).toEqual({ type: "jpeg", w: 1600, h: 1200 });
  const inside = await diff(page, photo(), b, [0.25, 0.25, 0.45, 0.45]);
  const outside = await diff(page, photo(), b, [0.6, 0.6, 0.9, 0.9]);
  expect(inside).toBeGreaterThan(outside + 8);
});

test("signature: clean ink on a transparent PNG", async ({ page }) => {
  await start(page, "/signature", gen("signature.jpg"));
  const { d, b } = await save(page);
  expect(d.suggestedFilename()).toMatch(/\.png$/);
  expect(info(b).type).toBe("png");
  const s = await stats(page, b);
  expect(s.transparent).toBeGreaterThan(0.5); // the paper is gone
  expect(s.opaque).toBeGreaterThan(0.02); // the ink stays
});

test("signature: form size is 300 × 80", async ({ page }) => {
  await start(page, "/signature", gen("signature.jpg"));
  await page.getByRole("button", { name: "Form 300×80" }).click();
  const { b } = await save(page, { summary: /300 × 80/ });
  expect(info(b)).toMatchObject({ w: 300, h: 80 });
});
