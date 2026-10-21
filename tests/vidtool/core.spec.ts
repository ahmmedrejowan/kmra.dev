/**
 * VidTool core tools on the real engine (@kmra/media): compress (quality and target size),
 * convert (remux, re-encode, AVI through ffmpeg.wasm), resize (each fit), trim (precise and
 * lossless), remove audio, video to MP3/M4A/WAV, progress, cancel, and every use-case page's
 * preset. Outputs are checked with the ffprobe command line (tests skip without it).
 */
import { hasFastEngine } from "./fast.ts";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
import { VID } from "../fixtures/vidtool.ts";

test.describe.configure({ timeout: 240_000 });

const hasProbe = (() => {
  try {
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

interface Probe {
  format: { format_name: string; duration: string };
  streams: {
    codec_type: string;
    codec_name: string;
    width?: number;
    height?: number;
  }[];
}

const dir = mkdtempSync(join(tmpdir(), "vidtool-"));
let n = 0;
function probe(
  buf: Buffer,
  ext: string,
): Probe & {
  video?: Probe["streams"][0];
  audio?: Probe["streams"][0];
  dur: number;
} {
  const p = join(dir, `out${n++}.${ext}`);
  writeFileSync(p, buf);
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
  ) as Probe;
  return {
    ...j,
    video: j.streams.find((s) => s.codec_type === "video"),
    audio: j.streams.find((s) => s.codec_type === "audio"),
    dur: Number(j.format.duration),
  };
}

/** Wait for the plan (output column), run, wait for the result; returns engine, size and the file */
async function runJob(page: Page, opts: { timeout?: number } = {}) {
  await expect(page.locator(".vt-plan")).toBeVisible({ timeout: 60_000 });
  await page.locator(".vt-run").click();
  const res = page.locator(".vt-result");
  await expect(res).toBeVisible({ timeout: opts.timeout ?? 180_000 });
  const engine = (await res.getAttribute("data-engine"))!;
  const size = Number(await res.getAttribute("data-bytes"));
  const d = await download(page, () => page.locator(".vt-download").click());
  const buf = await bytes(d);
  expect(buf.length).toBe(size);
  return { engine, size, buf, name: d.suggestedFilename() };
}

const pick = (page: Page, name: string | RegExp) =>
  page.locator(".vt-ws .seg button", { hasText: name }).first().click();

test.beforeEach(() =>
  test.skip(!hasProbe, "needs ffprobe to check the outputs"),
);

test("compress by quality makes a smaller MP4 with the fast engine", async ({
  page,
}) => {
  await openTool(page, "/compress");
  await addFiles(page, gen(VID.landscape));
  await expect(page.locator(".vt-details")).toContainText("1280 × 720");
  await expect(page.locator(".vt-plan")).toContainText("Hardware (fast)");
  const r = await runJob(page);
  expect(r.engine).toBe("webcodecs");
  expect(r.name).toBe("vid-landscape-compress-kmra.mp4");
  expect(r.size).toBeLessThan(2_023_318);
  const p = probe(r.buf, "mp4");
  expect(p.video?.codec_name).toBe("h264");
  expect(p.audio?.codec_name).toBe("aac");
  expect(Math.abs(p.dur - 6)).toBeLessThan(0.15);
  await expect(page.locator(".vt-sizes")).toContainText("−");
});

test("compress to a target size stays under it", async ({ page }) => {
  await openTool(page, "/compress");
  await addFiles(page, gen(VID.landscape));
  await pick(page, "Target size");
  await page.locator("#vt-mb").fill("0.6");
  await expect(page.locator(".vt-est")).toContainText("KB");
  const r = await runJob(page);
  expect(r.size).toBeLessThanOrEqual(600_000);
  expect(r.size).toBeGreaterThan(150_000);
  const p = probe(r.buf, "mp4");
  expect(Math.abs(p.dur - 6)).toBeLessThan(0.15);
});

test("MOV to MP4 copies the streams (lossless remux)", async ({ page }) => {
  await openTool(page, "/mov-to-mp4");
  await addFiles(page, gen(VID.mov));
  await expect(page.locator(".vt-plan")).toContainText("Lossless copy");
  const r = await runJob(page);
  expect(r.engine).toBe("copy");
  expect(r.name).toBe("vid-clip-convert-kmra.mp4");
  const p = probe(r.buf, "mp4");
  expect(p.format.format_name).toContain("mp4");
  expect(p.video?.codec_name).toBe("h264");
  expect(p.video?.width).toBe(640);
  expect(p.audio?.codec_name).toBe("aac");
  expect(Math.abs(p.dur - 4)).toBeLessThan(0.1);
});

test("convert re-encodes WebM to MP4 and joins a batch into a zip", async ({
  page,
}) => {
  await openTool(page, "/convert");
  await addFiles(page, [gen(VID.webm), gen(VID.mkv)]);
  await expect(page.locator(".vt-files li")).toHaveCount(2);
  await expect(page.locator(".vt-run")).toContainText("2 videos", {
    timeout: 30_000,
  });
  await page.locator(".vt-run").click();
  await expect(page.locator(".vt-zip")).toBeVisible({ timeout: 180_000 });
  // The first file (WebM, VP9) is re-encoded to H.264
  const d = await download(page, () => page.locator(".vt-download").click());
  const p = probe(await bytes(d), "mp4");
  expect(p.video?.codec_name).toBe("h264");
  expect(p.audio).toBeUndefined();
  expect(Math.abs(p.dur - 4)).toBeLessThan(0.15);
  const z = await download(page, () => page.locator(".vt-zip").click());
  expect(z.suggestedFilename()).toMatch(/\.zip$/);
});

test("AVI goes through ffmpeg.wasm (self-hosted) to MP4", async ({
  page,
  baseURL,
}) => {
  const off: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(baseURL!) && !/^(blob|data):/.test(u)) off.push(u);
  });
  await openTool(page, "/convert");
  await addFiles(page, gen(VID.avi));
  await expect(page.locator(".vt-details")).toContainText("AVI", {
    timeout: 120_000,
  });
  await expect(page.locator(".vt-plan")).toContainText("Lossless copy");
  const r = await runJob(page);
  expect(r.engine).toBe("copy"); // MPEG-4 video and MP3 sound both fit in MP4: ffmpeg remuxes
  const p = probe(r.buf, "mp4");
  expect(p.format.format_name).toContain("mp4");
  expect(Math.abs(p.dur - 3)).toBeLessThan(0.2);
  // WebM needs a re-encode: ffmpeg does it (the fast reader can't open AVI)
  await pick(page, "WebM");
  const w = await runJob(page);
  expect(w.engine).toBe("ffmpeg");
  const pw = probe(w.buf, "webm");
  expect(pw.video?.codec_name).toBe("vp8");
  expect(pw.audio?.codec_name).toBe("vorbis");
  expect(off).toEqual([]);
});

for (const [fit, label] of [
  ["cover", "Crop"],
  ["contain", "Pad"],
  ["pad-blur", "Blur"],
] as const) {
  test(`resize to 9:16 at 720p (${fit}) gives exactly 720×1280`, async ({
    page,
  }) => {
    await openTool(page, "/resize");
    await addFiles(page, gen(VID.landscape));
    await pick(page, "9:16");
    await pick(page, "720p");
    await page
      .locator(".vt-ws .seg button", { hasText: new RegExp(`^${label}$`) })
      .click();
    await expect(page.locator(".vt-plan")).toContainText("720 × 1280");
    const r = await runJob(page);
    const p = probe(r.buf, "mp4");
    expect(p.video?.width).toBe(720);
    expect(p.video?.height).toBe(1280);
    expect(Math.abs(p.dur - 6)).toBeLessThan(0.15);
  });
}

test("resize keeps the shape at a lower resolution (portrait)", async ({
  page,
}) => {
  await openTool(page, "/resize");
  await addFiles(page, gen(VID.portrait));
  await pick(page, "480p");
  const r = await runJob(page);
  const p = probe(r.buf, "mp4");
  expect(p.video?.width).toBe(480);
  expect(p.video?.height).toBe(854);
});

async function setRange(page: Page, a: string, b: string) {
  const start = page.getByRole("textbox", { name: "Start" });
  await start.fill(a);
  await start.press("Enter");
  const end = page.getByRole("textbox", { name: "End" });
  await end.fill(b);
  await end.press("Enter");
}

test("trim precisely re-encodes the chosen part", async ({ page }) => {
  await openTool(page, "/trim");
  test.skip(
    !(await hasFastEngine(page)),
    "this browser can't encode H.264 and AAC",
  );

  await addFiles(page, gen(VID.landscape));
  await expect(page.locator(".mp-strip")).toBeVisible({ timeout: 30_000 });
  await setRange(page, "1.2", "3.7");
  await expect(page.locator(".mp-len")).toContainText("0:02.5");
  const r = await runJob(page);
  expect(r.engine).toBe("webcodecs");
  expect(r.name).toBe("vid-landscape-trim-kmra.mp4");
  const p = probe(r.buf, "mp4");
  expect(Math.abs(p.dur - 2.5)).toBeLessThan(0.1);
});

test("trim losslessly copies from the keyframe", async ({ page }) => {
  await openTool(page, "/cut-video");
  await addFiles(page, gen(VID.landscape));
  await expect(page.locator(".mp-strip")).toBeVisible({ timeout: 30_000 });
  await setRange(page, "2", "4");
  await pick(page, "Lossless");
  await expect(page.locator(".vt-plan")).toContainText("Lossless copy");
  const r = await runJob(page);
  expect(r.engine).toBe("copy");
  const p = probe(r.buf, "mp4");
  expect(p.video?.codec_name).toBe("h264");
  // Keyframes every second: starts at 2 s exactly, so about 2 s long
  expect(p.dur).toBeGreaterThan(1.8);
  expect(p.dur).toBeLessThan(3.2);
});

test("remove audio copies the picture and leaves no sound", async ({
  page,
}) => {
  await openTool(page, "/mute");
  await addFiles(page, gen(VID.landscape));
  const r = await runJob(page);
  expect(r.engine).toBe("copy");
  expect(r.name).toBe("vid-landscape-mute-kmra.mp4");
  const p = probe(r.buf, "mp4");
  expect(p.audio).toBeUndefined();
  expect(p.video?.codec_name).toBe("h264");
  expect(Math.abs(p.dur - 6)).toBeLessThan(0.1);
});

test("video to MP3, M4A (copied) and WAV", async ({ page }) => {
  await openTool(page, "/video-to-mp3");
  await addFiles(page, gen(VID.landscape));
  // MP3 credits the LAME encoder (its licence asks for a link); the notice file is served
  const credit = page.locator(".mp3-credit");
  await expect(credit).toHaveText("MP3s are made with the LAME encoder.");
  await expect(credit.getByRole("link")).toHaveAttribute(
    "href",
    "https://lame.sourceforge.io/",
  );
  expect((await page.request.get("/NOTICE-mp3.txt")).ok()).toBe(true);
  const mp3 = await runJob(page);
  expect(mp3.name).toBe("vid-landscape-video-to-mp3-kmra.mp3");
  const p = probe(mp3.buf, "mp3");
  expect(p.audio?.codec_name).toBe("mp3");
  expect(p.video).toBeUndefined();
  expect(Math.abs(p.dur - 6)).toBeLessThan(0.15);

  await pick(page, "M4A");
  await expect(page.locator(".mp3-credit")).toHaveCount(0);
  await pick(page, "Original");
  const m4a = await runJob(page);
  expect(m4a.engine).toBe("copy");
  expect(probe(m4a.buf, "m4a").audio?.codec_name).toBe("aac");

  await pick(page, "WAV");
  const wav = await runJob(page);
  const pw = probe(wav.buf, "wav");
  expect(pw.audio?.codec_name).toBe("pcm_s16le");
  expect(Math.abs(pw.dur - 6)).toBeLessThan(0.1);
});

test("a video without sound can't be saved as MP3", async ({ page }) => {
  await openTool(page, "/video-to-mp3");
  await addFiles(page, gen(VID.webm));
  // Said once, in the output column
  await expect(page.locator(".vt-wait")).toContainText("no sound");
  await expect(page.getByText("This video has no sound to save.")).toHaveCount(
    1,
  );
  await expect(page.locator(".vt-run")).toBeDisabled();
});

test("progress is shown, cancel stops the job, and the next job works", async ({
  page,
}) => {
  // A slower job (1080×1920 with a blurred background), so there's time to cancel
  await openTool(page, "/instagram-reel-size");
  await addFiles(page, gen(VID.landscape));
  await pick(page, "Blur");
  await expect(page.locator(".vt-plan")).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => {
    const seen: string[] = ((window as unknown as { __pct: string[] }).__pct =
      []);
    new MutationObserver(() => {
      const b = document.querySelector(".vt-pline b")?.textContent;
      if (b && seen.at(-1) !== b) seen.push(b);
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  await page.locator(".vt-run").click();
  await expect(page.locator(".vt-progress")).toBeVisible();
  await page.locator(".vt-cancel").click();
  await expect(page.getByText("Cancelled")).toBeVisible();
  await expect(page.locator(".vt-run")).toBeEnabled();
  await expect(page.locator(".vt-result")).toHaveCount(0);
  // Again, to the end
  await page.locator(".vt-run").click();
  await expect(page.locator(".vt-result")).toBeVisible({ timeout: 120_000 });
  const pct = await page.evaluate(
    () => (window as unknown as { __pct: string[] }).__pct,
  );
  expect(pct.length).toBeGreaterThan(2);
  expect(new Set(pct).size).toBeGreaterThan(2);
});

test("cancelling ffmpeg.wasm mid-job, then the next job works", async ({
  page,
}) => {
  await openTool(page, "/convert");
  await addFiles(page, gen(VID.avi));
  await pick(page, "WebM");
  await expect(page.locator(".vt-plan")).toContainText("Compatible", {
    timeout: 120_000,
  });
  await page.locator(".vt-run").click();
  await expect(page.locator(".vt-progress")).toBeVisible();
  await page.locator(".vt-cancel").click();
  await expect(page.locator(".vt-run")).toBeEnabled({ timeout: 30_000 });
  const r = await runJob(page);
  expect(r.engine).toBe("ffmpeg");
  expect(probe(r.buf, "webm").video?.codec_name).toBe("vp8");
});

test("the home drop box hands the video to compress", async ({ page }) => {
  await page.goto("/");
  await page.locator("input[type=file]").first().setInputFiles(gen(VID.mov));
  await page.waitForURL(/\/compress$/);
  await expect(page.locator(".vt-details")).toContainText("640 × 360", {
    timeout: 30_000,
  });
});

const PRESETS: [string, (p: Page) => Promise<void>][] = [
  [
    "compress-video-for-whatsapp",
    (p) => expect(p.locator("#vt-mb")).toHaveValue("16"),
  ],
  [
    "compress-video-for-discord",
    (p) => expect(p.locator("#vt-mb")).toHaveValue("10"),
  ],
  [
    "compress-video-for-email",
    (p) => expect(p.locator("#vt-mb")).toHaveValue("20"),
  ],
  ...(["mov-to-mp4", "webm-to-mp4", "mkv-to-mp4"].map((s) => [
    s,
    (p: Page) =>
      expect(
        p.locator(".vt-ws .seg button", { hasText: /^MP4$/ }),
      ).toHaveAttribute("aria-pressed", "true"),
  ]) as [string, (p: Page) => Promise<void>][]),
  ...(["instagram-reel-size", "youtube-shorts-size", "tiktok-size"].map((s) => [
    s,
    async (p: Page) => {
      await expect(
        p.locator(".vt-ws .seg button", { hasText: /^9:16$/ }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(p.locator(".vt-plan")).toContainText("1080 × 1920");
    },
  ]) as [string, (p: Page) => Promise<void>][]),
  [
    "square-video",
    async (p) => {
      await expect(
        p.locator(".vt-ws .seg button", { hasText: /^1:1$/ }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(p.locator(".vt-plan")).toContainText("1080 × 1080");
    },
  ],
  ["cut-video", (p) => expect(p.locator(".mp-strip")).toBeVisible()],
];

for (const [slug, check] of PRESETS)
  test(`use case ${slug} applies its preset`, async ({ page }) => {
    await openTool(page, `/${slug}`);
    await addFiles(page, gen(VID.mov));
    await expect(page.locator(".vt-details dl")).toBeVisible({
      timeout: 60_000,
    });
    await check(page);
  });

test("Bangla page translates the workspace", async ({ page }) => {
  await openTool(page, "/bn/compress");
  await addFiles(page, gen(VID.mov));
  await expect(page.locator(".vt-plan")).toBeVisible({ timeout: 60_000 });
  const text = await page.locator(".vt-ws").innerText();
  for (const en of [
    "Video details",
    "Estimated size",
    "Hardware (fast)",
    "Compress",
    "Target size",
  ])
    expect(text, en).not.toContain(en);
});

/* The compatible engine (ffmpeg.wasm) does the same jobs: `?engine=ffmpeg` forces it */
test.describe("compatible engine", () => {
  test("compress by quality and to a target size", async ({ page }) => {
    await openTool(page, "/compress?engine=ffmpeg");
    await addFiles(page, gen(VID.landscape));
    const q = await runJob(page);
    expect(q.engine).toBe("ffmpeg");
    expect(q.size).toBeLessThan(2_023_318);
    const p = probe(q.buf, "mp4");
    expect(p.video?.codec_name).toBe("h264");
    expect(p.audio?.codec_name).toBe("aac");
    expect(Math.abs(p.dur - 6)).toBeLessThan(0.15);

    await pick(page, "Target size");
    await page.locator("#vt-mb").fill("0.6");
    const t = await runJob(page);
    expect(t.engine).toBe("ffmpeg");
    expect(t.size).toBeLessThanOrEqual(600_000);
  });

  test("resize with each fit gives the exact size", async ({ page }) => {
    await openTool(page, "/square-video?engine=ffmpeg");
    await addFiles(page, gen(VID.landscape));
    await pick(page, "720p");
    for (const label of ["Crop", "Pad", "Blur"]) {
      await page
        .locator(".vt-ws .seg button", { hasText: new RegExp(`^${label}$`) })
        .click();
      const r = await runJob(page);
      expect(r.engine).toBe("ffmpeg");
      const p = probe(r.buf, "mp4");
      expect([p.video?.width, p.video?.height], label).toEqual([720, 720]);
    }
  });

  test("trim (precise and lossless), mute, MP3 and WebM", async ({ page }) => {
    await openTool(page, "/trim?engine=ffmpeg");
    await addFiles(page, gen(VID.landscape));
    await expect(page.locator(".mp-strip")).toBeVisible({ timeout: 30_000 });
    await setRange(page, "1.2", "3.7");
    const precise = await runJob(page);
    expect(precise.engine).toBe("ffmpeg");
    expect(Math.abs(probe(precise.buf, "mp4").dur - 2.5)).toBeLessThan(0.1);
    await pick(page, "Lossless");
    const fast = await runJob(page);
    expect(fast.engine).toBe("copy");
    const pf = probe(fast.buf, "mp4");
    expect(pf.dur).toBeGreaterThan(2.3);
    expect(pf.dur).toBeLessThan(3.8);

    await openTool(page, "/mute?engine=ffmpeg");
    await addFiles(page, gen(VID.mov));
    const m = await runJob(page);
    expect(m.engine).toBe("copy");
    expect(probe(m.buf, "mov").audio).toBeUndefined();

    await openTool(page, "/video-to-mp3?engine=ffmpeg");
    await addFiles(page, gen(VID.landscape));
    const a = await runJob(page);
    expect(a.engine).toBe("ffmpeg");
    const pa = probe(a.buf, "mp3");
    expect(pa.audio?.codec_name).toBe("mp3");
    expect(Math.abs(pa.dur - 6)).toBeLessThan(0.15);

    await openTool(page, "/convert?engine=ffmpeg");
    await addFiles(page, gen(VID.mov));
    await pick(page, "WebM");
    const w = await runJob(page);
    expect(w.engine).toBe("ffmpeg");
    const pw = probe(w.buf, "webm");
    expect(pw.video?.codec_name).toBe("vp8");
    expect(pw.audio?.codec_name).toBe("vorbis");
  });

  test("speed: the fast engine against ffmpeg.wasm (720p, 6 s)", async ({
    page,
  }) => {
    const ms: Record<string, number> = {};
    for (const engine of ["webcodecs", "ffmpeg"]) {
      await openTool(page, `/compress?engine=${engine}`);
      await addFiles(page, gen(VID.landscape));
      // Twice: the first ffmpeg run also loads the engine
      for (const i of [0, 1]) {
        if (i) await pick(page, "Smaller");
        await expect(page.locator(".vt-plan")).toBeVisible({ timeout: 60_000 });
        await page.locator(".vt-run").click();
        await expect(page.locator(".vt-result")).toBeVisible({
          timeout: 180_000,
        });
        const s = /made in ([\d.]+) s/.exec(
          await page.locator(".vt-outinfo").innerText(),
        );
        ms[`${engine}#${i + 1}`] = Number(s?.[1]) * 1000;
      }
    }
    console.log("encode times (ms):", JSON.stringify(ms));
    expect(ms["webcodecs#2"]).toBeLessThan(ms["ffmpeg#2"]!);
  });
});
