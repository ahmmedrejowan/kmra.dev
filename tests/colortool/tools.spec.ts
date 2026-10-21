/**
 * ColorTool: every tool checked on real values (conversions, contrast ratios, scheme hues, the
 * 50–950 scale, mixing, colour vision on pixels, PNG downloads), every use-case page's preset,
 * the home page palette, the Bangla page, and a coverage check (every ready tool has a test).
 */
import type { Page } from "@playwright/test";
import { getApp } from "../../packages/registry/src/index.ts";
import { bytes, download, expect, openTool, test } from "../helpers.ts";

const app = getApp("colortool");

const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true });
const row = (page: Page, id: string) =>
  page.locator(`.ct-row[data-id="${id}"] .ct-val`);
const btn = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

/** Width and height from a PNG's IHDR, after checking the signature */
function png(buf: Buffer) {
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** Hue distance in degrees, 0–180 */
const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/* ---------- picker and converter ---------- */

test("color-picker converts #1e90ff to every format", async ({ page }) => {
  await openTool(page, "/color-picker");
  const input = field(page, "Type or paste any colour");
  await input.fill("#1e90ff");
  await expect(row(page, "hex")).toHaveText("#1e90ff");
  await expect(row(page, "rgb")).toHaveText("rgb(30, 144, 255)");
  await expect(row(page, "hsl")).toHaveText("hsl(210, 100%, 56%)");
  await expect(row(page, "hsv")).toHaveText("hsv(210, 88%, 100%)");
  await expect(row(page, "hwb")).toHaveText("hwb(210 12% 0%)");
  await expect(row(page, "cmyk")).toHaveText("cmyk(88%, 44%, 0%, 0%)");
  await expect(row(page, "name")).toHaveText("dodgerblue");
  const oklch = (await row(page, "oklch").textContent()) ?? "";
  const m = /^oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)$/.exec(oklch);
  expect(m, oklch).not.toBeNull();
  expect(Math.abs(Number(m![1]) - 65.2)).toBeLessThan(0.15);
  expect(Math.abs(Number(m![2]) - 0.19)).toBeLessThan(0.003);
  expect(Math.abs(Number(m![3]) - 253.2)).toBeLessThan(0.2);
  // The colour is kept in the link
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("#1e90ff");

  // Loose numbers, names and modern syntax all read
  for (const [typed, hex] of [
    ["30 144 255", "#1e90ff"],
    ["rgb(30 144 255 / 50%)", "#1e90ff80"],
    ["hsl(0, 100%, 50%)", "#ff0000"],
    ["rebeccapurple", "#663399"],
    ["#09f", "#0099ff"],
    [oklch, "#1e90ff"],
  ]) {
    await input.fill(typed);
    await expect(row(page, "hex"), typed).toHaveText(hex);
  }
  await input.fill("not a colour");
  await expect(page.getByRole("alert")).toContainText("isn't a colour");

  // Keyboard on the picker area: Home = no saturation, so white at full brightness
  await input.fill("#1e90ff");
  await page.getByRole("slider", { name: "Saturation and brightness" }).focus();
  await page.keyboard.press("Home");
  await expect(row(page, "hex")).toHaveText("#ffffff");
  // The hue survives going through white
  await page.keyboard.press("End");
  await expect(row(page, "hex")).toHaveText("#0081ff");
});

test("color-picker opens the colour from the link", async ({ page }) => {
  await openTool(page, "/color-picker#e63946");
  await expect(page.locator(".ct-hero-hex")).toHaveText("#e63946");
  await expect(row(page, "rgb")).toHaveText("rgb(230, 57, 70)");
  // Tints and shades: nine cells, the base in the middle
  await expect(page.locator(".ct-ramp-cell")).toHaveCount(9);
  await expect(page.locator(".ct-ramp-cell.base")).toHaveAttribute(
    "aria-label",
    /#e63946/,
  );
});

/* ---------- mixer ---------- */

test("color-mixer mixes black and white in OKLab and sRGB", async ({
  page,
}) => {
  await openTool(page, "/color-mixer");
  await field(page, "First colour").fill("#000000");
  await field(page, "Second colour").fill("#ffffff");
  const result = page.locator(".ct-mix-result");
  // OKLab L = 0.5 → #636363; plain sRGB averages to #808080
  await expect(result).toHaveAttribute("data-hex", "#636363");
  await btn(page, "sRGB").click();
  await expect(result).toHaveAttribute("data-hex", "#808080");
  await expect(row(page, "css")).toHaveText(
    "color-mix(in srgb, #000000 50%, #ffffff)",
  );
  const steps = page.locator(".ct-steps:not(.thin) .ct-step");
  await expect(steps).toHaveCount(7);
  await expect(steps.first()).toHaveAttribute("data-hex", "#000000");
  await expect(steps.last()).toHaveAttribute("data-hex", "#ffffff");
  await expect(steps.nth(3)).toHaveAttribute("data-hex", "#808080");
});

/* ---------- palettes ---------- */

test("palette-generator schemes have the right hues", async ({ page }) => {
  await openTool(page, "/palette-generator");
  const cols = page.locator(".ct-pcol");
  const hues = async () =>
    (await cols.evaluateAll((els) =>
      els.map((e) => Number((e as HTMLElement).dataset.h)),
    )) as number[];

  await btn(page, "Complementary").click();
  await field(page, "Base colour").fill("#1e90ff");
  await expect(cols).toHaveCount(2);
  await expect(cols.first()).toHaveAttribute("data-hex", "#1e90ff");
  let h = await hues();
  expect(hueGap(h[0]!, h[1]!)).toBeGreaterThan(176);

  await btn(page, "Triadic").click();
  await expect(cols).toHaveCount(3);
  h = await hues();
  expect(Math.abs(hueGap(h[0]!, h[1]!) - 120)).toBeLessThan(4);
  expect(Math.abs(hueGap(h[0]!, h[2]!) - 120)).toBeLessThan(4);

  await btn(page, "Analogous").click();
  h = await hues();
  expect(Math.abs(hueGap(h[1]!, h[0]!) - 30)).toBeLessThan(4);
  expect(Math.abs(hueGap(h[1]!, h[2]!) - 30)).toBeLessThan(4);

  await btn(page, "Tetradic").click();
  await expect(cols).toHaveCount(4);
  await btn(page, "Split complementary").click();
  h = await hues();
  expect(Math.abs(hueGap(h[0]!, h[1]!) - 150)).toBeLessThan(4);

  await btn(page, "Monochromatic").click();
  await expect(cols).toHaveCount(5);
  await expect(page.locator('.ct-pcol[data-hex="#1e90ff"]')).toHaveCount(1);

  // Export: CSS variables and a real PNG
  await expect(page.locator(".ct-code pre")).toContainText("--palette-1:");
  const d = await download(page, () => page.locator(".ct-png").click());
  expect(d.suggestedFilename()).toBe("palette-kmra.png");
  expect(png(await bytes(d))).toEqual({ w: 1600, h: 900 });
});

test("palette-generator: Space makes a new palette and locks hold", async ({
  page,
}) => {
  await openTool(page, "/palette-generator");
  const cols = page.locator(".ct-pcol");
  await expect(cols).toHaveCount(5);
  const first = await cols.first().getAttribute("data-hex");
  await cols.first().getByRole("button", { name: /^Lock/ }).click();
  const before = await cols.evaluateAll((e) =>
    e.map((x) => (x as HTMLElement).dataset.hex),
  );
  await page.locator("h1").click();
  await page.keyboard.press("Space");
  await expect
    .poll(() =>
      cols.evaluateAll((e) => e.map((x) => (x as HTMLElement).dataset.hex)),
    )
    .not.toEqual(before);
  await expect(cols.first()).toHaveAttribute("data-hex", first!);
  await page.getByRole("button", { name: "Tailwind", exact: true }).click();
  await expect(page.locator(".ct-code pre")).toContainText("@theme {");
});

test("shades builds 50–950 with the base on its closest step", async ({
  page,
}) => {
  await openTool(page, "/shades");
  await field(page, "Base colour").fill("#1e90ff");
  const shades = page.locator(".ct-shade");
  await expect(shades).toHaveCount(11);
  const base = page.locator(".ct-shade.base");
  await expect(base).toHaveAttribute("data-hex", "#1e90ff");
  await expect(base).toHaveAttribute("data-step", "500");
  // Lightness falls step by step
  const lum = await shades.evaluateAll((els) =>
    els.map((e) => {
      const [r, g, b] = getComputedStyle(e)
        .backgroundColor.match(/\d+/g)!
        .map(Number);
      return r! * 0.2126 + g! * 0.7152 + b! * 0.0722;
    }),
  );
  for (let i = 1; i < lum.length; i++)
    expect(lum[i]!).toBeLessThan(lum[i - 1]!);
  await expect(page.locator(".ct-code pre")).toContainText(
    "--brand-500: #1e90ff;",
  );

  // A pale colour lands on 50, a dark one near the end
  await field(page, "Base colour").fill("#fef2f2");
  await expect(base).toHaveAttribute("data-step", "50");
  await field(page, "Base colour").fill("#1e293b");
  await expect(base).toHaveAttribute("data-step", /^(800|900|950)$/);

  await page.getByRole("button", { name: "Tailwind config" }).click();
  await field(page, "Colour name").fill("Ocean blue");
  await expect(page.locator(".ct-code pre")).toContainText('"ocean-blue": {');
  await btn(page, "OKLCH").click();
  await expect(page.locator(".ct-code pre")).toContainText('50: "oklch(');
});

/* ---------- checks ---------- */

test("contrast-checker: 21:1, #777 on white and the nearest passing colour", async ({
  page,
}) => {
  await openTool(page, "/contrast-checker");
  const ratio = page.locator("[data-ratio]");
  const check = (id: string) => page.locator(`[data-check="${id}"]`);
  await field(page, "Text colour").fill("#ffffff");
  await field(page, "Background colour").fill("#000000");
  await expect(ratio).toHaveText("21:1");
  await expect(page.locator('[data-check][data-pass="true"]')).toHaveCount(5);

  await field(page, "Text colour").fill("#777777");
  await field(page, "Background colour").fill("#ffffff");
  // 4.478…, shown without rounding up to a pass
  await expect(ratio).toHaveText("4.47:1");
  expect(Number(await ratio.getAttribute("data-ratio"))).toBeCloseTo(4.478, 2);
  await expect(check("aa-normal")).toHaveAttribute("data-pass", "false");
  await expect(check("aa-large")).toHaveAttribute("data-pass", "true");
  await expect(check("ui")).toHaveAttribute("data-pass", "true");
  await expect(check("aaa-normal")).toHaveAttribute("data-pass", "false");

  // The suggested text colour passes AA and keeps the grey
  const fix = page.locator('[data-fix="text-4.5"]');
  const hex = (await fix.getAttribute("data-hex"))!;
  expect(hex).toMatch(/^#([0-9a-f]{2})\1\1$/);
  await fix.click();
  await expect(check("aa-normal")).toHaveAttribute("data-pass", "true");
  expect(Number(await ratio.getAttribute("data-ratio"))).toBeGreaterThanOrEqual(
    4.5,
  );
  await expect(field(page, "Text colour")).toHaveValue(hex);

  await btn(page, "Swap text and background").click();
  await expect(field(page, "Text colour")).toHaveValue("#ffffff");
});

test("color-blindness simulates colours and an image", async ({ page }) => {
  await openTool(page, "/color-blindness");
  const list = page.getByLabel("Colours, one per line");
  await list.fill("#ff0000\n#ffffff");
  const sim = page.locator(".ct-cvd-sw.sim");
  await expect(sim).toHaveCount(2);
  // Machado 2009, severity 1, in linear RGB
  await page.locator('[data-type="protanopia"]').click();
  await expect(sim.first()).toHaveAttribute("data-hex", "#6d5f00");
  await expect(sim.nth(1)).toHaveAttribute("data-hex", "#ffffff");
  await page.locator('[data-type="achromatopsia"]').click();
  await expect(sim.first()).toHaveAttribute("data-hex", "#7f7f7f");
  await expect(page.locator(".ct-matrix tbody tr")).toHaveCount(2);

  // An image made here: red left half, green right half
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 32;
    const g = c.getContext("2d")!;
    g.fillStyle = "#ff0000";
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = "#00ff00";
    g.fillRect(32, 0, 32, 32);
    return c.toDataURL("image/png").split(",")[1]!;
  });
  await page.locator('[data-type="deuteranopia"]').click();
  await page.locator(".tool-area input[type=file]").setInputFiles({
    name: "two.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  });
  const out = page.locator('canvas.ct-sim[data-ready="1"]');
  await expect(out).toHaveAttribute("data-type", "deuteranopia");
  const px = await out.evaluate((c) => {
    const g = (c as HTMLCanvasElement).getContext("2d")!;
    return [
      ...g.getImageData(8, 8, 1, 1).data,
      ...g.getImageData(48, 8, 1, 1).data,
    ];
  });
  // Red seen with deuteranopia ≈ rgb(163, 144, 0); it isn't red any more
  expect(Math.abs(px[0]! - 163)).toBeLessThan(3);
  expect(Math.abs(px[1]! - 144)).toBeLessThan(3);
  expect(px[2]!).toBeLessThan(3);
  expect(Math.abs(px[0]! - px[1]!)).toBeLessThan(25);
  // Green turns yellowish too (≈ rgb(238, 215, 58)): red and green differ only in lightness
  expect(Math.abs(px[4]! - 238)).toBeLessThan(3);
  expect(Math.abs(px[5]! - 215)).toBeLessThan(3);
  expect(Math.abs(px[6]! - 58)).toBeLessThan(4);

  const d = await download(page, () => page.locator(".ct-dl").click());
  expect(d.suggestedFilename()).toBe(
    "two-color-blindness-deuteranopia-kmra.png",
  );
  expect(png(await bytes(d))).toEqual({ w: 64, h: 32 });
});

test("color-blindness: an image can be removed, back to the drop box", async ({
  page,
}) => {
  await openTool(page, "/color-blindness");
  await page
    .getByRole("group", { name: "Check" })
    .getByRole("button", { name: "An image" })
    .click();
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 16;
    const g = c.getContext("2d")!;
    g.fillStyle = "#3366cc";
    g.fillRect(0, 0, 16, 16);
    return c.toDataURL("image/png").split(",")[1]!;
  });
  await page.locator(".tool-area input[type=file]").setInputFiles({
    name: "photo-compress-kmra.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  });
  await expect(page.locator('canvas.ct-sim[data-ready="1"]')).toHaveCount(1);
  // A file that came from kmra.dev keeps one tag, not two
  const d = await download(page, () => page.locator(".ct-dl").click());
  expect(d.suggestedFilename()).toBe(
    "photo-compress-color-blindness-deuteranopia-kmra.png",
  );
  await page.getByRole("button", { name: "Remove image" }).click();
  await expect(page.locator("canvas.ct-sim")).toHaveCount(0);
  await expect(page.getByText("Drop an image here")).toBeVisible();
});

/* ---------- CSS ---------- */

test("gradient-generator writes CSS and a PNG", async ({ page }) => {
  await openTool(page, "/gradient-generator");
  const grad = page.locator(".ct-grad");
  await expect(grad).toHaveAttribute(
    "data-css",
    "linear-gradient(in oklch 135deg, #ff7a59 0%, #ffd166 50%, #5b8cff 100%)",
  );
  // The browser accepts it
  const ok = await page.evaluate(
    (v) => CSS.supports("background-image", v),
    (await grad.getAttribute("data-css"))!,
  );
  expect(ok).toBe(true);
  await expect(page.locator(".ct-code pre")).toContainText(
    "background: linear-gradient(135deg, #ff7a59 0%",
  );

  // Click the bar to add a stop; remove it again
  const handles = page.locator(".ct-handle");
  await expect(handles).toHaveCount(3);
  const bar = page.locator(".ct-bar");
  const box = (await bar.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
  await expect(handles).toHaveCount(4);
  await expect(field(page, "Position")).toHaveValue(/^2[45]$/);
  await btn(page, "Remove stop").click();
  await expect(handles).toHaveCount(3);

  await btn(page, "Radial").click();
  await expect(grad).toHaveAttribute(
    "data-css",
    /^radial-gradient\(in oklch circle at 50% 50%, /,
  );
  await btn(page, "Conic").click();
  await expect(grad).toHaveAttribute(
    "data-css",
    /^conic-gradient\(in oklch from 135deg at 50% 50%, /,
  );
  await btn(page, "sRGB").click();
  await expect(grad).toHaveAttribute(
    "data-css",
    /^conic-gradient\(from 135deg at 50% 50%, /,
  );

  await btn(page, "Linear").first().click();
  await page.getByLabel("Image size").selectOption({ label: "1080 × 1080" });
  const d = await download(page, () => page.locator(".ct-png").click());
  const buf = await bytes(d);
  expect(png(buf)).toEqual({ w: 1080, h: 1080 });
});

test("box-shadow presets, layers and inset", async ({ page }) => {
  await openTool(page, "/box-shadow");
  const box = page.locator(".ct-shadow-box");
  await btn(page, "Sharp").click();
  await expect(box).toHaveAttribute("data-shadow", "4px 4px 0px 0px #0f172a");
  const shadow = await box.evaluate((e) => getComputedStyle(e).boxShadow);
  expect(shadow).toContain("4px 4px 0px 0px");

  await page.getByRole("slider", { name: "Blur" }).fill("12");
  await expect(box).toHaveAttribute("data-shadow", "4px 4px 12px 0px #0f172a");
  await page.getByText("Inset (inside the box)").click();
  await expect(box).toHaveAttribute("data-shadow", /^inset 4px 4px 12px/);

  await btn(page, "Add layer").click();
  await expect(page.locator(".ct-layer")).toHaveCount(2);
  await expect(page.locator(".ct-code pre").first()).toContainText(
    "rgba(15, 23, 42, 0.12)",
  );
  await btn(page, "Dark").click();
  await expect(page.locator(".ct-shadow-stage")).toHaveClass(/dark/);
});

/* ---------- use cases, home, language ---------- */

test("every use-case page applies its preset", async ({ page }) => {
  const checks: Record<string, (p: Page) => Promise<void>> = {
    "hex-to-rgb": async (p) =>
      expect(p.locator(".ct-row").first()).toHaveAttribute("data-id", "rgb"),
    "rgb-to-hex": async (p) =>
      expect(p.locator(".ct-row").first()).toHaveAttribute("data-id", "hex"),
    "hex-to-hsl": async (p) =>
      expect(p.locator(".ct-row.on")).toHaveAttribute("data-id", "hsl"),
    "complementary-colors": async (p) =>
      expect(p.locator(".ct-palette")).toHaveAttribute(
        "data-mode",
        "complementary",
      ),
    "analogous-colors": async (p) =>
      expect(p.locator(".ct-palette")).toHaveAttribute(
        "data-mode",
        "analogous",
      ),
    "triadic-colors": async (p) =>
      expect(p.locator(".ct-palette")).toHaveAttribute("data-mode", "triadic"),
    "monochromatic-colors": async (p) =>
      expect(p.locator(".ct-palette")).toHaveAttribute(
        "data-mode",
        "monochromatic",
      ),
    "tailwind-color-palette": async (p) =>
      expect(p.locator(".ct-code pre")).toContainText("@theme {"),
    "linear-gradient": async (p) =>
      expect(p.locator(".ct-grad")).toHaveAttribute(
        "data-css",
        /^linear-gradient/,
      ),
  };
  expect(Object.keys(checks).sort()).toEqual(
    app.tasks.map((t) => t.slug).sort(),
  );
  for (const [slug, check] of Object.entries(checks)) {
    await openTool(page, `/${slug}`);
    await check(page);
  }
});

test("home page palette changes on Space and links to the generator", async ({
  page,
}) => {
  await page.goto("/");
  const cells = page.locator(".ct-strip-cell");
  await expect(cells).toHaveCount(5);
  await page.waitForLoadState("networkidle");
  const before = await cells.evaluateAll((e) =>
    e.map((x) => (x as HTMLElement).dataset.hex),
  );
  await page.locator("h1").click();
  await page.keyboard.press("Space");
  await expect
    .poll(() =>
      cells.evaluateAll((e) => e.map((x) => (x as HTMLElement).dataset.hex)),
    )
    .not.toEqual(before);
  await btn(page, "New palette").click();
  await expect(
    page.getByRole("link", { name: "Open the palette generator" }),
  ).toHaveAttribute("href", "/palette-generator");
});

test("Bangla pages translate the tools", async ({ page }) => {
  await openTool(page, "/bn/color-picker");
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.locator("h1")).toContainText("কালার পিকার");
  await expect(page.locator(".ct-card")).toContainText("রং");
  await expect(page.locator(".ct-card")).not.toContainText("Type or paste");
  await openTool(page, "/bn/contrast-checker");
  await expect(page.locator(".ct-card")).toContainText("লেখার রং");
});

test("every ready tool has a test above", () => {
  const tested = new Set([
    "color-picker",
    "color-mixer",
    "palette-generator",
    "shades",
    "contrast-checker",
    "color-blindness",
    "gradient-generator",
    "box-shadow",
  ]);
  const missing = app.tools.filter((t) => t.ready && !tested.has(t.slug));
  expect(missing.map((t) => t.slug)).toEqual([]);
});
