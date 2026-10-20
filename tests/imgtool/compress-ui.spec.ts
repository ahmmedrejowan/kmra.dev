/**
 * The Simple editor's layout and Compress's promises: the editor keeps its size whatever the
 * settings show, size shortcuts only offer sizes below the image, compressing never hands back a
 * bigger file, a mistaken image can be removed, and 100% zoom is one image pixel per screen pixel.
 */
import type { Page } from "@playwright/test";
import { test, expect, gen } from "../helpers.ts";
import { info, save, start } from "./lib.ts";

const box = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((e) => {
    const r = e.getBoundingClientRect();
    return [Math.round(r.top + scrollY), Math.round(r.height), Math.round(r.width)];
  });
const chips = (page: Page) =>
  page
    .getByRole("group", { name: "Exact size" })
    .or(page.locator(".controls .ctl").filter({ hasText: "Exact size" }).locator(".chips"))
    .first()
    .getByRole("button")
    .allInnerTexts();

/** Put an in-page JPEG into the tool (a low-quality one, or a noisy one of a given size) */
async function addMade(page: Page, opts: { w: number; h: number; q: number; noise: number; name: string }): Promise<number> {
  return page.evaluate(async (o) => {
    const c = document.createElement("canvas");
    c.width = o.w;
    c.height = o.h;
    const g = c.getContext("2d")!;
    const gr = g.createLinearGradient(0, 0, o.w, o.h);
    gr.addColorStop(0, "#33aa77");
    gr.addColorStop(1, "#aa3377");
    g.fillStyle = gr;
    g.fillRect(0, 0, o.w, o.h);
    if (o.noise) {
      const d = g.getImageData(0, 0, o.w, o.h);
      let seed = 7;
      for (let i = 0; i < d.data.length; i += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const n = (seed / 4294967296 - 0.5) * o.noise;
        d.data[i]! += n;
        d.data[i + 1]! += n;
        d.data[i + 2]! += n;
      }
      g.putImageData(d, 0, 0);
    }
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", o.q));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], o.name, { type: "image/jpeg" }));
    const input = document.querySelector<HTMLInputElement>(".tool-area input[type=file]")!;
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return blob.size;
  }, opts);
}

test("the editor keeps its size when a setting adds a line", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page, "/compress", gen("photo.jpg"));
  const before = { card: await box(page, ".toolcard"), img: await box(page, ".stage .cmp") };
  await page.getByRole("button", { name: "Under 200 KB" }).click();
  await expect(page.locator(".controls")).toContainText("Best quality that fits");
  expect(await box(page, ".toolcard")).toEqual(before.card);
  expect(await box(page, ".stage .cmp")).toEqual(before.img);
  // The preview uses the editor's height, not a fixed 380 px
  expect(before.img[1]).toBeGreaterThan(420);
});

test("size shortcuts only offer sizes below the image", async ({ page }) => {
  await page.goto("/compress");
  await page.locator(".tool-area").waitFor();
  await addMade(page, { w: 640, h: 480, q: 0.92, noise: 70, name: "noisy.jpg" });
  await expect(page.locator(".controls")).toContainText(/640 × 480/);
  const kb = Number((await page.locator(".controls").innerText()).match(/([\d.]+) KB to/)?.[1]);
  expect(kb).toBeGreaterThan(50);
  expect(kb).toBeLessThan(200);
  const offered = await chips(page);
  expect(offered).toContain("Off");
  for (const t of offered.filter((t) => t !== "Off")) expect(Number(t.match(/\d+/)![0])).toBeLessThan(kb);
  expect(offered).not.toContain("Under 500 KB");
  expect(offered).not.toContain("Under 200 KB");
});

test("compressing never makes a file bigger: an already small image is kept", async ({ page }) => {
  await page.goto("/compress");
  await page.locator(".tool-area").waitFor();
  const original = await addMade(page, { w: 400, h: 300, q: 0.3, noise: 0, name: "tiny.jpg" });
  const panel = page.locator(".controls");
  await expect(panel).toContainText("you get your original file");
  await expect(panel).toContainText("Already under 50 KB.");
  expect(await chips(page)).toEqual(["Off"]);
  const { d, b } = await save(page);
  expect(b.length).toBe(original);
  expect(info(b)).toEqual({ type: "jpeg", w: 400, h: 300 });
  expect(d.suggestedFilename()).toBe("tiny-compress-kmra.jpg");
});

test("a mistaken image can be removed in Simple mode", async ({ page }) => {
  await start(page, "/compress", [gen("photo.jpg"), gen("small.jpg")]);
  await expect(page.locator(".filebar .fchip:not(.add)")).toHaveCount(2);
  await page.getByRole("button", { name: "Remove small.jpg" }).click();
  await expect(page.locator(".filebar .fchip:not(.add)")).toHaveCount(1);
  await page.getByRole("button", { name: "Remove photo.jpg" }).click();
  // The last one brings the drop box back
  await expect(page.locator(".tool-area .dropcard")).toBeVisible();
  await expect(page.locator(".tool-area .toolcard .stage .cmp")).toHaveCount(0);
});

test.describe("on a Retina screen", () => {
  test.use({ deviceScaleFactor: 2 });
  test("100% zoom is one image pixel per screen pixel", async ({ page }) => {
    await start(page, "/compress", gen("photo.jpg"));
    await page.locator(".zoombar").getByRole("button", { name: "Fit" }).click();
    await expect(page.locator(".zoombar")).toContainText("100%");
    // photo.jpg is 1600 px wide: 800 CSS px at a device pixel ratio of 2
    const [, , w] = await box(page, ".stage .cmp img");
    expect(w).toBe(800);
  });
});
