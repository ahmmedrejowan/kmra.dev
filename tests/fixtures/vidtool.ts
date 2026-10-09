/**
 * VidTool inputs: short generated clips (a moving test pattern with a tone), so the repo carries
 * no third-party video. Made with the ffmpeg command line when it's installed; without it, only a
 * silent WebM is recorded in Chromium (canvas + MediaRecorder) and the tests that need the other
 * clips skip.
 *
 *   vid-landscape.mp4  6 s, 1280×720, 30 fps, H.264 + AAC, a keyframe every second
 *   vid-portrait.mp4   4 s, 720×1280 (9:16), H.264 + AAC
 *   vid-clip.mov       4 s, 640×360, H.264 + AAC in QuickTime
 *   vid-silent.webm    4 s, 640×360, VP9, no audio
 *   vid-clip.mkv       3 s, 640×360, H.264 + AAC in Matroska
 *   vid-clip.avi       3 s, 320×240, MPEG-4 part 2 + MP3 (only ffmpeg.wasm reads it)
 *   vid-colors.mp4     4 s, 320×180, 25 fps, no sound: red, green, blue, white, one second each
 *                      (frame colours at known times; three cuts for scene detection)
 *   vid-anim.gif       3 s, 480×270, 15 fps test pattern GIF, loops (GIF to video)
 *   vid-alpha.gif      1 s, 200×100, 10 fps, see-through with a blue square at 50,25 (background)
 *   vid-corner.mp4     2 s, 320×180, 25 fps, black with a red box in the top-left corner, H.264 +
 *                      AAC; tagged with a creation time and a location (rotate, flip, video info)
 *   vid-part1/2/3.mp4  2 s, 3 s, 2 s, 640×360, 30 fps, H.264 + AAC, encoded alike (merge by copy)
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export const VID = {
  landscape: "vid-landscape.mp4",
  portrait: "vid-portrait.mp4",
  mov: "vid-clip.mov",
  webm: "vid-silent.webm",
  mkv: "vid-clip.mkv",
  avi: "vid-clip.avi",
  colors: "vid-colors.mp4",
  gif: "vid-anim.gif",
  alpha: "vid-alpha.gif",
  corner: "vid-corner.mp4",
  part1: "vid-part1.mp4",
  part2: "vid-part2.mp4",
  part3: "vid-part3.mp4",
} as const;

async function hasFfmpeg() {
  try {
    await run("ffmpeg", ["-hide_banner", "-version"]);
    return true;
  } catch {
    return false;
  }
}

const src = (w: number, h: number, sec: number, fps = 30) => [
  "-f",
  "lavfi",
  "-i",
  `testsrc2=size=${w}x${h}:rate=${fps}:duration=${sec}`,
];
const tone = (sec: number) => [
  "-f",
  "lavfi",
  "-i",
  `sine=frequency=440:sample_rate=48000:duration=${sec}`,
];
const h264 = ["-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p"];
const aac = ["-c:a", "aac", "-b:a", "128k", "-ac", "2"];

export async function makeVidtoolFixtures(dir: string) {
  const out = (n: string) => join(dir, n);
  if (Object.values(VID).every((n) => existsSync(out(n)))) return;
  if (!(await hasFfmpeg())) return makeWithChromium(out(VID.webm));
  const ff = (args: string[], name: string) =>
    run("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      ...args,
      out(name),
    ]);
  await Promise.all([
    ff(
      [
        ...src(1280, 720, 6),
        ...tone(6),
        ...h264,
        "-g",
        "30",
        "-b:v",
        "2500k",
        ...aac,
        "-shortest",
        "-movflags",
        "+faststart",
      ],
      VID.landscape,
    ),
    ff(
      [
        ...src(720, 1280, 4),
        ...tone(4),
        ...h264,
        "-g",
        "30",
        ...aac,
        "-shortest",
      ],
      VID.portrait,
    ),
    ff(
      [
        ...src(640, 360, 4),
        ...tone(4),
        ...h264,
        "-g",
        "30",
        ...aac,
        "-shortest",
        "-f",
        "mov",
      ],
      VID.mov,
    ),
    ff(
      [
        ...src(640, 360, 4),
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        "500k",
        "-deadline",
        "realtime",
        "-cpu-used",
        "8",
        "-an",
      ],
      VID.webm,
    ),
    ff(
      [
        ...src(640, 360, 3),
        ...tone(3),
        ...h264,
        "-g",
        "30",
        ...aac,
        "-shortest",
      ],
      VID.mkv,
    ),
    ff(
      [
        ...src(320, 240, 3, 25),
        ...tone(3),
        "-c:v",
        "mpeg4",
        "-q:v",
        "5",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "128k",
        "-shortest",
      ],
      VID.avi,
    ),
    ff(
      [
        ...["red", "lime", "blue", "white"].flatMap((c) => [
          "-f",
          "lavfi",
          "-i",
          `color=c=${c}:s=320x180:d=1:r=25`,
        ]),
        "-filter_complex",
        "[0][1][2][3]concat=n=4:v=1:a=0,format=yuv420p",
        ...h264,
        "-g",
        "25",
      ],
      VID.colors,
    ),
    ff(
      [
        ...src(480, 270, 3, 15),
        "-vf",
        "split[a][b];[a]palettegen[p];[b][p]paletteuse",
        "-loop",
        "0",
      ],
      VID.gif,
    ),
    ff(
      [
        "-f",
        "lavfi",
        "-i",
        "color=c=black@0:s=200x100:d=1:r=10,format=rgba",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=50x50:d=1:r=10,format=rgba",
        "-filter_complex",
        "[0][1]overlay=50:25,split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse",
        "-loop",
        "0",
      ],
      VID.alpha,
    ),
    ff(
      [
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=320x180:d=2:r=25",
        ...tone(2),
        "-vf",
        "drawbox=x=0:y=0:w=80:h=45:color=red:t=fill,format=yuv420p",
        ...h264,
        "-g",
        "25",
        ...aac,
        "-shortest",
        "-metadata",
        "creation_time=2024-05-01T10:20:30Z",
        "-metadata",
        "location=+40.7128-074.0060/",
      ],
      VID.corner,
    ),
    ...(
      [
        [VID.part1, 2],
        [VID.part2, 3],
        [VID.part3, 2],
      ] as const
    ).map(([name, sec]) =>
      ff(
        [
          ...src(640, 360, sec),
          ...tone(sec),
          ...h264,
          "-g",
          "30",
          ...aac,
          "-shortest",
        ],
        name,
      ),
    ),
  ]);
}

/** Without ffmpeg: record a 4 s silent WebM of a moving pattern in Chromium. */
async function makeWithChromium(path: string) {
  if (existsSync(path)) return;
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const b64 = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 640;
      c.height = 360;
      const ctx = c.getContext("2d")!;
      const rec = new MediaRecorder(c.captureStream(30), {
        mimeType: "video/webm;codecs=vp9",
      });
      const parts: Blob[] = [];
      rec.ondataavailable = (e) => parts.push(e.data);
      const done = new Promise((r) => (rec.onstop = r));
      rec.start();
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const frame = () => {
          const t = (performance.now() - t0) / 1000;
          ctx.fillStyle = `hsl(${(t * 90) % 360} 70% 50%)`;
          ctx.fillRect(0, 0, 640, 360);
          ctx.fillStyle = "#fff";
          ctx.fillRect(((t * 160) % 680) - 40, 140, 80, 80);
          if (t < 4) requestAnimationFrame(frame);
          else resolve();
        };
        frame();
      });
      rec.stop();
      await done;
      const buf = new Uint8Array(await new Blob(parts).arrayBuffer());
      let s = "";
      for (const x of buf) s += String.fromCharCode(x);
      return btoa(s);
    });
    await writeFile(path, Buffer.from(b64, "base64"));
  } finally {
    await browser.close();
  }
}
