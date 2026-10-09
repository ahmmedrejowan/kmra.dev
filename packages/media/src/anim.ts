/// <reference lib="webworker" />
/**
 * Animated pictures (GIF, animated WebP) on the fast engine, used by ./wc.worker.ts: the
 * browser's ImageDecoder (WebCodecs) reads the frames, already composed, with their own
 * durations; Mediabunny encodes them into a video (H.264 MP4 by default). Browsers without
 * ImageDecoder (and anything it can't open) go to ffmpeg.wasm instead, which reads GIF but not
 * animated WebP.
 */
import {
  BufferTarget,
  CanvasSource,
  ConversionCanceledError,
  getFirstEncodableVideoCodec,
  MkvOutputFormat,
  MovOutputFormat,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  type OutputFormat,
  type VideoCodec,
} from "mediabunny";
import { animJobOk, MIME } from "./plan";
export { isAnim } from "./plan";
import type { Job, MediaInfo } from "./types";
import type { WcPlan } from "./wc";

/** The fast engine can't do this; the caller hands it to ffmpeg */
export class AnimUnsupported extends Error {}

/** "image/gif" or "image/webp" from the file's first bytes (null for anything else) */
export async function sniffAnim(
  file: Blob,
): Promise<"image/gif" | "image/webp" | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const s = String.fromCharCode(...b);
  if (s.startsWith("GIF8")) return "image/gif";
  if (s.startsWith("RIFF") && s.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

async function openDecoder(file: Blob): Promise<ImageDecoder | null> {
  const type = await sniffAnim(file);
  if (!type || typeof ImageDecoder === "undefined") return null;
  if (!(await ImageDecoder.isTypeSupported(type))) return null;
  const dec = new ImageDecoder({ data: await file.arrayBuffer(), type });
  await dec.tracks.ready;
  await dec.completed;
  return dec;
}

/**
 * A frame's duration in seconds. Browsers show GIF delays of 10 ms or less as 100 ms, so a
 * video made from them plays at the same pace.
 */
const frameSec = (us: number | null) =>
  !us || us <= 10_000 ? 0.1 : us / 1_000_000;

/** Details of a GIF or animated WebP (null when this browser can't read it) */
export async function probeAnim(file: File): Promise<MediaInfo | null> {
  const dec = await openDecoder(file);
  if (!dec) return null;
  try {
    const track = dec.tracks.selectedTrack;
    const count = track?.frameCount ?? 0;
    if (!count) return null;
    let dur = 0;
    let width = 0;
    let height = 0;
    for (let i = 0; i < count; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      if (!i) {
        width = image.displayWidth;
        height = image.displayHeight;
      }
      dur += frameSec(image.duration);
      image.close();
    }
    const webp = dec.type === "image/webp";
    return {
      container: webp ? "webp" : "gif",
      durationSec: dur,
      sizeBytes: file.size,
      bitrate: dur ? Math.round((file.size * 8) / dur) : 0,
      video: {
        codec: webp ? "webp" : "gif",
        width,
        height,
        rotation: 0,
        fps: dur ? Math.round((count / dur) * 100) / 100 : 0,
        bitrate: dur ? Math.round((file.size * 8) / dur) : 0,
      },
      other: [],
    };
  } finally {
    dec.close();
  }
}

function format(to: string): { fmt: OutputFormat; prefs: VideoCodec[] } {
  switch (to) {
    case "mp4":
      return {
        fmt: new Mp4OutputFormat({ fastStart: "in-memory" }),
        prefs: ["avc"],
      };
    case "mov":
      return {
        fmt: new MovOutputFormat({ fastStart: "in-memory" }),
        prefs: ["avc"],
      };
    case "webm":
      return { fmt: new WebMOutputFormat(), prefs: ["vp9", "vp8", "av1"] };
    case "mkv":
      return { fmt: new MkvOutputFormat(), prefs: ["avc", "vp9"] };
    default:
      throw new AnimUnsupported("This output needs the compatible engine");
  }
}

/**
 * GIF/WebP → video: every frame drawn on the background colour (see-through parts), scaled to
 * the planned size, encoded with its own timing, `job.repeat` times in a row.
 */
export async function animToVideo(
  file: File,
  job: Job,
  plan: WcPlan,
  onRatio: (r: number) => void,
  cancelled: () => boolean,
): Promise<Blob> {
  if (!animJobOk(job))
    throw new AnimUnsupported("This effect uses the compatible engine");
  const dec = await openDecoder(file);
  if (!dec) throw new AnimUnsupported("This browser can't read this picture");
  try {
    const count = dec.tracks.selectedTrack?.frameCount ?? 0;
    if (!count) throw new AnimUnsupported("No frames");
    const { fmt, prefs } = format(job.to);
    const W = plan.width;
    const H = plan.height;
    const codec = await getFirstEncodableVideoCodec(
      prefs.filter((c) => fmt.getSupportedVideoCodecs().includes(c)),
      { width: W, height: H, bitrate: plan.videoBitrate },
    );
    if (!codec)
      throw new AnimUnsupported(
        "This browser can't encode this format quickly",
      );
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    const source = new CanvasSource(canvas, {
      codec,
      quality: new Quality({ bitrate: plan.videoBitrate }),
      keyFrameInterval: 2,
    });
    const output = new Output({ format: fmt, target: new BufferTarget() });
    output.addVideoTrack(source);
    await output.start();
    const repeat = Math.max(1, Math.round(job.repeat ?? 1));
    const bg = job.video?.padColor ?? "#ffffff";
    let t = 0;
    for (let r = 0; r < repeat; r++)
      for (let i = 0; i < count; i++) {
        if (cancelled()) {
          await output.cancel();
          throw new ConversionCanceledError();
        }
        const { image } = await dec.decode({ frameIndex: i });
        const d = frameSec(image.duration);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(image, 0, 0, W, H);
        image.close();
        await source.add(t, d);
        t += d;
        onRatio(Math.min(0.99, (r * count + i + 1) / (repeat * count)));
      }
    source.close();
    await output.finalize();
    const buf = (output.target as BufferTarget).buffer!;
    return new Blob([buf], { type: MIME[job.to] });
  } finally {
    dec.close();
  }
}
