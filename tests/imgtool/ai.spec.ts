/**
 * The AI tools (background removal, change background, passport photo, face blur) and their task
 * pages. They load 5–15 MB ONNX models on first use, so they get a longer timeout, and they need a
 * real portrait (tests/fixtures/local/portrait.jpg, kept only on a developer's machine).
 */
import { test, expect, local, hasLocal } from "../helpers.ts";
import { info, save, start, file, stats, diff, ORT_WARNINGS } from "./lib.ts";

test.use({ allowConsole: [ORT_WARNINGS] });
test.beforeEach(() => {
  test.skip(!hasLocal("portrait.jpg"), "needs local fixture portrait.jpg");
  test.setTimeout(180_000);
});

const SLOW = 150_000;
const AI = { timeout: SLOW };
const portrait = () => local("portrait.jpg");

test(
  "remove background gives a transparent PNG cut-out",
  async ({ page }) => {
    await start(page, "/remove-bg", portrait(), SLOW);
    const { d, b } = await save(page, { summary: /PNG/, timeout: SLOW });
    expect(d.suggestedFilename()).toMatch(/\.png$/);
    expect(info(b)).toEqual({ type: "png", w: 1600, h: 2397 });
    const s = await stats(page, b);
    expect(s.transparent).toBeGreaterThan(0.15); // background gone
    expect(s.opaque).toBeGreaterThan(0.15); // person kept
    // The sky in the top corner is cleared, the face in the middle is kept
    expect(
      (await stats(page, b, [0, 0, 0.15, 0.1])).transparent,
    ).toBeGreaterThan(0.9);
    expect(
      (await stats(page, b, [0.35, 0.25, 0.6, 0.4])).opaque,
    ).toBeGreaterThan(0.9);
  },
  AI,
);

test(
  "change background to white",
  async ({ page }) => {
    await start(page, "/change-bg", portrait(), SLOW);
    const { b } = await save(page, { timeout: SLOW });
    expect(info(b)).toEqual({ type: "jpeg", w: 1600, h: 2397 });
    const corner = await stats(page, b, [0, 0, 0.15, 0.1]);
    expect(Math.min(...corner.mean.slice(0, 3))).toBeGreaterThan(235);
    // The face is unchanged
    expect(
      await diff(page, file(portrait()), b, [0.35, 0.25, 0.6, 0.4]),
    ).toBeLessThan(10);
  },
  AI,
);

test(
  "passport photo: 35 × 45 mm at 413 × 531 on white",
  async ({ page }) => {
    await start(page, "/passport-photo", portrait(), SLOW);
    const { b } = await save(page, { summary: /413 × 531/, timeout: SLOW });
    expect(info(b)).toEqual({ type: "jpeg", w: 413, h: 531 });
    const corner = await stats(page, b, [0, 0, 0.12, 0.08]);
    expect(Math.min(...corner.mean.slice(0, 3))).toBeGreaterThan(235);
  },
  AI,
);

test(
  "passport photo: 2 × 2 in is 600 × 600",
  async ({ page }) => {
    await start(page, "/passport-photo", portrait(), SLOW);
    await page.getByRole("button", { name: /^2 × 2 in/ }).click();
    const { b } = await save(page, { summary: /600 × 600/, timeout: SLOW });
    expect(info(b)).toEqual({ type: "jpeg", w: 600, h: 600 });
  },
  AI,
);

test(
  "face blur covers the face and leaves the rest",
  async ({ page }) => {
    await start(page, "/face-blur", portrait(), SLOW);
    await expect(
      page.getByRole("checkbox", {
        name: "Find and cover faces automatically",
      }),
    ).toBeChecked();
    await expect(page.locator(".tool-area")).toContainText(
      /1 face covered/,
      AI,
    );
    const { b } = await save(page, { timeout: SLOW });
    expect(info(b)).toEqual({ type: "jpeg", w: 1600, h: 2397 });
    const face = await diff(page, file(portrait()), b, [0.38, 0.28, 0.58, 0.4]);
    const shirt = await diff(page, file(portrait()), b, [0.1, 0.8, 0.4, 0.95]);
    expect(face).toBeGreaterThan(shirt + 8);
  },
  AI,
);

/* ---------- Task pages with presets ---------- */

test(
  "task: passport photo size (35 × 45 mm)",
  async ({ page }) => {
    await start(page, "/passport-photo-size", portrait(), SLOW);
    await expect(
      page.getByRole("button", { name: /^35 × 45 mm/ }),
    ).toHaveAttribute("aria-pressed", "true");
    const { b } = await save(page, { summary: /413 × 531/, timeout: SLOW });
    expect(info(b)).toEqual({ type: "jpeg", w: 413, h: 531 });
  },
  AI,
);

test(
  "task: US visa photo is 600 × 600 under 240 KB",
  async ({ page }) => {
    await start(page, "/us-visa-photo", portrait(), SLOW);
    const { b } = await save(page, { summary: /600 × 600/, timeout: SLOW });
    expect(info(b)).toEqual({ type: "jpeg", w: 600, h: 600 });
    expect(b.length).toBeLessThanOrEqual(240 * 1024);
  },
  AI,
);

test(
  "task: passport photos on a 4 × 6 in print sheet",
  async ({ page }) => {
    await start(page, "/passport-photo-4x6", portrait(), SLOW);
    const { b } = await save(page, { timeout: SLOW });
    const i = info(b);
    expect(i.type).toBe("jpeg");
    // 4 × 6 inches at 300 dpi, either orientation
    expect([i.w, i.h].sort((x, y) => x - y)).toEqual([1200, 1800]);
  },
  AI,
);
