/**
 * The Advanced workspace: a labelled rail of tools, the picked tool's own panel first, the rest
 * under "More edits", and the picked tool's rules (Convert gives the chosen format even when it's
 * bigger, Strip metadata cuts fields out without re-encoding).
 */
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test, expect, gen, download, bytes } from "../helpers.ts";
import { info, start, unzip } from "./lib.ts";

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
  await expect(ws.locator(".insp .more:not(.history)")).not.toHaveAttribute("open", "");
  await expect(ws.locator(".insp .more:not(.history) summary small")).toHaveCount(0);
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
  await expect(ws.locator(".insp .more:not(.history) summary small")).toHaveText("1 on");
  await expect(ws.locator(".meta-resave")).toContainText("saved again");
  await expect(ws.locator(".meta-count")).toHaveText("Removing 14 of 14 fields");
  await ws.getByRole("button", { name: "Clear other edits" }).click();
  await expect(ws.locator(".meta-resave")).toHaveCount(0);
  await expect(ws.locator(".meta-count")).toHaveText("Removing 13 of 14 fields");
});

test("Advanced opens empty at /editor?t=<tool>; choices wait for the photo; Back returns to Simple", async ({ page }) => {
  await page.goto("/convert");
  await page.evaluate(() => window.dispatchEvent(new Event("kmra:advanced")));
  const ws = page.getByRole("dialog", { name: "Advanced workspace" });
  await expect(ws).toBeVisible();
  await expect(page).toHaveURL(/\/editor\?t=convert$/);
  await expect(ws.locator(".ws-hint")).toBeVisible();
  await expect(ws.getByRole("button", { name: "Download", exact: true })).toBeDisabled();
  // Pick WebP before there's a photo; it applies when one arrives
  await ws.getByRole("group", { name: "Convert to" }).getByRole("button", { name: "WebP", exact: true }).click();
  await page.locator("main input[type=file]").first().setInputFiles(gen("photo.jpg"));
  await expect(ws).toContainText(/1600 × 1200, WebP/);
  // Removing the photo keeps the editor open, with its drop area
  await ws.getByRole("button", { name: "Remove photo.jpg" }).click();
  await expect(ws.locator(".ws-empty")).toBeVisible();
  await expect(ws.getByRole("group", { name: "Convert to" }).getByRole("button", { name: "WebP", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Picking another tool updates the address; Back goes to the Simple page
  await pick(ws, "Compress");
  await expect(page).toHaveURL(/\/editor\?t=compress$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/convert$/);
  await expect(ws).toBeHidden();
});

test("the editor opened for a tool goes back to that tool's page with the files", async ({ page }) => {
  await page.goto("/bn/editor?t=compress");
  // The workspace's own name is in Bangla here
  const ws = page.locator(".ws");
  await expect(ws.locator(".ws-tool h3")).toContainText(/[ঀ-৿]/);
  await page.locator("main input[type=file]").first().setInputFiles(gen("photo.jpg"));
  await expect(ws.locator(".ws-result")).toContainText(/১৬০০ × ১২০০|1600 × 1200/);
  // The mode switch in the header (Bangla labels here)
  await ws.locator(".mode-seg button").first().click();
  await expect(page).toHaveURL(/\/bn\/compress$/);
  await expect(page.locator(".controls .result")).toContainText(/JPEG/);
  await expect(page.locator(".filebar .fchip").first()).toContainText("photo.jpg");
});

test("changes can be hidden, removed, undone and redone; history jumps; a refresh keeps them", async ({ page }) => {
  const ws = await workspace(page, "/compress", "photo.jpg");
  const list = ws.locator(".change-list li");
  await pick(ws, "Watermark");
  await pick(ws, "Crop");
  await ws.locator(".ws-tool").getByRole("button", { name: "1:1", exact: true }).click();
  await expect(list).toHaveText(["Crop 1200 × 1200", "Watermark"]);
  await expect(ws).toContainText(/1200 × 1200, JPEG/);
  // Hide the crop: still listed, left out of the result
  await ws.getByRole("button", { name: "Hide Crop 1200 × 1200" }).click();
  await expect(list.first()).toHaveClass("off");
  await expect(ws).toContainText(/1600 × 1200, JPEG/);
  // History lists every step, the last one current
  const histBtn = ws.locator(".hist-btn");
  await histBtn.click();
  await expect(ws.locator(".hist-list button")).toHaveText(["Start", "Watermark added", "Crop added", "Crop hidden"]);
  await expect(ws.locator(".hist-list [aria-current]")).toHaveText("Crop hidden");
  // Escape closes the list, not the workspace
  await page.keyboard.press("Escape");
  await expect(ws.locator(".hist-pop")).toBeHidden();
  await expect(ws).toBeVisible();
  // Undo twice (button, then keyboard), redo once. The test browser reports Windows, so Ctrl
  await ws.getByRole("button", { name: "Undo" }).click();
  await expect(ws).toContainText(/1200 × 1200, JPEG/);
  await page.locator("body").press("Control+z");
  await expect(list).toHaveText(["Watermark"]);
  await page.locator("body").press("Control+Shift+z");
  await expect(list).toHaveText(["Crop 1200 × 1200", "Watermark"]);
  // Jump to the start, then back to the end
  await histBtn.click();
  await ws.locator(".hist-list button").first().click();
  await expect(list).toHaveCount(0);
  await ws.locator(".hist-list button").last().click();
  await expect(list.first()).toHaveClass("off");
  // Remove the watermark: a new step, and it's gone from the list
  await page.keyboard.press("Escape");
  await ws.getByRole("button", { name: "Remove Watermark" }).click();
  await expect(list).toHaveText(["Crop 1200 × 1200"]);
  await histBtn.click();
  await expect(ws.locator(".hist-list [aria-current]")).toHaveText("Watermark removed");
  await page.keyboard.press("Escape");
  // A refresh at /editor?t=crop brings the changes back (the photo needs adding again)
  await expect(page).toHaveURL(/\/editor\?t=crop$/);
  await page.reload();
  await expect(page.locator(".ws .change-list li")).toHaveText(["Crop"]);
  await expect(page.locator(".ws .change-list li").first()).toHaveClass("off");
  // Start over clears them
  await page.locator(".ws").getByRole("button", { name: "Start over" }).click();
  await expect(page.locator(".ws .change-list li")).toHaveCount(0);
});

test("batch: a change for one photo only, its own crop, and copying it to all", async ({ page }) => {
  await start(page, "/compress", [gen("photo.jpg"), gen("small.jpg")]);
  await page.evaluate(() => window.dispatchEvent(new Event("kmra:advanced")));
  const ws = page.getByRole("dialog", { name: "Advanced workspace" });
  await expect(ws).toContainText("2 photos");
  const list = ws.locator(".change-list li");
  // photo.jpg is on screen: give it a watermark for this photo only
  await pick(ws, "Watermark");
  await ws.getByRole("button", { name: "Watermark: all photos. Use for this photo only" }).click();
  await expect(list).toHaveText(["WatermarkThis photo"]);
  await expect(ws.locator(".queue .own-dot")).toHaveCount(1);
  // small.jpg doesn't have it, and its panel offers to add it
  await ws.getByRole("button", { name: /^small\.jpg/ }).click();
  await expect(list).toHaveCount(0);
  await expect(ws.locator(".fx-add")).toContainText("Not on this photo.");
  // The zip: only photo.jpg is watermarked (it differs from a plain copy)
  const d = await download(page, () => ws.getByRole("button", { name: "Zip of 2" }).click());
  const files = unzip(await bytes(d));
  expect(files.map((f) => f.name).sort()).toEqual(["photo-watermark-kmra.jpg", "small-watermark-kmra.jpg"]);
  // Back on photo.jpg: copy its changes to all photos
  await ws.getByRole("button", { name: /^photo\.jpg/ }).click();
  await expect(list).toHaveText(["WatermarkThis photo"]);
  await ws.getByRole("button", { name: "Copy this photo's changes to all photos" }).click();
  await expect(ws.locator(".queue .own-dot")).toHaveCount(2);
  await ws.getByRole("button", { name: /^small\.jpg/ }).click();
  await expect(list).toHaveText(["WatermarkThis photo"]);
  // History names the photo for a one-photo change
  await ws.locator(".hist-btn").click();
  await expect(ws.locator(".hist-list button")).toContainText(["Start", "Watermark added", "Watermark: this photo only", "Copied to all photos"]);
});

test("removing the last photo clears its crop and history; Simple mode lists changes from Advanced", async ({ page }) => {
  const ws = await workspace(page, "/compress", "photo.jpg");
  await pick(ws, "Crop");
  await ws.locator(".ws-tool").getByRole("button", { name: "1:1", exact: true }).click();
  await pick(ws, "Watermark");
  // Simple mode shows them under "Also applied", with undo
  await ws.locator(".mode-seg").getByRole("button", { name: "Simple" }).click();
  const also = page.locator(".controls .also");
  await expect(also).toContainText("Also applied");
  await expect(also.locator("li")).toHaveText(["Crop 1200 × 1200", "Watermark"]);
  await also.getByRole("button", { name: "Remove Watermark" }).click();
  await expect(also.locator("li")).toHaveText(["Crop 1200 × 1200"]);
  await also.getByRole("button", { name: "Undo" }).click();
  await expect(also.locator("li")).toHaveText(["Crop 1200 × 1200", "Watermark"]);
  // Back to Advanced, remove the photo: crop and history go, the watermark stays
  await page.evaluate(() => window.dispatchEvent(new Event("kmra:advanced")));
  await ws.getByRole("button", { name: "Remove photo.jpg" }).click();
  await expect(page.locator(".toast")).toContainText("Crop, blur areas and history cleared");
  await expect(ws.locator(".change-list li")).toHaveText(["Watermark"]);
  await expect(ws.getByRole("button", { name: "Undo" })).toBeDisabled();
});
