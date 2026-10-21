/**
 * The Advanced workspace: a labelled rail of tools, the picked tool's own panel first, the rest
 * under "More edits", and the picked tool's rules (Convert gives the chosen format even when it's
 * bigger, Strip metadata cuts fields out without re-encoding).
 */
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test, expect, gen, download, bytes } from "../helpers.ts";
import { info, start } from "./lib.ts";

const workspace = async (page: Page, path: string, file: string) => {
  await start(page, path, gen(file));
  await page.evaluate(() => window.dispatchEvent(new Event("kmra:advanced")));
  const ws = page.getByRole("dialog", { name: "Advanced workspace" });
  await expect(ws).toBeVisible();
  return ws;
};
const pick = (ws: ReturnType<Page["getByRole"]>, name: string) =>
  ws.getByRole("navigation", { name: "Tools" }).getByRole("button", { name, exact: true }).click();
const saveWs = (page: Page, ws: ReturnType<Page["getByRole"]>) =>
  download(page, () => ws.getByRole("button", { name: "Download", exact: true }).click());

/** Everything from the first scan (SOS) on: the compressed picture itself */
const scan = (b: Uint8Array) => {
  for (let i = 2; i < b.length - 1; i++) if (b[i] === 0xff && b[i + 1] === 0xda) return Buffer.from(b.subarray(i));
  return Buffer.alloc(0);
};

test("rail names every tool, and the page's tool opens with its own panel", async ({ page }) => {
  const ws = await workspace(page, "/compress", "photo.jpg");
  const rail = ws.getByRole("navigation", { name: "Tools" });
  await expect(rail.getByRole("button", { name: "Compress", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(rail).toContainText("Strip metadata");
  await expect(ws.locator(".ws-tool h3")).toHaveText("Compress");
  await expect(ws.locator(".ws-tool")).toContainText("Exact size");
  // Other edits are folded away, with nothing on yet
  await expect(ws.locator(".insp .more")).not.toHaveAttribute("open", "");
  await expect(ws.locator(".insp .more summary small")).toHaveCount(0);
});

test("Convert from the Compress workspace gives the chosen format, even when bigger", async ({ page }) => {
  const ws = await workspace(page, "/compress", "photo.png");
  await pick(ws, "Convert");
  await expect(ws.locator(".ws-tool h3")).toHaveText("Convert");
  const to = ws.getByRole("group", { name: "Convert to" });
  // The file's own format isn't offered
  await expect(to.getByRole("button", { name: "PNG", exact: true })).toHaveCount(0);
  await to.getByRole("button", { name: "BMP", exact: true }).click();
  await expect(ws).toContainText(/800 × 600, BMP/);
  await expect(ws).toContainText("BMP has no quality setting");
  const d = await saveWs(page, ws);
  expect(d.suggestedFilename()).toBe("photo-convert-kmra.bmp");
  expect(info(await bytes(d))).toEqual({ type: "bmp", w: 800, h: 600 });
});

test("Strip metadata in the workspace lists fields and keeps the picture as it is", async ({ page }) => {
  const ws = await workspace(page, "/compress", "meta.jpg");
  await pick(ws, "Strip metadata");
  await expect(ws.locator(".meta-count")).toHaveText("Removing 13 of 14 fields");
  await expect(ws.locator(".meta-resave")).toHaveCount(0);
  const d = await saveWs(page, ws);
  expect(d.suggestedFilename()).toBe("meta-strip-metadata-kmra.jpg");
  const b = await bytes(d);
  expect(b.includes("SN-48213377")).toBe(false);
  expect(scan(b).equals(scan(readFileSync(gen("meta.jpg"))))).toBe(true);
});

test("Strip metadata with other edits on says everything goes, and can clear them", async ({ page }) => {
  const ws = await workspace(page, "/strip-metadata", "meta.jpg");
  await pick(ws, "Watermark");
  await expect(ws.locator(".ws-tool h3")).toHaveText("Watermark");
  await pick(ws, "Strip metadata");
  await expect(ws.locator(".insp .more summary small")).toHaveText("1 on");
  await expect(ws.locator(".meta-resave")).toContainText("saved again");
  await expect(ws.locator(".meta-count")).toHaveText("Removing 14 of 14 fields");
  await ws.getByRole("button", { name: "Clear other edits" }).click();
  await expect(ws.locator(".meta-resave")).toHaveCount(0);
  await expect(ws.locator(".meta-count")).toHaveText("Removing 13 of 14 fields");
});
