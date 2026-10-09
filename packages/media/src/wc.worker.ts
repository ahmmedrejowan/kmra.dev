/// <reference lib="webworker" />
/**
 * The fast engine, in a worker: Mediabunny reads and writes MP4/MOV/WebM/MKV/MP3/WAV/Ogg and
 * drives the browser's WebCodecs encoders and decoders (hardware where the device has them).
 * Copies streams as they are when the job allows it. Replies `{ reason }` when it can't do a job,
 * so the caller falls back to ffmpeg.wasm. Messages: see ./wc.ts.
 */
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  Conversion,
  ConversionCanceledError,
  FlacOutputFormat,
  Input,
  MATROSKA,
  MkvOutputFormat,
  MovOutputFormat,
  MP3,
  MP4,
  Mp3OutputFormat,
  Mp4OutputFormat,
  OGG,
  OggOutputFormat,
  Output,
  QTFF,
  Quality,
  WAVE,
  WavOutputFormat,
  WEBM,
  WebMOutputFormat,
  ADTS,
  FLAC,
  MPEG_TS,
  canEncodeAudio,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  type AudioCodec,
  type ConversionAudioOptions,
  type ConversionVideoOptions,
  type InputVideoTrack,
  type OutputFormat,
  type Rotation,
  type VideoCodec,
  type VideoSample,
} from "mediabunny";
import {
  audioUntouched,
  containerTakesAudio,
  containerTakesVideo,
  videoUntouched,
} from "./args";
import { isAudioOut, MIME } from "./plan";
import type { Container, Job, MediaInfo } from "./types";
import type { WcPlan, WcRequest } from "./wc";

const post = (msg: unknown, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);

const running = new Map<number, { cancel: () => Promise<void> | void }>();

class Unsupported extends Error {}
/** Problems with the file itself: the other engine wouldn't do better */
class Fatal extends Error {}

function open(file: Blob) {
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
}

/* ---------- probe ---------- */

async function containerName(input: Input): Promise<string> {
  const f = await input.getFormat();
  const pairs: [unknown, string][] = [
    [MP4, "mp4"],
    [QTFF, "mov"],
    [WEBM, "webm"],
    [MATROSKA, "matroska"],
    [MP3, "mp3"],
    [WAVE, "wav"],
    [OGG, "ogg"],
    [ADTS, "aac"],
    [FLAC, "flac"],
    [MPEG_TS, "ts"],
  ];
  return pairs.find(([x]) => x === f)?.[1] ?? f.name.toLowerCase();
}

const CODEC_NAMES: Record<string, string> = {
  avc: "h264",
  "pcm-s16": "pcm_s16le",
};

async function probe(file: File): Promise<MediaInfo> {
  const input = open(file);
  try {
    if (!(await input.canRead())) throw new Unsupported("unknown format");
    const container = await containerName(input);
    const durationSec = await input.computeDuration();
    const v = await input.getPrimaryVideoTrack();
    const a = await input.getPrimaryAudioTrack();
    const tracks = await input.getTracks();
    const info: MediaInfo = {
      container,
      durationSec,
      sizeBytes: file.size,
      bitrate: durationSec ? Math.round((file.size * 8) / durationSec) : 0,
      other: tracks.filter((t) => t !== v && t !== a).map((t) => `${t.type}`),
    };
    if (v) {
      const stats = await v.computePacketStats(240);
      const codec =
        (await v.getCodec()) ??
        String((await v.getInternalCodecId()) ?? "unknown");
      info.video = {
        codec: CODEC_NAMES[codec] ?? codec,
        width: await v.getDisplayWidth(),
        height: await v.getDisplayHeight(),
        rotation: await v.getRotation(),
        fps: Math.round(stats.averagePacketRate * 100) / 100,
        bitrate: Math.round(
          (await v.getAverageBitrate()) ?? stats.averageBitrate,
        ),
      };
    }
    if (a) {
      const stats = await a.computePacketStats(240);
      const codec = (await a.getCodec()) ?? "unknown";
      info.audio = {
        codec: CODEC_NAMES[codec] ?? codec,
        sampleRate: await a.getSampleRate(),
        channels: await a.getNumberOfChannels(),
        bitrate: Math.round(
          (await a.getAverageBitrate()) ?? stats.averageBitrate,
        ),
      };
    }
    return info;
  } finally {
    input.dispose();
  }
}

/* ---------- convert ---------- */

function outFormat(to: Container): OutputFormat | null {
  switch (to) {
    case "mp4":
    case "m4a":
      return new Mp4OutputFormat({ fastStart: "in-memory" });
    case "mov":
      return new MovOutputFormat({ fastStart: "in-memory" });
    case "webm":
      return new WebMOutputFormat();
    case "mkv":
      return new MkvOutputFormat();
    case "mp3":
      return new Mp3OutputFormat();
    case "wav":
      return new WavOutputFormat();
    case "ogg":
    case "opus":
      return new OggOutputFormat();
    case "flac":
      return new FlacOutputFormat();
    default:
      return null;
  }
}

/** Video codecs to try per container, best-supported first. MP4/MOV stay H.264 so they play everywhere. */
const VIDEO_PREFS: Partial<Record<Container, VideoCodec[]>> = {
  mp4: ["avc"],
  mov: ["avc"],
  mkv: ["avc", "vp9"],
  webm: ["vp9", "vp8", "av1"],
};
const AUDIO_PREFS: Partial<Record<Container, AudioCodec[]>> = {
  mp4: ["aac"],
  m4a: ["aac"],
  mov: ["aac"],
  mkv: ["aac", "opus"],
  webm: ["opus", "vorbis"],
  mp3: ["mp3"],
  wav: ["pcm-s16"],
  ogg: ["opus", "vorbis"],
  opus: ["opus"],
  flac: ["flac"],
};
const CODEC_FROM_JOB: Record<string, VideoCodec> = {
  h264: "avc",
  hevc: "hevc",
  vp8: "vp8",
  vp9: "vp9",
  av1: "av1",
};

let lame: Promise<void> | null = null;
/** Browsers have no MP3 encoder: register the LAME one (wasm, inlined) the first time it's needed */
function needMp3() {
  lame ??= (async () => {
    if (await canEncodeAudio("mp3")) return;
    const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder");
    registerMp3Encoder();
  })();
  return lame;
}

const rot = (r: number) => (((r % 360) + 360) % 360) as Rotation;

/**
 * Draws each frame into the output box: "pad-blur" fills the box with a blurred, enlarged copy
 * and centres the whole frame on top; "contain" with a colour pads with that colour.
 */
function padder(job: Job, W: number, H: number) {
  const v = job.video ?? {};
  const out = new OffscreenCanvas(W, H);
  const ctx = out.getContext("2d")!;
  const sw = Math.max(8, Math.round(W / 28));
  const sh = Math.max(8, Math.round(H / 28));
  const small = new OffscreenCanvas(sw, sh);
  const sctx = small.getContext("2d")!;
  const mid = new OffscreenCanvas(
    Math.max(16, Math.round(W / 6)),
    Math.max(16, Math.round(H / 6)),
  );
  const mctx = mid.getContext("2d")!;
  const fg = new OffscreenCanvas(2, 2);
  const fctx = fg.getContext("2d")!;
  const flipV = v.flip === "v";
  return (sample: VideoSample) => {
    const r = rot(sample.rotation + (v.rotate ?? 0) + (flipV ? 180 : 0));
    const flip = v.flip === "h" || flipV;
    const turned =
      (r === 90 || r === 270) !==
      (sample.rotation === 90 || sample.rotation === 270);
    const dw = turned ? sample.displayHeight : sample.displayWidth;
    const dh = turned ? sample.displayWidth : sample.displayHeight;
    const k = Math.min(W / dw, H / dh);
    const fw = Math.max(2, Math.round(dw * k));
    const fh = Math.max(2, Math.round(dh * k));
    if (v.fit === "pad-blur") {
      sample.drawWithFit(sctx, { fit: "cover", rotation: r, flip });
      mctx.imageSmoothingQuality = "high";
      mctx.drawImage(small, 0, 0, mid.width, mid.height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(mid, 0, 0, W, H);
      ctx.fillStyle = "rgb(0 0 0 / 0.18)";
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = v.padColor ?? "#000";
      ctx.fillRect(0, 0, W, H);
    }
    if (fg.width !== fw || fg.height !== fh) {
      fg.width = fw;
      fg.height = fh;
    }
    sample.drawWithFit(fctx, { fit: "fill", rotation: r, flip });
    ctx.drawImage(fg, Math.round((W - fw) / 2), Math.round((H - fh) / 2));
    return out;
  };
}

interface Setup {
  input: Input;
  output: Output;
  conversion: Conversion;
  copied: boolean;
}

async function setup(
  file: File,
  info: MediaInfo,
  job: Job,
  plan: WcPlan,
): Promise<Setup> {
  const fmt = outFormat(job.to);
  if (!fmt) throw new Unsupported("This output needs the compatible engine");
  const input = open(file);
  try {
    if (!(await input.canRead()))
      throw new Unsupported("This format needs the compatible engine");
    const audioOut = isAudioOut(job);
    const v = audioOut ? null : await input.getPrimaryVideoTrack();
    const a = job.audio?.drop ? null : await input.getPrimaryAudioTrack();
    if (audioOut && !a) throw new Fatal("This video has no sound");
    const vIn = v ? await v.getCodec() : null;
    const aIn = a ? await a.getCodec() : null;
    const trimCopy = !job.trim || !!job.copyWhenPossible;

    let video: ConversionVideoOptions = { discard: true };
    let copyVideo = false;
    if (v) {
      copyVideo =
        trimCopy &&
        videoUntouched(info, job, plan.resized) &&
        !!vIn &&
        fmt.getSupportedVideoCodecs().includes(vIn) &&
        // Only what plays everywhere in that container (no VP9 in MP4)
        containerTakesVideo(job.to, vIn);
      if (copyVideo) video = {};
      else {
        if (!(await v.canDecode()))
          throw new Unsupported(
            "This video's codec needs the compatible engine",
          );
        const allowed = fmt.getSupportedVideoCodecs();
        const prefs = (
          job.video?.codec
            ? [CODEC_FROM_JOB[job.video.codec]!]
            : (VIDEO_PREFS[job.to] ?? ["avc"])
        ).filter((c) => allowed.includes(c));
        const codec = await getFirstEncodableVideoCodec(prefs, {
          width: plan.width,
          height: plan.height,
          bitrate: plan.videoBitrate,
        });
        if (!codec)
          throw new Unsupported(
            "This browser can't encode this format quickly",
          );
        const fit = job.video?.fit ?? "contain";
        const custom =
          plan.resized &&
          !!job.video?.width &&
          !!job.video?.height &&
          (fit === "pad-blur" ||
            (fit === "contain" &&
              !!job.video?.padColor &&
              !/^(#000(000)?|black)$/i.test(job.video.padColor)));
        video = {
          codec,
          quality: new Quality({ bitrate: plan.videoBitrate }),
          forceTranscode: true,
          ...(job.video?.fps ? { frameRate: job.video.fps } : {}),
          ...(custom
            ? {
                process: padder(job, plan.width, plan.height),
                processedWidth: plan.width,
                processedHeight: plan.height,
              }
            : {
                ...(plan.resized
                  ? {
                      width: plan.width,
                      height: plan.height,
                      fit:
                        fit === "stretch"
                          ? ("fill" as const)
                          : fit === "cover"
                            ? ("cover" as const)
                            : ("contain" as const),
                    }
                  : {}),
                ...(job.video?.rotate || job.video?.flip
                  ? {
                      rotate: rot(
                        (job.video.rotate ?? 0) +
                          (job.video.flip === "v" ? 180 : 0),
                      ),
                      flip: !!job.video.flip,
                      allowTransformationMetadata: false,
                    }
                  : {}),
              }),
        };
      }
    }

    let audio: ConversionAudioOptions = { discard: true };
    let copyAudio = false;
    if (a) {
      copyAudio =
        trimCopy &&
        audioUntouched(job) &&
        !!aIn &&
        fmt.getSupportedAudioCodecs().includes(aIn) &&
        containerTakesAudio(job.to, aIn);
      if (copyAudio) audio = {};
      else {
        if (!(await a.canDecode()))
          throw new Unsupported(
            "This sound's codec needs the compatible engine",
          );
        const prefs = (AUDIO_PREFS[job.to] ?? ["aac"]).filter((c) =>
          fmt.getSupportedAudioCodecs().includes(c),
        );
        if (prefs.includes("mp3")) await needMp3();
        const channels =
          job.audio?.channels ?? Math.min(2, await a.getNumberOfChannels());
        const sampleRate =
          job.audio?.sampleRate ??
          (prefs[0] === "opus" ? 48_000 : await a.getSampleRate());
        const codec = await getFirstEncodableAudioCodec(prefs, {
          numberOfChannels: channels,
          sampleRate,
          ...(plan.audioBitrate ? { bitrate: plan.audioBitrate } : {}),
        });
        if (!codec)
          throw new Unsupported("This browser can't encode this sound format");
        audio = {
          codec,
          forceTranscode: true,
          numberOfChannels: channels,
          sampleRate,
          ...(plan.audioBitrate && !codec.startsWith("pcm") && codec !== "flac"
            ? { quality: new Quality({ bitrate: plan.audioBitrate }) }
            : {}),
        };
      }
    }
    if (!v && !a) throw new Fatal("This file has no video or sound to use");

    const output = new Output({ format: fmt, target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video,
      audio,
      ...(job.trim
        ? { trim: { start: Math.max(0, job.trim.start), end: job.trim.end } }
        : {}),
      copy: job.trim && !job.copyWhenPossible ? false : {},
      showWarnings: false,
    });
    if (!conversion.isValid) {
      const why = conversion.discardedTracks.map((d) => d.reason).join(", ");
      throw new Unsupported(`The fast engine can't do this (${why})`);
    }
    return {
      input,
      output,
      conversion,
      copied: (copyVideo || !v) && (copyAudio || !a),
    };
  } catch (e) {
    input.dispose();
    throw e;
  }
}

async function convert(
  id: number,
  file: File,
  info: MediaInfo,
  job: Job,
  plan: WcPlan,
) {
  const s = await setup(file, info, job, plan);
  running.set(id, { cancel: () => s.conversion.cancel() });
  post({ id, engine: s.copied ? "copy" : "webcodecs" });
  try {
    s.conversion.onProgress = (ratio) => post({ id, ratio });
    await s.conversion.execute();
    const buf = (s.output.target as BufferTarget).buffer!;
    return { blob: new Blob([buf], { type: MIME[job.to] }), copied: s.copied };
  } finally {
    running.delete(id);
    s.input.dispose();
  }
}

/* ---------- frames ---------- */

async function track(input: Input): Promise<InputVideoTrack> {
  const v = await input.getPrimaryVideoTrack();
  if (!v) throw new Error("This file has no video");
  if (!(await v.canDecode()))
    throw new Unsupported("This video's codec can't be shown here");
  return v;
}

async function thumbs(id: number, file: File, times: number[], height: number) {
  const input = open(file);
  let stop = false;
  running.set(id, { cancel: () => void (stop = true) });
  try {
    const sink = new CanvasSink(await track(input), { height, poolSize: 0 });
    let i = 0;
    for await (const c of sink.canvasesAtTimestamps(times)) {
      if (stop) break;
      if (c) {
        const bmp = await createImageBitmap(c.canvas as OffscreenCanvas);
        post({ id, thumb: { i, t: times[i], bitmap: bmp } }, [bmp]);
      }
      i++;
    }
  } finally {
    running.delete(id);
    input.dispose();
  }
}

async function frame(
  file: File,
  t: number,
  width: number | undefined,
  type: string,
  quality: number,
) {
  const input = open(file);
  try {
    const sink = new CanvasSink(await track(input), width ? { width } : {});
    const c =
      (await sink.getCanvas(t)) ??
      (await sink.getCanvas(await input.getFirstTimestamp()));
    if (!c) throw new Error("No picture at this time");
    return await (c.canvas as OffscreenCanvas).convertToBlob({ type, quality });
  } finally {
    input.dispose();
  }
}

/* ---------- messages ---------- */

self.onmessage = async (e: MessageEvent<WcRequest>) => {
  const m = e.data;
  if (m.op === "cancel") {
    await running.get(m.target)?.cancel();
    return;
  }
  const { id } = m;
  try {
    let result: unknown;
    if (m.op === "probe") result = await probe(m.file);
    else if (m.op === "convert")
      result = await convert(id, m.file, m.info, m.job, m.plan);
    else if (m.op === "thumbs")
      result = await thumbs(id, m.file, m.times, m.height);
    else if (m.op === "frame")
      result = await frame(m.file, m.t, m.width, m.type, m.quality);
    post({ id, done: true, result });
  } catch (err) {
    if (err instanceof ConversionCanceledError)
      post({ id, done: true, aborted: true });
    else
      post({
        id,
        done: true,
        error: err instanceof Error ? err.message : String(err),
        unsupported: err instanceof Unsupported,
        fatal: err instanceof Fatal,
      });
  }
};
