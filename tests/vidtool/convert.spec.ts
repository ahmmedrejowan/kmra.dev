/**
 * VidTool GIF, frames and recorder tools on the real engine (@kmra/media): video to GIF (size,
 * frame rate, length, frame count, loop flag, measured size estimate), GIF to video (fast engine
 * and ffmpeg.wasm, repeat, see-through background), extract frames (a still's colour, interval,
 * every N frames, scene changes, contact sheet, zip contents, the ffmpeg path) and the screen
 * recorder (with a stand-in screen share: start, pause, stop, sharing ended, convert to MP4).
 * Outputs are checked with the ffmpeg/ffprobe command line (tests skip without them).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
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

const hasTools = (() => {
  try {
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const dir = mkdtempSync(join(tmpdir(), "vidtool-convert-"));
let n = 0;
const save = (buf: Buffer, ext: string) => {
  const p = join(dir, `out${n++}.${ext}`);
  writeFileSync(p, buf);
  return p;
};

interface Stream {
  codec_type: string;
  codec_name: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  avg_frame_rate?: string;
  nb_read_frames?: string;
}

function probe(buf: Buffer, ext: string) {
  const p = save(buf, ext);
  const j = JSON.parse(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-count_frames",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      p,
    ]).toString(),
  ) as { format: { format_name: string; duration: string }; streams: Stream[] };
  const v = j.streams.find((s) => s.codec_type === "video");
  return {
    format: j.format.format_name,
    dur: Number(j.format.duration),
    video: v,
    audio: j.streams.find((s) => s.codec_type === "audio"),
    frames: Number(v?.nb_read_frames ?? 0),
    fps: (() => {
      const [a, b] = (v?.avg_frame_rate ?? "0/1").split("/").map(Number);
      return b ? a! / b : 0;
    })(),
  };
}

/** RGB of a 2×2 patch at (x, y) of a picture (or a video's first frame) */
function rgb(path: string, x: number, y: number): [number, number, number] {
  const out = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    path,
    "-frames:v",
    "1",
    "-vf",
    `crop=w=2:h=2:x=${x}:y=${y}`,
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "-",
  ]);
  return [out[0]!, out[1]!, out[2]!];
}

/** Which of the fixture's colours a pixel is closest to */
function colourName([r, g, b]: [number, number, number]): string {
  const ref: [string, number[]][] = [
    ["red", [255, 0, 0]],
    ["green", [0, 255, 0]],
    ["blue", [0, 0, 255]],
    ["white", [255, 255, 255]],
    ["black", [0, 0, 0]],
  ];
  return ref
    .map(
      ([n, c]) =>
        [n, (c[0]! - r) ** 2 + (c[1]! - g) ** 2 + (c[2]! - b) ** 2] as const,
    )
    .sort((x, y) => x[1] - y[1])[0]![0];
}

/** Unpack a zip with the unzip command; returns the file paths, sorted */
function unzip(buf: Buffer): string[] {
  const z = save(buf, "zip");
  const to = mkdtempSync(join(dir, "zip-"));
  execFileSync("unzip", ["-q", z, "-d", to]);
  return readdirSync(to)
    .sort()
    .map((f) => join(to, f));
}

/** Plan visible, run, result visible; returns the downloaded file */
async function runJob(page: Page) {
  await expect(page.locator(".vt-plan")).toBeVisible({ timeout: 60_000 });
  await page.locator(".vt-run").click();
  const res = page.locator(".vt-result");
  await expect(res).toBeVisible({ timeout: 180_000 });
  const engine = (await res.getAttribute("data-engine")) ?? "";
  const d = await download(page, () => page.locator(".vt-download").click());
  return { engine, buf: await bytes(d), name: d.suggestedFilename() };
}

const pick = (page: Page, name: string | RegExp) =>
  page.locator(".vt-ws .seg button", { hasText: name }).first().click();

test.beforeEach(() =>
  test.skip(!hasTools, "needs ffmpeg and ffprobe to check the outputs"),
);

/* ---------- video to GIF ---------- */

test("video to GIF: first 5 s at 480 px and 12 fps, looping, size near the estimate", async ({
  page,
}) => {
  await openTool(page, "/video-to-gif");
  await addFiles(page, gen(VID.landscape));
  await expect(page.locator(".vt-plan")).toContainText("480 × 270", {
    timeout: 60_000,
  });
  await expect(page.locator(".mp-len")).toContainText("0:05.0");
  await expect(page.locator(".vt-gif-facts")).toContainText("60 frames");
  // The measured estimate (a sample made with ffmpeg.wasm) replaces the first guess
  const est = page.locator(".vt-est");
  const first = Number(await est.getAttribute("data-bytes"));
  await expect
    .poll(async () => Number(await est.getAttribute("data-bytes")), {
      timeout: 120_000,
    })
    .not.toBe(first);
  const estimate = Number(await est.getAttribute("data-bytes"));

  const r = await runJob(page);
  expect(r.name).toBe("vid-landscape.gif");
  expect(r.engine).toBe("ffmpeg");
  await expect(page.locator(".vt-stage img.vt-gif")).toBeVisible();
  const p = probe(r.buf, "gif");
  expect(p.format).toBe("gif");
  expect(p.video?.width).toBe(480);
  expect(p.video?.height).toBe(270);
  expect(Math.abs(p.dur - 5)).toBeLessThan(0.2);
  expect(Math.abs(p.frames - 60)).toBeLessThanOrEqual(2);
  expect(Math.abs(p.fps - 12)).toBeLessThan(0.6);
  expect(r.buf.includes(Buffer.from("NETSCAPE2.0"))).toBe(true);
  expect(Math.abs(r.buf.length - estimate) / r.buf.length).toBeLessThan(0.3);

  // Play once, smaller and slower: 320 px, 10 fps, 2 s, flat colours
  await page.locator(".vt-ws .toggle", { hasText: "Loop forever" }).click();
  await pick(page, "320 px");
  await pick(page, "10 fps");
  await pick(page, /^Off$/);
  await page.getByLabel("End", { exact: true }).last().fill("0:02.0");
  await page.getByLabel("End", { exact: true }).last().press("Enter");
  await expect(page.locator(".mp-len")).toContainText("0:02.0");
  const o = await runJob(page);
  const q = probe(o.buf, "gif");
  expect(q.video?.width).toBe(320);
  expect(q.video?.height).toBe(180);
  expect(Math.abs(q.dur - 2)).toBeLessThan(0.2);
  expect(Math.abs(q.frames - 20)).toBeLessThanOrEqual(1);
  expect(o.buf.includes(Buffer.from("NETSCAPE2.0"))).toBe(false);
  expect(o.buf.length).toBeLessThan(r.buf.length);
});

test("use case mp4-to-gif opens the GIF maker", async ({ page }) => {
  await openTool(page, "/mp4-to-gif");
  await addFiles(page, gen(VID.mov));
  await expect(page.locator(".vt-ws.vt-video-to-gif .vt-plan")).toContainText(
    "GIF",
    { timeout: 60_000 },
  );
  await expect(page.locator(".vt-run")).toHaveText("Make GIF");
});

/* ---------- GIF to video ---------- */

test("GIF to MP4 on the fast engine: smaller, even size, plays, repeats", async ({
  page,
}) => {
  await openTool(page, "/gif-to-video");
  await expect(
    page.getByRole("button", { name: "Choose GIFs" }),
  ).toBeVisible();
  await addFiles(page, gen(VID.gif));
  await expect(page.locator(".vt-details")).toContainText("480 × 270", {
    timeout: 60_000,
  });
  await expect(page.locator(".vt-stage img.vt-gif")).toBeVisible();
  await expect(page.locator(".vt-plan")).toContainText("Hardware (fast)");
  const r = await runJob(page);
  expect(r.engine).toBe("webcodecs");
  expect(r.name).toBe("vid-anim.mp4");
  const p = probe(r.buf, "mp4");
  expect(p.video?.codec_name).toBe("h264");
  expect(p.video?.pix_fmt).toMatch(/^yuvj?420p$/);
  expect(p.video!.width! % 2).toBe(0);
  expect(p.video!.height! % 2).toBe(0);
  expect(p.video?.width).toBe(480);
  expect(Math.abs(p.dur - 3)).toBeLessThan(0.15);
  expect(p.frames).toBeGreaterThanOrEqual(44);
  const gifSize = (await import("node:fs")).statSync(gen(VID.gif)).size;
  expect(r.buf.length * 4).toBeLessThan(gifSize);
  await expect(page.locator(".vt-sizes em.down")).toBeVisible();

  await pick(page, "3×");
  const t = await runJob(page);
  expect(Math.abs(probe(t.buf, "mp4").dur - 9)).toBeLessThan(0.2);
});

test("GIF to MP4 with ffmpeg.wasm, repeated twice", async ({ page }) => {
  await openTool(page, "/gif-to-video?engine=ffmpeg");
  await addFiles(page, gen(VID.gif));
  await pick(page, "2×");
  const r = await runJob(page);
  expect(r.engine).toBe("ffmpeg");
  const p = probe(r.buf, "mp4");
  expect(p.video?.codec_name).toBe("h264");
  expect(p.video?.pix_fmt).toBe("yuv420p");
  expect(Math.abs(p.dur - 6)).toBeLessThan(0.3);
});

for (const engine of ["auto", "ffmpeg"])
  test(`see-through GIF parts get the background colour (${engine})`, async ({
    page,
  }) => {
    await openTool(
      page,
      `/gif-to-video${engine === "ffmpeg" ? "?engine=ffmpeg" : ""}`,
    );
    await addFiles(page, gen(VID.alpha));
    const white = save((await runJob(page)).buf, "mp4");
    expect(colourName(rgb(white, 6, 6))).toBe("white");
    expect(colourName(rgb(white, 70, 46))).toBe("blue");
    await pick(page, "Black");
    const black = save((await runJob(page)).buf, "mp4");
    expect(colourName(rgb(black, 6, 6))).toBe("black");
  });

/* ---------- extract frames ---------- */

const colours = (paths: string[]) =>
  paths.map((p) => colourName(rgb(p, 10, 10)));

async function saveFrames(page: Page) {
  await page.locator(".vt-run").click();
  await expect(page.locator(".vt-result")).toBeVisible({ timeout: 120_000 });
}

test("extract frames: the frame on screen as PNG and JPG", async ({ page }) => {
  await openTool(page, "/extract-frames");
  await addFiles(page, gen(VID.colors));
  await expect(page.locator(".vt-details")).toContainText("320 × 180", {
    timeout: 60_000,
  });
  const time = page.getByLabel("Time", { exact: true }).last();
  await time.fill("0:01.5");
  await time.press("Enter");
  await saveFrames(page);
  await expect(page.locator(".vt-result img.vt-still")).toBeVisible();
  const d = await download(page, () => page.locator(".vt-download").click());
  expect(d.suggestedFilename()).toBe("vid-colors-0m01.5s.png");
  const png = save(await bytes(d), "png");
  expect(colourName(rgb(png, 10, 10))).toBe("green");
  expect(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=p=0",
      png,
    ])
      .toString()
      .trim(),
  ).toBe("320,180");

  await time.fill("0:02.5");
  await time.press("Enter");
  await pick(page, /^JPG$/);
  await saveFrames(page);
  const j = await download(page, () => page.locator(".vt-download").click());
  expect(j.suggestedFilename()).toMatch(/\.jpg$/);
  expect(colourName(rgb(save(await bytes(j), "jpg"), 10, 10))).toBe("blue");
});

test("extract frames: every second, every 25 frames and at scene changes, in a zip", async ({
  page,
}) => {
  await openTool(page, "/extract-frames");
  await addFiles(page, gen(VID.colors));
  await expect(page.locator(".vt-details dl")).toBeVisible({ timeout: 60_000 });
  const expected = ["red", "green", "blue", "white"];

  await pick(page, "Every few seconds");
  await expect(page.locator(".vt-strip .lbl")).toContainText("4");
  await expect(page.locator(".vt-run")).toHaveText("Save 4 frames");
  await saveFrames(page);
  await expect(page.locator(".vt-result")).toHaveAttribute("data-count", "4");
  const z = await download(page, () => page.locator(".vt-zip").click());
  expect(z.suggestedFilename()).toBe("vid-colors-frames.zip");
  const files = unzip(await bytes(z));
  expect(files.map((f) => f.split("/").pop())).toEqual([
    "vid-colors-001.png",
    "vid-colors-002.png",
    "vid-colors-003.png",
    "vid-colors-004.png",
  ]);
  expect(colours(files)).toEqual(expected);

  await pick(page, "Every few frames");
  // Every 30 frames at 25 fps: 0, 1.2, 2.4, 3.6 s
  await expect(page.locator(".vt-run")).toHaveText("Save 4 frames");
  await saveFrames(page);
  const f = unzip(
    await bytes(await download(page, () => page.locator(".vt-zip").click())),
  );
  expect(colours(f)).toEqual(["red", "green", "blue", "white"]);

  await pick(page, "Scene changes");
  await expect(page.locator(".vt-run")).toHaveText("Save 4 frames", {
    timeout: 60_000,
  });
  const strip = page.locator(".vt-strip li span");
  await expect(strip).toHaveText(["0:00.0", "0:01.0", "0:02.0", "0:03.0"]);
  await saveFrames(page);
  const s = unzip(
    await bytes(await download(page, () => page.locator(".vt-zip").click())),
  );
  expect(colours(s)).toEqual(expected);
});

test("extract frames: contact sheet, and the limit note", async ({ page }) => {
  await openTool(page, "/extract-frames");
  await addFiles(page, gen(VID.colors));
  await expect(page.locator(".vt-details dl")).toBeVisible({ timeout: 60_000 });
  await pick(page, "Every few seconds");
  await pick(page, "Contact sheet");
  await pick(page, /^4$/);
  await expect(page.locator(".vt-run")).toHaveText("Make contact sheet");
  await saveFrames(page);
  const d = await download(page, () => page.locator(".vt-download").click());
  expect(d.suggestedFilename()).toBe("vid-colors-contact-sheet.png");
  const sheet = save(await bytes(d), "png");
  // 4 tiles of 400 px, 10 px gaps, 24 px margins; one row of 225 px under a 64 px title
  expect(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=p=0",
      sheet,
    ])
      .toString()
      .trim(),
  ).toBe(`${24 * 2 + 4 * 400 + 3 * 10},${24 * 2 + 64 + 225}`);
  expect(colourName(rgb(sheet, 24 + 200, 24 + 64 + 40))).toBe("red");
  expect(colourName(rgb(sheet, 24 + 410 + 200, 24 + 64 + 40))).toBe("green");
  expect(colourName(rgb(sheet, 24 + 3 * 410 + 200, 24 + 64 + 40))).toBe(
    "white",
  );

  // 4 s every 0.02 s is 200 frames: more than a sheet holds
  await page.locator("#vt-every").fill("0.02");
  await expect(page.locator(".vt-limit")).toBeVisible();
  await expect(page.locator(".vt-plan")).toContainText("120");
});

test("extract frames from an AVI goes through ffmpeg.wasm", async ({
  page,
}) => {
  await openTool(page, "/extract-frames");
  await addFiles(page, gen(VID.avi));
  await expect(page.locator(".vt-details")).toContainText("AVI", {
    timeout: 120_000,
  });
  await pick(page, "Every few seconds");
  await page.locator(".vt-chips .chip", { hasText: /^2 s$/ }).click();
  await expect(page.locator(".vt-run")).toHaveText("Save 2 frames");
  await saveFrames(page);
  await expect(page.locator(".vt-result")).toHaveAttribute("data-count", "2");
  const f = unzip(
    await bytes(await download(page, () => page.locator(".vt-zip").click())),
  );
  expect(f).toHaveLength(2);
  // Scene detection uses ffmpeg's own filter here: the first frame always counts
  await pick(page, "Scene changes");
  await expect(page.locator(".vt-strip li span").first()).toHaveText("0:00.0", {
    timeout: 120_000,
  });
  const size = execFileSync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=p=0",
    f[0]!,
  ])
    .toString()
    .trim();
  expect(size).toBe("320,240");
});

/* ---------- screen recorder ---------- */

/**
 * A stand-in for the screen share: a canvas that changes colour every second (red, green, blue,
 * white …) with a tone, so recordings can be checked. `window.__share` is its video track.
 */
async function fakeShare(
  page: Page,
  opts: { webm?: boolean; deny?: boolean } = {},
) {
  await page.addInitScript((o) => {
    const md = navigator.mediaDevices;
    if (o.webm) {
      const orig = MediaRecorder.isTypeSupported.bind(MediaRecorder);
      MediaRecorder.isTypeSupported = (t: string) =>
        !t.startsWith("video/mp4") && orig(t);
    }
    md.getDisplayMedia = async () => {
      if (o.deny) throw new DOMException("denied", "NotAllowedError");
      const c = document.createElement("canvas");
      c.width = 640;
      c.height = 360;
      const ctx = c.getContext("2d")!;
      const colors = ["#f00", "#0f0", "#00f", "#fff"];
      const t0 = performance.now();
      const draw = () => {
        const s = Math.floor((performance.now() - t0) / 1000);
        ctx.fillStyle = colors[s % 4]!;
        ctx.fillRect(0, 0, 640, 360);
        ctx.fillStyle = "#000";
        ctx.fillRect(((performance.now() - t0) / 5) % 640, 150, 40, 40);
      };
      draw();
      setInterval(draw, 33);
      const stream = c.captureStream(30);
      const ac = new AudioContext();
      const osc = ac.createOscillator();
      const dest = ac.createMediaStreamDestination();
      osc.connect(dest);
      osc.start();
      stream.addTrack(dest.stream.getAudioTracks()[0]!);
      (window as unknown as { __share: MediaStreamTrack }).__share =
        stream.getVideoTracks()[0]!;
      return stream;
    };
  }, opts);
}

async function record(page: Page, ms: number) {
  await page.locator(".vt-ws .toggle", { hasText: "Count down" }).click();
  await page.locator(".vt-start").click();
  await expect(page.locator(".vt-rec-state")).toHaveText("Recording");
  await page.waitForTimeout(ms);
}

test("screen recorder: the page may capture the screen and the microphone", async ({
  page,
}) => {
  const res = await page.goto("/screen-recorder");
  const policy = res!.headers()["permissions-policy"]!;
  expect(policy).toContain("display-capture=(self)");
  expect(policy).toContain("microphone=(self)");
  expect(policy).toContain("camera=()");
  await expect(page.locator(".vt-start")).toBeVisible();
  await expect(page.locator(".vt-plan")).toContainText(/MP4|WebM/);
});

test("screen recorder: record 3 s, stop, download a playable video", async ({
  page,
}) => {
  await fakeShare(page);
  await openTool(page, "/screen-recorder");
  await record(page, 3000);
  await expect(page.locator(".vt-elapsed")).not.toHaveText("0:00");
  await page.locator(".vt-stop").click();
  await expect(page.locator(".vt-result")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".vt-stage video")).toBeVisible();
  const d = await download(page, () => page.locator(".vt-download").click());
  expect(d.suggestedFilename()).toMatch(
    /^screen-recording-\d{4}-\d\d-\d\d-\d{4}\.(mp4|webm)$/,
  );
  const ext = d.suggestedFilename().split(".").pop()!;
  const p = probe(await bytes(d), ext);
  expect(p.video?.width).toBe(640);
  expect(p.audio).toBeTruthy();
  expect(Math.abs(p.dur - 3)).toBeLessThan(0.5);
});

test("screen recorder: WebM with pause, then convert to MP4", async ({
  page,
}) => {
  await fakeShare(page, { webm: true });
  await openTool(page, "/screen-recorder");
  await expect(page.locator(".vt-plan")).toContainText("WebM");
  await record(page, 1500);
  await page.locator(".vt-pause").click();
  await expect(page.locator(".vt-rec-state")).toHaveText("Paused");
  await page.waitForTimeout(1500);
  await page.locator(".vt-resume").click();
  await page.waitForTimeout(1000);
  await page.locator(".vt-stop").click();
  await expect(page.locator(".vt-result")).toBeVisible({ timeout: 60_000 });
  const w = await download(page, () => page.locator(".vt-download").click());
  expect(w.suggestedFilename()).toMatch(/\.webm$/);
  const pw = probe(await bytes(w), "webm");
  expect(pw.format).toContain("webm");
  expect(Math.abs(pw.dur - 2.5)).toBeLessThan(0.5);

  await page.locator(".vt-to-mp4").click();
  await expect(page.locator(".vt-download")).toHaveText(/MP4/, {
    timeout: 120_000,
  });
  const m = await download(page, () => page.locator(".vt-download").click());
  expect(m.suggestedFilename()).toMatch(/\.mp4$/);
  const pm = probe(await bytes(m), "mp4");
  expect(pm.video?.codec_name).toBe("h264");
  expect(Math.abs(pm.dur - 2.5)).toBeLessThan(0.5);
});

test("screen recorder: ending the share stops the recording", async ({
  page,
}) => {
  await fakeShare(page);
  await openTool(page, "/screen-recorder");
  await record(page, 1500);
  await page.evaluate(() =>
    (window as unknown as { __share: MediaStreamTrack }).__share.dispatchEvent(
      new Event("ended"),
    ),
  );
  await expect(page.locator(".vt-result")).toBeVisible({ timeout: 60_000 });
});

test("screen recorder: countdown, and a cancelled share explains what to do", async ({
  page,
}) => {
  await fakeShare(page, { deny: true });
  await openTool(page, "/screen-recorder");
  await page.locator(".vt-start").click();
  await expect(page.locator(".vt-problem")).toContainText(
    "Sharing was cancelled",
  );
});

test("screen recorder: the countdown runs before recording starts", async ({
  page,
}) => {
  await fakeShare(page);
  await openTool(page, "/screen-recorder");
  await page.locator(".vt-start").click();
  await expect(page.locator(".vt-countdown")).toHaveText("3");
  await expect(page.locator(".vt-rec-state")).toHaveText("Recording", {
    timeout: 6000,
  });
  await page.locator(".vt-stop").click();
  await expect(page.locator(".vt-result")).toBeVisible({ timeout: 60_000 });
});

test("Bangla pages translate the new tools", async ({ page }) => {
  await openTool(page, "/bn/extract-frames");
  await addFiles(page, gen(VID.colors));
  await expect(page.locator(".vt-details dl")).toBeVisible({ timeout: 60_000 });
  const text = await page.locator(".vt-ws").innerText();
  for (const en of ["Save this frame", "Every few seconds", "Scene changes"])
    expect(text, en).not.toContain(en);
  await openTool(page, "/bn/screen-recorder");
  const rec = await page.locator(".vt-ws").innerText();
  for (const en of ["Start recording", "Microphone", "Frame rate"])
    expect(rec, en).not.toContain(en);
});
