/**
 * AudioTool on the real engine (@kmra/media): every tool, checked on its output with the ffprobe
 * and ffmpeg command lines (format, codec, length, channels, loudness), every use-case page, the
 * Bangla page, and a coverage check (every ready tool has a test here). Tests skip without ffmpeg.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { getApp } from "../../packages/registry/src/index.ts";
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
test.beforeEach(() => test.skip(!hasFfmpeg, "needs ffmpeg to check outputs"));

const dir = mkdtempSync(join(tmpdir(), "audiotool-"));
let n = 0;
function save(buf: Buffer, ext: string) {
  const p = join(dir, `out${n++}.${ext}`);
  writeFileSync(p, buf);
  return p;
}
function probe(buf: Buffer, ext: string) {
  const p = save(buf, ext);
  const j = JSON.parse(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      p,
    ]).toString(),
  ) as {
    format: { format_name: string; duration: string };
    streams: { codec_type: string; codec_name: string; channels?: number }[];
  };
  const audio = j.streams.find((s) => s.codec_type === "audio");
  return { ...j, audio, dur: Number(j.format.duration), path: p };
}
/** Mean loudness in dBFS (ffmpeg volumedetect) */
function meanDb(path: string): number {
  const err = execFileSync(
    "sh",
    ["-c", `ffmpeg -hide_banner -i "${path}" -af volumedetect -f null - 2>&1`],
  ).toString();
  return Number(/mean_volume: (-?[\d.]+) dB/.exec(err)?.[1] ?? NaN);
}

async function runJob(page: Page) {
  await expect(page.locator(".vt-plan")).toBeVisible({ timeout: 60_000 });
  await page.locator(".vt-run").click();
  const res = page.locator(".vt-result");
  await expect(res).toBeVisible({ timeout: 150_000 });
  const engine = (await res.getAttribute("data-engine"))!;
  const size = Number(await res.getAttribute("data-bytes"));
  const d = await download(page, () => page.locator(".vt-download").first().click());
  const buf = await bytes(d);
  expect(buf.length).toBe(size);
  return { engine, size, buf, name: d.suggestedFilename() };
}
const pick = (page: Page, label: string, option: string | RegExp) =>
  page
    .getByRole("group", { name: label })
    .getByRole("button", { name: option })
    .click();

/* ---------- convert, compress, video to audio ---------- */

test("convert MP3 to WAV, and WAV to M4A", async ({ page }) => {
  await openTool(page, "/convert");
  await addFiles(page, gen(AUD.mp3));
  await expect(page.locator(".vt-details")).toContainText("stereo");
  // MP3 is the default output: the LAME encoder is credited, with its notice file served
  await expect(page.locator(".mp3-credit")).toHaveText("MP3s are made with the LAME encoder.");
  expect((await page.request.get("/NOTICE-mp3.txt")).ok()).toBe(true);
  await pick(page, "Format", "WAV");
  await expect(page.locator(".mp3-credit")).toHaveCount(0);
  let r = await runJob(page);
  expect(r.name).toBe("aud-tone.wav");
  let p = probe(r.buf, "wav");
  expect(p.audio?.codec_name).toBe("pcm_s16le");
  expect(Math.abs(p.dur - 6)).toBeLessThan(0.15);

  await openTool(page, "/convert");
  await addFiles(page, gen(AUD.wav));
  await pick(page, "Format", "M4A");
  r = await runJob(page);
  p = probe(r.buf, "m4a");
  expect(p.audio?.codec_name).toBe("aac");
  expect(Math.abs(p.dur - 4)).toBeLessThan(0.15);
});

test("use cases convert M4A, FLAC (320 kbps) and OGG Opus to MP3", async ({ page }) => {
  for (const [slug, file, secs] of [
    ["/m4a-to-mp3", AUD.m4a, 5],
    ["/flac-to-mp3", AUD.flac, 3],
    ["/ogg-to-mp3", AUD.ogg, 3],
  ] as const) {
    await openTool(page, slug);
    await addFiles(page, gen(file));
    const r = await runJob(page);
    expect(r.name.endsWith(".mp3"), slug).toBe(true);
    const p = probe(r.buf, "mp3");
    expect(p.audio?.codec_name, slug).toBe("mp3");
    expect(Math.abs(p.dur - secs), slug).toBeLessThan(0.2);
  }
});

test("compress by quality as speech (mono) and to a target size", async ({ page }) => {
  await openTool(page, "/compress");
  await addFiles(page, gen(AUD.mp3));
  await pick(page, "Quality (kbps)", "48");
  await page.getByRole("checkbox", { name: "Speech (mono)" }).check();
  let r = await runJob(page);
  expect(r.name).toBe("aud-tone-compressed.mp3");
  let p = probe(r.buf, "mp3");
  expect(p.audio?.channels).toBe(1);
  expect(r.size).toBeLessThan(60_000);

  await openTool(page, "/compress");
  await addFiles(page, gen(AUD.wav));
  await pick(page, "Compress by", "Target size");
  await page.locator("#vt-mb").fill("0.05");
  r = await runJob(page);
  expect(r.size).toBeLessThanOrEqual(50_000);
  p = probe(r.buf, "mp3");
  expect(Math.abs(p.dur - 4)).toBeLessThan(0.15);
});

test("video to audio: MP3, and M4A copied without re-encoding", async ({ page }) => {
  await openTool(page, "/video-to-audio");
  await addFiles(page, gen(VID.landscape));
  await expect(page.locator(".vt-details")).toContainText("Left out");
  let r = await runJob(page);
  expect(r.name).toBe("vid-landscape.mp3");
  let p = probe(r.buf, "mp3");
  expect(p.streams.some((s) => s.codec_type === "video")).toBe(false);
  expect(Math.abs(p.dur - 6)).toBeLessThan(0.2);

  await pick(page, "Format", "M4A");
  r = await runJob(page);
  expect(r.engine).toBe("copy");
  p = probe(r.buf, "m4a");
  expect(p.audio?.codec_name).toBe("aac");
});

/* ---------- edit ---------- */

async function setRange(page: Page, a: string, b: string) {
  const start = page.getByRole("textbox", { name: "Start" });
  await start.fill(a);
  await start.press("Enter");
  const end = page.getByRole("textbox", { name: "End" });
  await end.fill(b);
  await end.press("Enter");
}

test("cut keeps the chosen part, on a waveform", async ({ page }) => {
  await openTool(page, "/trim");
  await addFiles(page, gen(AUD.mp3));
  await expect(page.locator(".mp-strip canvas")).toBeVisible();
  await expect(page.locator(".wp-wave canvas")).toBeVisible();
  await setRange(page, "1.0", "3.5");
  const r = await runJob(page);
  expect(r.name).toBe("aud-tone-cut.mp3");
  const p = probe(r.buf, "mp3");
  expect(Math.abs(p.dur - 2.5)).toBeLessThan(0.12);
});

test("the iPhone ringtone page makes a 30 s M4R", async ({ page }) => {
  // A 45 s song: the ringtone starts as its first 30 seconds
  const song = save(
    execFileSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
      "sine=frequency=330:duration=45", "-c:a", "libmp3lame", "-b:a", "128k",
      "-f", "mp3", "-",
    ]),
    "mp3",
  );
  await openTool(page, "/iphone-ringtone");
  await addFiles(page, song);
  await expect(page.locator(".vt-ws")).toContainText("M4R");
  const r = await runJob(page);
  expect(r.name).toMatch(/-ringtone\.m4r$/);
  const p = probe(r.buf, "m4a");
  expect(p.audio?.codec_name).toBe("aac");
  expect(Math.abs(p.dur - 30)).toBeLessThan(0.2);
});

test("join three files in order into one MP3", async ({ page }) => {
  await openTool(page, "/merge");
  await addFiles(page, [gen(AUD.part1), gen(AUD.part2), gen(AUD.part3)]);
  await expect(page.locator(".vt-total")).toContainText("0:07");
  await page.locator(".vt-run").click();
  const res = page.locator(".vt-result");
  await expect(res).toBeVisible({ timeout: 150_000 });
  const d = await download(page, () => page.locator(".vt-download").click());
  const p = probe(await bytes(d), "mp3");
  expect(d.suggestedFilename()).toBe("joined.mp3");
  expect(Math.abs(p.dur - 7)).toBeLessThan(0.2);
});

test("fade, speed (2×, 0.5×), reverse and pitch keep or change the length as they should", async ({
  page,
}) => {
  await openTool(page, "/fade");
  await addFiles(page, gen(AUD.mp3));
  let r = await runJob(page);
  let p = probe(r.buf, "mp3");
  expect(Math.abs(p.dur - 6)).toBeLessThan(0.15);
  // The first half second is much quieter than the original's
  const head = save(
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", p.path, "-t", "0.4", "-f", "wav", "-"]),
    "wav",
  );
  expect(meanDb(head)).toBeLessThan(meanDb(gen(AUD.mp3)) - 10);

  await openTool(page, "/speed");
  await addFiles(page, gen(AUD.mp3));
  await page.getByRole("button", { name: "2×" }).click();
  r = await runJob(page);
  expect(Math.abs(probe(r.buf, "mp3").dur - 3)).toBeLessThan(0.15);

  await openTool(page, "/slow-down-audio");
  await addFiles(page, gen(AUD.mp3));
  r = await runJob(page);
  expect(Math.abs(probe(r.buf, "mp3").dur - 8)).toBeLessThan(0.2);

  await openTool(page, "/reverse");
  await addFiles(page, gen(AUD.wav));
  r = await runJob(page);
  p = probe(r.buf, "wav");
  expect(r.name).toBe("aud-tone-reversed.wav");
  expect(Math.abs(p.dur - 4)).toBeLessThan(0.1);

  await openTool(page, "/pitch");
  await addFiles(page, gen(AUD.wav));
  await page.getByRole("button", { name: "+12" }).click();
  r = await runJob(page);
  expect(Math.abs(probe(r.buf, "wav").dur - 4)).toBeLessThan(0.15);
});

/* ---------- effects ---------- */

test("volume and normalize make a quiet recording louder", async ({ page }) => {
  const before = meanDb(gen(AUD.quiet));
  await openTool(page, "/make-audio-louder");
  await addFiles(page, gen(AUD.quiet));
  let r = await runJob(page);
  const louder = meanDb(probe(r.buf, "wav").path);
  expect(louder - before).toBeGreaterThan(5);
  expect(louder - before).toBeLessThan(7);

  await openTool(page, "/normalize");
  await addFiles(page, gen(AUD.quiet));
  r = await runJob(page);
  const norm = meanDb(probe(r.buf, "wav").path);
  expect(norm - before).toBeGreaterThan(10);
});

test("remove silence cuts the gaps; stereo to mono gives one channel", async ({ page }) => {
  await openTool(page, "/remove-silence");
  await addFiles(page, gen(AUD.gaps));
  let r = await runJob(page);
  const p = probe(r.buf, "wav");
  expect(p.dur).toBeLessThan(5);
  expect(p.dur).toBeGreaterThan(2.5);

  await openTool(page, "/mono");
  await addFiles(page, gen(AUD.mp3));
  r = await runJob(page);
  expect(probe(r.buf, "mp3").audio?.channels).toBe(1);
  await openTool(page, "/mono");
  await addFiles(page, gen(AUD.m4a));
  await expect(page.locator(".vt-out")).toContainText("already mono");
});

/* ---------- record and info ---------- */

test("audio info reads the details and compares files", async ({ page }) => {
  await openTool(page, "/audio-info");
  await addFiles(page, gen(AUD.flac));
  const table = page.locator(".vt-itable");
  await expect(table).toContainText("FLAC", { timeout: 30_000 });
  await expect(table).toContainText("44.1 kHz");
  await expect(table).toContainText("stereo");
  await expect(page.locator(".wp-wave")).toBeVisible();
  await addFiles(page, gen(AUD.m4a));
  await expect(page.locator(".vt-itable thead th")).toHaveCount(2);
  await expect(table).toContainText("mono");
  await expect(
    page.locator(".vt-itable tr.diff", { hasText: "Channels" }),
  ).toHaveCount(1);
});

/* ---------- pages ---------- */

const app = getApp("audiotool");

for (const t of app.tasks)
  test(`use case ${t.slug} opens its tool`, async ({ page }) => {
    await openTool(page, `/${t.slug}`);
    await expect(page.locator("h1")).toContainText(t.title);
    await expect(page.locator(".vt-ws")).toBeVisible();
  });

test("Bangla pages translate the tools", async ({ page }) => {
  await openTool(page, "/bn/convert");
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.locator(".vt-ws")).toContainText("ফাইল");
  await expect(page.locator("h1")).toContainText("কনভার্ট");
});

test("every ready tool has a test above", () => {
  const tested = new Set([
    "convert", "compress", "video-to-audio", "trim", "merge", "fade", "speed",
    "reverse", "pitch", "volume", "normalize", "remove-silence", "mono",
    "voice-recorder", "audio-info",
  ]);
  const missing = app.tools.filter((t) => t.ready && !tested.has(t.slug));
  expect(missing.map((t) => t.slug)).toEqual([]);
});
