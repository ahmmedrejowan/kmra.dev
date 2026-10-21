/**
 * AudioTool workspace behaviour: output names drop an earlier kmra tag, Compress never makes a
 * file bigger (already under the target, or already at the chosen quality), the single-file Cut
 * can remove its file, and Merge lists the files it leaves out.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import {
  addFiles,
  bytes,
  download,
  expect,
  gen,
  openTool,
  test,
} from "../helpers.ts";
import { AUD } from "../fixtures/audiotool.ts";
import { VID } from "../fixtures/vidtool.ts";

test.describe.configure({ timeout: 180_000 });

const hasFfmpeg = (() => {
  try {
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
test.beforeEach(() => test.skip(!hasFfmpeg, "needs the generated sounds"));

const put = (page: Page, name: string, buffer: Buffer) =>
  page
    .locator(".tool-area input[type=file]")
    .first()
    .setInputFiles([{ name, mimeType: "audio/mpeg", buffer }]);
const pick = (page: Page, label: string, option: string | RegExp) =>
  page
    .getByRole("group", { name: label })
    .getByRole("button", { name: option })
    .click();

async function runJob(page: Page) {
  await expect(page.locator(".vt-plan")).toBeVisible({ timeout: 60_000 });
  await page.locator(".vt-run").click();
  await expect(page.locator(".vt-result")).toBeVisible({ timeout: 150_000 });
  const d = await download(page, () =>
    page.locator(".vt-download").first().click(),
  );
  return { buf: await bytes(d), name: d.suggestedFilename() };
}

test("a file from an earlier tool drops its kmra tag: song-trim-mono", async ({
  page,
}) => {
  await openTool(page, "/mono");
  await put(page, "aud-tone-trim-kmra.mp3", readFileSync(gen(AUD.mp3)));
  const r = await runJob(page);
  expect(r.name).toBe("aud-tone-trim-mono-kmra.mp3");
  expect(r.buf.length).toBeGreaterThan(1000);
});

test("compress never makes a file bigger", async ({ page }) => {
  const src = readFileSync(gen(AUD.mp3)); // 192 kbps, about 150 KB

  // Already under the target size: nothing to run
  await openTool(page, "/compress");
  await put(page, "aud-tone.mp3", src);
  await pick(page, "Compress by", "Target size");
  await page.locator("#vt-mb").fill("5");
  await expect(page.locator(".vt-wait")).toContainText("already under 5 MB", {
    timeout: 60_000,
  });
  await expect(page.locator(".vt-run")).toBeDisabled();

  // Down to 64 kbps, then that file again at 96 kbps: it wouldn't get smaller
  await openTool(page, "/compress");
  await put(page, "aud-tone.mp3", src);
  await pick(page, "Quality (kbps)", "64");
  const small = await runJob(page);
  expect(small.buf.length).toBeLessThan(src.length);

  await openTool(page, "/compress");
  await put(page, small.name, small.buf);
  await pick(page, "Quality (kbps)", "96");
  await expect(page.locator(".vt-wait")).toContainText(
    "already at 96 kbps or less",
    { timeout: 60_000 },
  );
  await expect(page.locator(".vt-run")).toBeDisabled();
  // A lower quality still works, and the name doesn't double the tag
  await pick(page, "Quality (kbps)", "32");
  const smaller = await runJob(page);
  expect(smaller.name).toBe("aud-tone-compress-compress-kmra.mp3");
  expect(smaller.buf.length).toBeLessThan(small.buf.length);
});

test("cut can remove its file and go back to the drop box", async ({
  page,
}) => {
  await openTool(page, "/trim");
  await addFiles(page, gen(AUD.mp3));
  await expect(page.locator(".vt-details dl")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Remove aud-tone.mp3" }).click();
  await expect(page.locator(".toolcard.solo")).toBeVisible();
  await expect(page.locator(".vt-details")).toHaveCount(0);
});

test("merge lists the files it leaves out and counts only usable ones", async ({
  page,
}) => {
  await openTool(page, "/merge");
  await addFiles(page, [gen(AUD.part1), gen(AUD.part2), gen(VID.webm)]);
  const left = page.locator(".vt-leftout");
  await expect(left).toContainText("vid-silent.webm: no sound", {
    timeout: 60_000,
  });
  await expect(page.locator(".vt-count")).toHaveText("2");
  await expect(page.locator(".vt-run")).toBeEnabled();
});
