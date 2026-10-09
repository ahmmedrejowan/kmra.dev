/**
 * VidTool edit tools on the real engine (@kmra/media): speed (fast engine with time-stretched or
 * tape-style sound, and ffmpeg.wasm), rotate and flip (display rotation only, re-encoded, both
 * engines; the picture is checked by where a red corner box ends up), merge (copied when the clips
 * are encoded alike, else fitted to the first clip's size), video info (details, tags, the
 * location note, comparing files) and the use-case presets. Outputs are checked with the ffmpeg
 * and ffprobe command line (tests skip without them).
 */
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

const hasTools = (() => {
  try {
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

interface Stream {
  codec_type: string;
  codec_name: string;
  width?: number;
  height?: number;
  duration?: string;
  side_data_list?: { rotation?: number }[];
}
interface Probe {
  format: { duration: string; tags?: Record<string, string> };
  streams: Stream[];
}

const dir = mkdtempSync(join(tmpdir(), "vidtool-edit-"));
let n = 0;
function save(buf: Buffer, ext: string) {
  const p = join(dir, `out${n++}.${ext}`);
  writeFileSync(p, buf);
  return p;
}

function probe(path: string) {
  const j = JSON.parse(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      path,
    ]).toString(),
  ) as Probe;
  const video = j.streams.find((s) => s.codec_type === "video");
  return {
    ...j,
    video,
    audio: j.streams.find((s) => s.codec_type === "audio"),
    dur: Number(j.format.duration),
    rotation: video?.side_data_list?.find((d) => d.rotation !== undefined)
      ?.rotation,
  };
}

/** Where the red box is in a frame (as players show it: rotation applied), 0–1 */
function redAt(path: string, t = 0.5) {
  const ppm = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-ss",
    String(t),
    "-i",
    path,
    "-frames:v",
    "1",
    "-f",
    "image2pipe",
    "-vcodec",
    "ppm",
    "-",
  ]);
  const head = /^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(
    ppm.subarray(0, 32).toString("latin1"),
  )!;
  const w = Number(head[1]);
  const h = Number(head[2]);
  const px = ppm.subarray(head[0].length);
  let sx = 0;
  let sy = 0;
  let c = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      if (px[i]! > 150 && px[i + 1]! < 90 && px[i + 2]! < 90) {
        sx += x;
        sy += y;
        c++;
      }
    }
  return { w, h, x: sx / c / w, y: sy / c / h, share: c / (w * h) };
}

/** Main frequency of the sound (zero crossings of the first channel), Hz */
function pitch(path: string) {
  const raw = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    path,
    "-ac",
    "1",
    "-ar",
    "48000",
    "-f",
    "s16le",
    "-",
  ]);
  const s = new Int16Array(raw.buffer, raw.byteOffset, raw.length >> 1);
  // Skip the edges (fades, priming)
  const a = Math.round(s.length * 0.15);
  const b = Math.round(s.length * 0.85);
  let z = 0;
  for (let i = a + 1; i < b; i++) if (s[i - 1]! < 0 && s[i]! >= 0) z++;
  return z / ((b - a) / 48000);
}

/** Wait for the plan, run, wait for the result; returns engine, the file and its path */
async function runJob(page: Page) {
  await expect(page.locator(".vt-plan")).toBeVisible({ timeout: 60_000 });
  await page.locator(".vt-run").click();
  const res = page.locator(".vt-result");
  await expect(res).toBeVisible({ timeout: 200_000 });
  const engine = (await res.getAttribute("data-engine"))!;
  const size = Number(await res.getAttribute("data-bytes"));
  const d = await download(page, () => page.locator(".vt-download").click());
  const buf = await bytes(d);
  expect(buf.length).toBe(size);
  const name = d.suggestedFilename();
  return { engine, buf, name, path: save(buf, name.split(".").pop()!) };
}

const pick = (page: Page, name: string | RegExp) =>
  page.locator(".vt-ws .seg button", { hasText: name }).first().click();

test.beforeEach(() =>
  test.skip(!hasTools, "needs ffmpeg and ffprobe to check the outputs"),
);

/* ---------- speed ---------- */

test("speed 2× on the fast engine halves the length, sound keeps its pitch", async ({
  page,
}) => {
  await openTool(page, "/speed");
  await addFiles(page, gen(VID.landscape));
  await expect(page.locator(".vt-plan")).toContainText("Hardware (fast)", {
    timeout: 60_000,
  });
  await expect(page.locator(".vt-newlen")).toContainText("0:03.0");
  const r = await runJob(page);
  expect(r.engine).toBe("webcodecs");
  expect(r.name).toBe("vid-landscape-2x.mp4");
  const p = probe(r.path);
  expect(Math.abs(p.dur - 3)).toBeLessThan(0.1);
  expect(p.video?.codec_name).toBe("h264");
  expect(p.audio?.codec_name).toBe("aac");
  expect(Math.abs(Number(p.audio?.duration) - 3)).toBeLessThan(0.15);
  expect(Math.abs(pitch(r.path) - 440)).toBeLessThan(15);
});

test("speed 0.5× on the fast engine doubles the length; tape-style sound drops an octave", async ({
  page,
}) => {
  await openTool(page, "/slow-motion-video");
  await addFiles(page, gen(VID.mov));
  await expect(
    page.locator(".vt-speed .chip", { hasText: /^0\.5×$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  const r = await runJob(page);
  expect(r.engine).toBe("webcodecs");
  const p = probe(r.path);
  expect(Math.abs(p.dur - 8)).toBeLessThan(0.1);
  expect(Math.abs(pitch(r.path) - 440)).toBeLessThan(15);

  await page.getByLabel("Keep the natural pitch").uncheck();
  const t = await runJob(page);
  expect(t.engine).toBe("webcodecs");
  expect(Math.abs(probe(t.path).dur - 8)).toBeLessThan(0.1);
  expect(Math.abs(pitch(t.path) - 220)).toBeLessThan(10);
});

test("speed 4× without sound, and a silent video", async ({ page }) => {
  await openTool(page, "/speed");
  await addFiles(page, gen(VID.landscape));
  await page.locator(".vt-speed .chip", { hasText: /^4×$/ }).click();
  await pick(page, "Remove");
  const r = await runJob(page);
  expect(r.engine).toBe("webcodecs");
  const p = probe(r.path);
  expect(p.audio).toBeUndefined();
  expect(Math.abs(p.dur - 1.5)).toBeLessThan(0.1);

  await openTool(page, "/speed");
  await addFiles(page, gen(VID.webm));
  await page.locator(".vt-speed .chip", { hasText: /^0\.25×$/ }).click();
  const w = await runJob(page);
  expect(w.name).toBe("vid-silent-0.25x.webm");
  const pw = probe(w.path);
  expect(pw.video?.codec_name).toBe("vp9");
  expect(Math.abs(pw.dur - 16)).toBeLessThan(0.15);
});

test("speed on the compatible engine (atempo, tape)", async ({ page }) => {
  await openTool(page, "/speed-up-video?engine=ffmpeg");
  await addFiles(page, gen(VID.mov));
  await expect(
    page.locator(".vt-speed .chip", { hasText: /^2×$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  const r = await runJob(page);
  expect(r.engine).toBe("ffmpeg");
  const p = probe(r.path);
  expect(Math.abs(p.dur - 2)).toBeLessThan(0.1);
  expect(Math.abs(pitch(r.path) - 440)).toBeLessThan(15);

  await page.locator(".vt-speed .chip", { hasText: /^0\.5×$/ }).click();
  await page.getByLabel("Keep the natural pitch").uncheck();
  const t = await runJob(page);
  expect(t.engine).toBe("ffmpeg");
  expect(Math.abs(probe(t.path).dur - 8)).toBeLessThan(0.1);
  expect(Math.abs(pitch(t.path) - 220)).toBeLessThan(10);
});

/* ---------- rotate ---------- */

test("rotate 90° right by display rotation: copied, location left out", async ({
  page,
}) => {
  await openTool(page, "/rotate-video-90");
  await addFiles(page, gen(VID.corner));
  await expect(
    page.locator(".vt-turns button", { hasText: "90° right" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".vt-plan")).toContainText("Lossless copy", {
    timeout: 60_000,
  });
  // The preview turns with CSS
  await expect(page.locator(".vt-turn.side")).toBeVisible();
  const r = await runJob(page);
  expect(r.engine).toBe("copy");
  expect(r.name).toBe("vid-corner-rotated.mp4");
  const p = probe(r.path);
  expect(Math.abs(p.rotation ?? 0)).toBe(90);
  expect(p.video?.codec_name).toBe("h264");
  expect(p.audio?.codec_name).toBe("aac");
  expect(JSON.stringify(p.format.tags ?? {})).not.toContain("40.7128");
  const red = redAt(r.path);
  expect([red.w, red.h]).toEqual([180, 320]);
  expect(red.x).toBeGreaterThan(0.7);
  expect(red.y).toBeLessThan(0.3);
});

test("rotate and flip re-encoded on the fast engine", async ({ page }) => {
  await openTool(page, "/rotate");
  await addFiles(page, gen(VID.corner));
  await pick(page, "Re-encode");
  const r = await runJob(page);
  expect(r.engine).toBe("webcodecs");
  const p = probe(r.path);
  expect([p.video?.width, p.video?.height]).toEqual([180, 320]);
  expect(p.rotation ?? 0).toBe(0);
  let red = redAt(r.path);
  expect(red.x).toBeGreaterThan(0.7);
  expect(red.y).toBeLessThan(0.3);

  // Flip only (no turn): re-encoded, red box to the top right
  await page.locator(".vt-turns button", { hasText: "None" }).click();
  await pick(page, "Horizontal");
  const h = await runJob(page);
  expect(h.name).toBe("vid-corner-flipped.mp4");
  red = redAt(h.path);
  expect([red.w, red.h]).toEqual([320, 180]);
  expect(red.x).toBeGreaterThan(0.7);
  expect(red.y).toBeLessThan(0.3);

  await pick(page, "Vertical");
  red = redAt((await runJob(page)).path);
  expect(red.x).toBeLessThan(0.3);
  expect(red.y).toBeGreaterThan(0.7);

  // 90° left with a vertical flip = transpose: the box stays top-left
  await page.locator(".vt-turns button", { hasText: "90° left" }).click();
  red = redAt((await runJob(page)).path);
  expect([red.w, red.h]).toEqual([180, 320]);
  expect(red.x).toBeLessThan(0.3);
  expect(red.y).toBeLessThan(0.3);
});

test("rotate on the compatible engine (copy with rotation, and re-encode)", async ({
  page,
}) => {
  await openTool(page, "/rotate?engine=ffmpeg");
  await addFiles(page, gen(VID.corner));
  await page.locator(".vt-turns button", { hasText: "90° left" }).click();
  const q = await runJob(page);
  expect(q.engine).toBe("copy");
  const pq = probe(q.path);
  expect(Math.abs(pq.rotation ?? 0)).toBe(90);
  expect(JSON.stringify(pq.format.tags ?? {})).not.toContain("40.7128");
  let red = redAt(q.path);
  expect([red.w, red.h]).toEqual([180, 320]);
  expect(red.x).toBeLessThan(0.3);
  expect(red.y).toBeGreaterThan(0.7);

  await page.locator(".vt-turns button", { hasText: "180°" }).click();
  await pick(page, "Re-encode");
  const e = await runJob(page);
  expect(e.engine).toBe("ffmpeg");
  red = redAt(e.path);
  expect([red.w, red.h]).toEqual([320, 180]);
  expect(red.x).toBeGreaterThan(0.7);
  expect(red.y).toBeGreaterThan(0.7);
});

/* ---------- merge ---------- */

test("merge three clips encoded alike: copied, lengths add up", async ({
  page,
}) => {
  await openTool(page, "/merge");
  await addFiles(page, [gen(VID.part1), gen(VID.part2), gen(VID.part3)]);
  await expect(page.locator(".vt-clip:not(.vt-clip-add)")).toHaveCount(3);
  await expect(page.locator(".vt-total")).toContainText("0:07.0", {
    timeout: 30_000,
  });
  await expect(page.locator(".vt-plan")).toContainText("Lossless copy", {
    timeout: 60_000,
  });
  const r = await runJob(page);
  expect(r.engine).toBe("copy");
  expect(r.name).toBe("merged.mp4");
  const p = probe(r.path);
  expect(Math.abs(p.dur - 7)).toBeLessThan(0.2);
  expect([p.video?.width, p.video?.height]).toEqual([640, 360]);
  expect(p.audio?.codec_name).toBe("aac");
  expect(Math.abs(Number(p.audio?.duration) - 7)).toBeLessThan(0.2);
  // Decodes from start to end without errors
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-xerror",
    "-i",
    r.path,
    "-f",
    "null",
    "-",
  ]);
});

test("merge clips of different sizes: fitted to the first clip's size", async ({
  page,
}) => {
  await openTool(page, "/merge");
  await addFiles(page, [gen(VID.portrait), gen(VID.mov)]);
  await expect(page.locator(".vt-plan")).toContainText("720 × 1280", {
    timeout: 60_000,
  });
  // Reorder with the keyboard: the MOV first, so the output takes its size
  const firstCard = page.locator(".vt-clip-pick").first();
  await firstCard.focus();
  await firstCard.press("Alt+ArrowRight");
  await expect(page.locator(".vt-clip-name").first()).toHaveText(VID.mov);
  await expect(page.locator(".vt-plan")).toContainText("640 × 360");
  await expect(page.locator(".vt-plan")).toContainText("Compatible");
  await pick(page, "Blur");
  const r = await runJob(page);
  expect(r.engine).toBe("ffmpeg");
  const p = probe(r.path);
  expect([p.video?.width, p.video?.height]).toEqual([640, 360]);
  expect(Math.abs(p.dur - 8)).toBeLessThan(0.3);
  expect(p.audio?.codec_name).toBe("aac");

  // The arrow buttons move clips too
  await page
    .getByRole("button", { name: `Move ${VID.portrait} earlier` })
    .click();
  await expect(page.locator(".vt-clip-name").first()).toHaveText(VID.portrait);
  await expect(page.locator(".vt-result")).toHaveCount(0);
});

/* ---------- video info ---------- */

test("video info shows the details, tags and a location note", async ({
  page,
}) => {
  await openTool(page, "/video-info");
  await addFiles(page, gen(VID.corner));
  const table = page.locator(".vt-itable");
  await expect(table).toContainText("320 × 180", { timeout: 30_000 });
  await expect(table).toContainText("H.264");
  await expect(table).toContainText("avc1.");
  await expect(table).toContainText(/0:02\.0\d/);
  await expect(table).toContainText("16:9");
  await expect(table).toContainText("25 fps");
  await expect(table).toContainText("AAC");
  await expect(table).toContainText("48 kHz");
  await expect(table).toContainText("40.7128° N, 74.0060° W");
  await expect(table).toContainText("2024");
  await expect(page.locator(".vt-gps")).toContainText("filmed");
  await expect(
    page.locator(".vt-gps a", { hasText: "Convert" }),
  ).toHaveAttribute("href", "/convert");
  await expect(page.locator(".vt-info-view video")).toBeVisible();

  // Compare: one column per file, differing rows marked
  await addFiles(page, [gen(VID.landscape), gen(VID.avi)]);
  await expect(page.locator(".vt-itable thead th")).toHaveCount(3);
  await expect(table).toContainText("1280 × 720", { timeout: 30_000 });
  await expect(table).toContainText("MPEG-4", { timeout: 120_000 });
  await expect(table).toContainText("320 × 240");
  await expect(
    page.locator(".vt-itable tr.diff", { hasText: "Resolution" }),
  ).toHaveCount(1);
  await expect(page.locator(".vt-ithumb img")).toHaveCount(3, {
    timeout: 120_000,
  });
});

test("video info names QuickTime's software tag", async ({ page }) => {
  await openTool(page, "/video-info");
  await addFiles(page, gen(VID.mov));
  const table = page.locator(".vt-itable");
  await expect(table).toContainText("Encoder", { timeout: 30_000 });
  await expect(table).toContainText("Lavf");
  await expect(table).not.toContainText("Swr");
});

test("video info copies JSON", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openTool(page, "/video-info");
  await addFiles(page, gen(VID.mkv));
  await expect(page.locator(".vt-itable")).toContainText("640 × 360", {
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Copy as JSON" }).click();
  const json = JSON.parse(
    await page.evaluate(() => navigator.clipboard.readText()),
  ) as { name: string; container: string; video: { width: number } }[];
  expect(json[0]!.name).toBe(VID.mkv);
  expect(json[0]!.container).toBe("matroska");
  expect(json[0]!.video.width).toBe(640);
});

/* ---------- use-case presets ---------- */

for (const [slug, check] of [
  [
    "speed-up-video",
    (p: Page) =>
      expect(p.locator(".vt-speed .chip", { hasText: /^2×$/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
  ],
  [
    "slow-motion-video",
    (p: Page) => expect(p.locator(".vt-newlen")).toContainText("0:08.0"),
  ],
  [
    "rotate-video-90",
    (p: Page) => expect(p.locator(".vt-plan")).toContainText("360 × 640"),
  ],
] as const)
  test(`use case ${slug} applies its preset`, async ({ page }) => {
    await openTool(page, `/${slug}`);
    await addFiles(page, gen(VID.mov));
    await expect(page.locator(".vt-plan")).toBeVisible({ timeout: 60_000 });
    await check(page);
  });

test("Bangla pages translate the new tools", async ({ page }) => {
  for (const [path, words] of [
    ["/bn/speed", ["Speed", "Keep the natural pitch", "Common speeds"]],
    ["/bn/rotate", ["90° right", "Horizontal", "Quick"]],
  ] as const) {
    await openTool(page, path);
    await addFiles(page, gen(VID.mov));
    await expect(page.locator(".vt-plan")).toBeVisible({ timeout: 60_000 });
    const text = await page.locator(".vt-ws").innerText();
    for (const en of words) expect(text, en).not.toContain(en);
  }
});
