/**
 * AudioTool voice recorder with Chromium's fake microphone (a steady tone): record, pause, resume,
 * stop, then save as MP3 and WAV, checked with ffprobe. Skips without ffmpeg.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bytes, download, expect, openTool, test } from "../helpers.ts";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
test.beforeEach(() => test.skip(!hasFfmpeg, "needs ffmpeg to check outputs"));
test.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
});

const dir = mkdtempSync(join(tmpdir(), "audiotool-rec-"));
let n = 0;
function probe(buf: Buffer, ext: string) {
  const p = join(dir, `rec${n++}.${ext}`);
  writeFileSync(p, buf);
  const j = JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", p]).toString(),
  ) as { format: { duration: string }; streams: { codec_type: string; codec_name: string }[] };
  return {
    audio: j.streams.find((s) => s.codec_type === "audio"),
    dur: Number(j.format.duration),
  };
}
const pick = (page: import("@playwright/test").Page, label: string, option: string) =>
  page.getByRole("group", { name: label }).getByRole("button", { name: option }).click();

test("records the (fake) microphone, then saves MP3 and WAV", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await openTool(page, "/voice-recorder");
  await page.getByRole("button", { name: "Record" }).click();
  await expect(page.locator(".at-rec.on")).toBeVisible();
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.locator(".wp-wave")).toBeVisible();
  let d = await download(page, () =>
    page.getByRole("button", { name: "Save as MP3" }).click(),
  );
  let p = probe(await bytes(d), "mp3");
  expect(d.suggestedFilename()).toMatch(/^recording-\d{8}-\d{4}\.mp3$/);
  expect(p.audio?.codec_name).toBe("mp3");
  expect(p.dur).toBeGreaterThan(2);
  expect(p.dur).toBeLessThan(5);
  await pick(page, "Format", "WAV");
  d = await download(page, () =>
    page.getByRole("button", { name: "Save as WAV" }).click(),
  );
  p = probe(await bytes(d), "wav");
  expect(p.audio?.codec_name).toBe("pcm_s16le");
});
