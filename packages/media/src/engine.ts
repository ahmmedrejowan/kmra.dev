/**
 * @kmra/media engine: the one entry point tools use. Describe the result as a Job; the engine
 * picks how to make it:
 *
 *   copy      streams copied as they are (remux, mute, keyframe trims): instant, lossless
 *   webcodecs Mediabunny + the browser's WebCodecs encoders (hardware where available): fast
 *   ffmpeg    ffmpeg.wasm, self-hosted, in a worker: any format and filter, slower
 *
 * Everything runs on the device. Typical use:
 *
 *   const info = await probe(file);                        // MediaInfo
 *   const p = await plan(file, job);                       // engine, output size, estimate
 *   const out = await run(file, job, { onProgress, signal, suffix: "compressed" });
 *   downloadBlob(out.blob, out.name);
 *
 * Progress `stage` strings are English; the UI translates them (see STAGES).
 *
 * Exports (import from "@kmra/media/engine"):
 *   probe(file)                 MediaInfo (headers only for MP4/MOV/WebM/MKV/audio; ffprobe otherwise)
 *   plan(input, job, info?)     Plan: engine, output size, bitrates, estimated bytes, reason
 *   run(input, job, opts)       Output; several files are joined in order (ffmpeg)
 *   thumbnails(file, {...})     frames for a timeline strip; frameAt(file, t) one frame as an image
 *   preloadFfmpeg()             start the ~32 MB download early (e.g. when an AVI is dropped)
 *   sizeWarning(file, engine)   memory warning text or null; isAbort(e) for cancelled jobs
 *   hasWebCodecs(), isMediaFile(f), VIDEO_ACCEPT, codecLabel(), containerLabel(), STAGES
 *   pure helpers from ./plan: outputName, outputSize, outDuration, isAudioOut, fmtTime, parseTime …
 *   types from ./types: Job, MediaInfo, Plan, Progress, RunOptions, Output, Engine, Fit …
 * React pieces: "@kmra/media/components/VideoPreview", ".../Timeline" (+ TimeInput),
 * ".../MediaDrop" (useMediaFiles, MediaDrop, MediaInput, EngineBadge). Styles: the
 * "media: shared player and timeline" block at the end of @kmra/ui's styles.css.
 *
 * Adding a feature: put it on Job (types.ts), then teach both engines: ./wc.worker.ts (Mediabunny
 * Conversion options, or a `process` canvas step) and ./args.ts (ffmpeg filters). If the fast
 * engine can't do it, list it in forcedFfmpeg() below so plan() reports the slower engine.
 */
import {
  audioUntouched,
  codecId,
  concatArgs,
  containerTakesAudio,
  containerTakesVideo,
  ffmpegArgs,
  videoUntouched,
  type FfmpegPlan,
} from "./args";
import { loadFfmpeg, probeFfmpeg, runFfmpeg } from "./ffmpeg";
import {
  audioBitrate,
  estimateBytes,
  isAudioOut,
  MIME,
  outDuration,
  outputName,
  outputSize,
  qualityBitrate,
  resizes,
  targetPlan,
  withTargetSize,
} from "./plan";
import type {
  Engine,
  Job,
  MediaInfo,
  Output,
  Plan,
  Progress,
  RunOptions,
} from "./types";
import { call, WcFatal, WcUnsupported, type WcPlan } from "./wc";

export type * from "./types";
export { setFfmpegBase, ffmpegLoaded, ffmpegThreads } from "./ffmpeg";
export {
  AUDIO_CONTAINERS,
  MIME,
  baseName,
  fmtTime,
  isAudioOut,
  outDuration,
  outputName,
  outputSize,
  parseTime,
} from "./plan";

/** Every progress/plan string the engine emits, for translation files */
export const STAGES = [
  "Loading the video engine",
  "Reading the video",
  "Encoding",
  "Copying",
  "Trying a smaller size",
  "Joining",
  "Done",
  "This format needs the compatible engine",
  "GIFs are made with the compatible engine",
  "This effect uses the compatible engine",
  "Joining clips uses the compatible engine",
  "This browser has no fast video encoder",
] as const;

const FORMAT_REASON = "This format needs the compatible engine";

/** Containers the fast reader opens (others go to ffmpeg) */
const FAST_READS = new Set([
  "mp4",
  "mov",
  "webm",
  "matroska",
  "mkv",
  "mp3",
  "wav",
  "ogg",
  "aac",
  "flac",
  "ts",
]);

/** True if the browser has WebCodecs video encoding and decoding */
export function hasWebCodecs(): boolean {
  return (
    typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined"
  );
}

/** True for a cancelled job (AbortSignal) */
export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

/** Whether a file looks like video or audio (by type or extension) */
export function isMediaFile(f: File): boolean {
  return (
    f.type.startsWith("video/") ||
    f.type.startsWith("audio/") ||
    /\.(mp4|m4v|mov|webm|mkv|avi|flv|wmv|asf|3gp|3g2|mpg|mpeg|ts|mts|m2ts|ogv|gif|mp3|m4a|wav|ogg|oga|opus|flac|aac)$/i.test(
      f.name,
    )
  );
}

/** File picker filter for video files */
export const VIDEO_ACCEPT =
  "video/*,.mkv,.avi,.flv,.wmv,.3gp,.mts,.m2ts,.ts,.ogv";

/* ---------- probe ---------- */

const probes = new WeakMap<File, Promise<MediaInfo>>();

/**
 * Read a file's details: container, duration, size, video and audio streams. Fast for MP4, MOV,
 * WebM, MKV and audio files (reads headers only); other formats load ffmpeg (~31 MB, once).
 */
export function probe(
  file: File,
  opts: { onProgress?: (p: Progress) => void } = {},
): Promise<MediaInfo> {
  let p = probes.get(file);
  if (!p) {
    p = call<MediaInfo>({ op: "probe", file }).catch((e) => {
      if (e instanceof WcFatal) throw e;
      return probeFfmpeg(file, opts.onProgress);
    });
    p.catch(() => probes.delete(file));
    probes.set(file, p);
  }
  return p;
}

/* ---------- planning ---------- */

/** Why a job must use ffmpeg whatever the browser (null = the fast engine may do it) */
function forcedFfmpeg(info: MediaInfo, job: Job, files: number): string | null {
  if (files > 1) return "Joining clips uses the compatible engine";
  if (job.to === "gif" || info.container === "gif")
    return "GIFs are made with the compatible engine";
  if (!FAST_READS.has(info.container)) return FORMAT_REASON;
  const a = job.audio ?? {};
  if (
    (job.video?.speed ?? 1) !== 1 ||
    (a.volume ?? 1) !== 1 ||
    a.normalize ||
    a.fadeInSec ||
    a.fadeOutSec
  )
    return "This effect uses the compatible engine";
  return null;
}

interface Resolved {
  job: Job;
  wc: WcPlan;
}

/** Fill in the sizes and bitrates a job implies (target size → bitrate and maybe a smaller frame) */
function resolve(info: MediaInfo, job: Job): Resolved {
  let j = job;
  let vb: number;
  let ab: number;
  if (job.targetBytes) {
    const t = targetPlan(info, job);
    j = withTargetSize(info, job, t.height);
    vb = t.videoBitrate;
    ab = t.audioBitrate;
  } else {
    vb = qualityBitrate(info, j);
    ab = audioBitrate(info, j);
  }
  const { width, height } = outputSize(info, j);
  return {
    job: j,
    wc: {
      width,
      height,
      videoBitrate: vb,
      audioBitrate: ab,
      resized: resizes(info, j),
    },
  };
}

function copyPlan(info: MediaInfo, job: Job, resized: boolean) {
  const trimOk = !job.trim || !!job.copyWhenPossible;
  return {
    video:
      trimOk &&
      !!info.video &&
      !isAudioOut(job) &&
      videoUntouched(info, job, resized) &&
      containerTakesVideo(job.to, info.video.codec),
    audio:
      trimOk &&
      !!info.audio &&
      !job.audio?.drop &&
      audioUntouched(job) &&
      containerTakesAudio(job.to, info.audio.codec),
  };
}

/**
 * What a job will do before it runs: the engine (best guess; the fast engine may still hand over
 * to ffmpeg if the browser lacks a codec), the output size, bitrates and an estimated file size.
 */
export async function plan(
  input: File | File[],
  job: Job,
  info?: MediaInfo,
): Promise<Plan> {
  const files = Array.isArray(input) ? input : [input];
  const i = info ?? (await probe(files[0]!));
  const r = resolve(i, job);
  const reason = forcedFfmpeg(i, job, files.length);
  const c = copyPlan(i, r.job, r.wc.resized);
  const needVideo = !!i.video && !isAudioOut(job);
  const needAudio = !!i.audio && !job.audio?.drop;
  // ffmpeg copies too: an AVI or FLV with MP4-friendly streams is remuxed, not re-encoded
  const copyable = !reason || reason === FORMAT_REASON;
  const copy =
    copyable &&
    (!needVideo || c.video) &&
    (!needAudio || c.audio) &&
    files.length === 1;
  const engine: Engine = copy
    ? "copy"
    : reason
      ? "ffmpeg"
      : hasWebCodecs()
        ? "webcodecs"
        : "ffmpeg";
  return {
    engine,
    width: r.wc.width,
    height: r.wc.height,
    videoBitrate: copy || !needVideo ? 0 : r.wc.videoBitrate,
    audioBitrate: copy || !needAudio ? 0 : r.wc.audioBitrate,
    estimatedBytes: estimateBytes(
      i,
      r.job,
      needVideo ? r.wc.videoBitrate : 0,
      needAudio ? r.wc.audioBitrate : 0,
      copy,
    ),
    ...(reason
      ? copy
        ? {}
        : { reason }
      : engine === "ffmpeg"
        ? { reason: "This browser has no fast video encoder" }
        : {}),
  };
}

/* ---------- run ---------- */

const ext = (to: string) => (to === "opus" ? "ogg" : to);

async function viaFfmpeg(
  file: File,
  info: MediaInfo,
  r: Resolved,
  opts: RunOptions,
  stage: string,
): Promise<Blob> {
  const c = copyPlan(info, r.job, r.wc.resized);
  const p: FfmpegPlan = { ...r.wc, copyVideo: c.video, copyAudio: c.audio };
  const data = await runFfmpeg({
    files: [file],
    args: ([inp], out) => ffmpegArgs(info, r.job, p, inp!, out),
    ext: ext(r.job.to),
    duration: outDuration(info, r.job),
    stage,
    onProgress: opts.onProgress,
    signal: opts.signal,
  });
  return new Blob([data as BlobPart], { type: MIME[r.job.to] });
}

async function once(
  file: File,
  info: MediaInfo,
  r: Resolved,
  opts: RunOptions,
  stage: string,
): Promise<{ blob: Blob; engine: Engine }> {
  const reason = forcedFfmpeg(info, r.job, 1);
  if (opts.engine !== "ffmpeg" && !reason) {
    let engine: Engine = "webcodecs";
    try {
      const res = await call<{ blob: Blob; copied: boolean }>(
        { op: "convert", file, info, job: r.job, plan: r.wc },
        (m) => {
          if (m.engine) engine = m.engine;
          if (m.ratio !== undefined)
            opts.onProgress?.({
              ratio: m.ratio,
              stage: engine === "copy" ? "Copying" : stage,
              engine,
            });
        },
        opts.signal,
      );
      return { blob: res.blob, engine: res.copied ? "copy" : "webcodecs" };
    } catch (e) {
      if (isAbort(e) || e instanceof WcFatal || opts.engine === "webcodecs")
        throw e;
      // Not possible or failed on this browser: the compatible engine does it instead
      if (!(e instanceof WcUnsupported))
        console.info("Fast engine failed, using ffmpeg:", e);
    }
  } else if (opts.engine === "webcodecs")
    throw new Error(reason ?? "Not possible with the fast engine");
  const blob = await viaFfmpeg(file, info, r, opts, stage);
  const c = copyPlan(info, r.job, r.wc.resized);
  const copied =
    (!info.video || isAudioOut(r.job) || c.video) &&
    (!info.audio || !!r.job.audio?.drop || c.audio);
  return { blob, engine: copied ? "copy" : "ffmpeg" };
}

/**
 * Make the output for a job. With several files, joins them in order (ffmpeg; the first file's
 * size and frame rate unless the job sets them). Rejects with an AbortError when `signal` aborts;
 * the next job works normally. With `targetBytes`, checks the result and retries once smaller if
 * it came out over the target.
 */
export async function run(
  input: File | File[],
  job: Job,
  opts: RunOptions = {},
): Promise<Output> {
  const t0 = performance.now();
  const files = Array.isArray(input) ? input : [input];
  const first = files[0];
  if (!first) throw new Error("No file");
  const name = outputName(
    opts.name ?? first.name,
    job.to === "opus" ? "ogg" : job.to,
    opts.suffix,
  );
  if (files.length > 1) return joinFiles(files, job, opts, name, t0);

  const say = (p: Progress) => opts.onProgress?.(p);
  say({ ratio: 0, stage: "Reading the video" });
  const info = await probe(first, { onProgress: say });
  if (isAudioOut(job) && !info.audio)
    throw new Error("This video has no sound");
  let r = resolve(info, job);
  let out = await once(first, info, r, opts, "Encoding");

  if (
    job.targetBytes &&
    out.engine !== "copy" &&
    out.blob.size > job.targetBytes
  ) {
    // Over the target (encoders overshoot on busy scenes): aim lower by the miss, plus a margin
    const k = (job.targetBytes / out.blob.size) * 0.88;
    r = {
      job: r.job,
      wc: {
        ...r.wc,
        videoBitrate: Math.max(40_000, Math.round(r.wc.videoBitrate * k)),
        audioBitrate:
          r.wc.audioBitrate > 64_000
            ? Math.round(r.wc.audioBitrate * Math.max(0.6, k))
            : r.wc.audioBitrate,
      },
    };
    out = await once(first, info, r, opts, "Trying a smaller size");
  }
  say({ ratio: 1, stage: "Done", engine: out.engine });
  const outInfo = await probe(
    new File([out.blob], name, { type: out.blob.type }),
  ).catch(() => undefined);
  return {
    blob: out.blob,
    name,
    info: outInfo,
    engine: out.engine,
    ms: Math.round(performance.now() - t0),
  };
}

async function joinFiles(
  files: File[],
  job: Job,
  opts: RunOptions,
  name: string,
  t0: number,
): Promise<Output> {
  const infos: MediaInfo[] = [];
  for (const f of files)
    infos.push(await probe(f, { onProgress: opts.onProgress }));
  const base = infos[0]!;
  const r = resolve(base, job);
  const total = infos.reduce((s, i) => s + i.durationSec, 0);
  const data = await runFfmpeg({
    files,
    args: (inputs, out) =>
      concatArgs(
        infos,
        r.job,
        { ...r.wc, copyVideo: false, copyAudio: false },
        inputs,
        out,
      ),
    ext: ext(job.to),
    duration: total,
    stage: "Joining",
    onProgress: opts.onProgress,
    signal: opts.signal,
  });
  const blob = new Blob([data as BlobPart], { type: MIME[job.to] });
  const info = await probe(new File([blob], name, { type: blob.type })).catch(
    () => undefined,
  );
  opts.onProgress?.({ ratio: 1, stage: "Done", engine: "ffmpeg" });
  return {
    blob,
    name,
    info,
    engine: "ffmpeg",
    ms: Math.round(performance.now() - t0),
  };
}

/** Start downloading ffmpeg ahead of a job that will need it (e.g. when an AVI is dropped). */
export function preloadFfmpeg(
  onProgress?: (p: Progress) => void,
): Promise<void> {
  return loadFfmpeg(onProgress).then(() => undefined);
}

/* ---------- pictures ---------- */

/**
 * Small frames for a timeline strip, evenly spread over [start, end] (default the whole clip).
 * `onThumb` gets each one as it's decoded (ImageBitmap; draw it on a canvas, then close it).
 * Uses the fast reader; for other formats falls back to seeking a hidden <video>, and gives up
 * quietly if the browser can't play the file.
 */
export async function thumbnails(
  file: File,
  opts: {
    count: number;
    height: number;
    start?: number;
    end?: number;
    duration?: number;
    onThumb: (i: number, bitmap: ImageBitmap, t: number) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  const info = await probe(file).catch(() => null);
  const dur = opts.duration ?? info?.durationSec ?? 0;
  const s = opts.start ?? 0;
  const e = opts.end ?? dur;
  const times = Array.from(
    { length: opts.count },
    (_, i) => s + ((i + 0.5) * (e - s)) / opts.count,
  );
  try {
    await call<void>(
      { op: "thumbs", file, times, height: opts.height },
      (m) => m.thumb && opts.onThumb(m.thumb.i, m.thumb.bitmap, m.thumb.t),
      opts.signal,
    );
  } catch (err) {
    if (isAbort(err)) return;
    await seekThumbs(file, times, opts.height, opts.onThumb, opts.signal).catch(
      () => {},
    );
  }
}

/** Fallback thumbnails: seek a hidden <video> (works for anything the browser can play) */
async function seekThumbs(
  file: File,
  times: number[],
  height: number,
  onThumb: (i: number, b: ImageBitmap, t: number) => void,
  signal?: AbortSignal,
) {
  const v = document.createElement("video");
  v.muted = true;
  v.preload = "auto";
  const url = URL.createObjectURL(file);
  v.src = url;
  try {
    await new Promise<void>((ok, bad) => {
      v.onloadeddata = () => ok();
      v.onerror = () => bad(new Error("can't play"));
    });
    const w = Math.round((v.videoWidth / v.videoHeight) * height);
    for (const [i, t] of times.entries()) {
      if (signal?.aborted) return;
      await new Promise<void>((ok) => {
        v.onseeked = () => ok();
        v.currentTime = t;
      });
      onThumb(
        i,
        await createImageBitmap(v, {
          resizeWidth: w,
          resizeHeight: height,
          resizeQuality: "medium",
        }),
        t,
      );
    }
  } finally {
    URL.revokeObjectURL(url);
    v.removeAttribute("src");
    v.load();
  }
}

/**
 * One frame as an image (for stills and posters). `width` scales it (height follows);
 * `type` is "image/png", "image/jpeg" or "image/webp".
 */
export async function frameAt(
  file: File,
  t: number,
  opts: { width?: number; type?: string; quality?: number } = {},
): Promise<Blob> {
  const type = opts.type ?? "image/png";
  const quality = opts.quality ?? 0.92;
  try {
    return await call<Blob>({
      op: "frame",
      file,
      t,
      width: opts.width,
      type,
      quality,
    });
  } catch (e) {
    if (e instanceof WcFatal) throw e;
    const fmt =
      type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";
    const data = await runFfmpeg({
      files: [file],
      args: ([inp], out) => [
        "-hide_banner",
        "-y",
        "-ss",
        String(Math.max(0, t)),
        "-i",
        inp!,
        "-frames:v",
        "1",
        ...(opts.width ? ["-vf", `scale=${opts.width}:-2`] : []),
        ...(fmt === "jpg" ? ["-q:v", "3"] : []),
        out,
      ],
      ext: fmt,
      duration: 0,
    });
    return new Blob([data as BlobPart], { type });
  }
}

/* ---------- limits ---------- */

/**
 * A warning (English, translated by the UI) when a file may be too big for this device, or null.
 * Above ~2 GB any browser may run out of memory; Safari and phones sooner; ffmpeg.wasm keeps the
 * whole output in memory (and can't go past 2 GB).
 */
export function sizeWarning(file: File, engine?: Engine): string | null {
  const gb = file.size / 1024 ** 3;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const mobile = /iPhone|iPad|Android/i.test(ua);
  const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  if (gb > 2 || (engine === "ffmpeg" && gb > 1.2))
    return "This is a very large file. If the page runs out of memory, trim it first or pick a smaller size.";
  if ((mobile || safari) && gb > 0.5)
    return "Large files may be too much for this browser's memory. If it stops, try a shorter part.";
  return null;
}

/** Codec names for people ("h264" → "H.264") */
export function codecLabel(c: string | undefined): string {
  const id = codecId(c);
  const names: Record<string, string> = {
    h264: "H.264",
    hevc: "HEVC (H.265)",
    vp8: "VP8",
    vp9: "VP9",
    av1: "AV1",
    mpeg4: "MPEG-4",
    prores: "ProRes",
    aac: "AAC",
    opus: "Opus",
    mp3: "MP3",
    vorbis: "Vorbis",
    flac: "FLAC",
    ac3: "AC-3",
    eac3: "E-AC-3",
    pcm_s16le: "PCM",
    pcm_s24le: "PCM 24-bit",
  };
  return names[id] ?? (id ? id.toUpperCase() : "");
}

/** Container names for people ("matroska" → "MKV") */
export function containerLabel(c: string): string {
  const names: Record<string, string> = {
    mp4: "MP4",
    mov: "MOV",
    webm: "WebM",
    matroska: "MKV",
    mkv: "MKV",
    avi: "AVI",
    flv: "FLV",
    asf: "WMV",
    gif: "GIF",
    ts: "MPEG-TS",
    mpeg: "MPEG",
    mp3: "MP3",
    wav: "WAV",
    ogg: "Ogg",
    aac: "AAC",
    flac: "FLAC",
  };
  return names[c] ?? c.toUpperCase();
}
