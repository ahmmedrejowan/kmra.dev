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
 *   run(input, job, opts)       Output; several files are joined in order: copied one after
 *                               another when they're encoded alike and the job sets
 *                               copyWhenPossible (see joinable), else re-encoded to the first
 *                               clip's size and frame rate (ffmpeg; fit "contain" or "pad-blur")
 *   joinable(infos, job)        whether run() can join these clips without re-encoding
 *   thumbnails(file, {...})     frames for a timeline strip; frameAt(file, t) one frame as an image
 *   frames(file, times, {...})  many stills at given times (extract frames), one by one
 *   sceneChanges(file, {...})   times where the picture cuts (scene detection)
 *   waveform(file, n)           the sound's outline (n min/max pairs) for a waveform
 *   estimateGif(file, job)      a GIF's size measured on a short sample (plan() only guesses)
 *   preloadFfmpeg()             start the ~32 MB download early (e.g. when an AVI is dropped)
 *   sizeWarning(file, engine)   memory warning text or null; isAbort(e) for cancelled jobs
 *   hasWebCodecs(), isMediaFile(f), VIDEO_ACCEPT, codecLabel(), containerLabel(), STAGES
 * Both engines: speed (video.speed, sound time-stretched or tape-style with audio.keepPitch),
 * turns and flips, and turns by display rotation only (video.rotateMetadata, MP4/MOV: copied).
 * Outputs never carry the source's location tag.
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
  gifFilter,
  videoUntouched,
  type FfmpegPlan,
} from "./args";
import { loadFfmpeg, probeFfmpeg, runFfmpeg } from "./ffmpeg";
import {
  animJobOk,
  audioBitrate,
  isAnim,
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
  uniqueNames,
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
  "Finding scene changes",
  "Saving frames",
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
    /\.(mp4|m4v|mov|webm|mkv|avi|flv|wmv|asf|3gp|3g2|mpg|mpeg|ts|mts|m2ts|ogv|gif|mp3|m4a|m4r|wav|ogg|oga|opus|flac|aac|aif|aiff|wma|amr|caf)$/i.test(
      f.name,
    )
  );
}

/** File picker filter for audio files (and videos, whose sound the audio tools can use) */
export const AUDIO_ACCEPT =
  "audio/*,video/*,.mp3,.m4a,.m4r,.aac,.wav,.ogg,.oga,.opus,.flac,.aif,.aiff,.wma,.amr,.mkv,.webm";

/** Whether a file looks like audio (by type or extension) */
export function isAudioFile(f: File): boolean {
  return (
    f.type.startsWith("audio/") ||
    /\.(mp3|m4a|m4r|aac|wav|ogg|oga|opus|flac|aif|aiff|wma|amr|caf)$/i.test(
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
  if (job.to === "gif") return "GIFs are made with the compatible engine";
  // GIF/WebP → video: the browser's image decoder reads the frames, WebCodecs encodes
  if (isAnim(info.container))
    return typeof ImageDecoder !== "undefined" && animJobOk(job)
      ? null
      : "GIFs are made with the compatible engine";
  if (!FAST_READS.has(info.container)) return FORMAT_REASON;
  const a = job.audio ?? {};
  if (
    (a.volume ?? 1) !== 1 ||
    a.normalize ||
    a.fadeInSec ||
    a.fadeOutSec ||
    a.pitch ||
    a.reverse ||
    a.removeSilence
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
  if (files.length > 1) return planJoin(files, job);
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
  const done = async (blob: Blob, engine: Engine): Promise<Output> => {
    const info = await probe(new File([blob], name, { type: blob.type })).catch(
      () => undefined,
    );
    opts.onProgress?.({ ratio: 1, stage: "Done", engine });
    return { blob, name, info, engine, ms: Math.round(performance.now() - t0) };
  };
  if (opts.engine !== "ffmpeg" && joinable(infos, job)) {
    // Encoded the same way: the packets are copied one clip after another
    try {
      const blob = await call<Blob>(
        { op: "concat", files, to: job.to },
        (m) =>
          m.ratio !== undefined &&
          opts.onProgress?.({
            ratio: m.ratio,
            stage: "Joining",
            engine: "copy",
          }),
        opts.signal,
      );
      return await done(blob, "copy");
    } catch (e) {
      if (isAbort(e) || e instanceof WcFatal || opts.engine === "webcodecs")
        throw e;
      if (!(e instanceof WcUnsupported))
        console.info("Fast join failed, using ffmpeg:", e);
    }
  }
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
  return done(new Blob([data as BlobPart], { type: MIME[job.to] }), "ffmpeg");
}

/**
 * Whether clips can be joined without re-encoding: the job asks for it (`copyWhenPossible`) and
 * changes nothing else, and every clip has the same codecs, frame size, rotation, frame rate and
 * sound format, in a container the fast reader opens. The fast engine still compares the codec
 * settings and re-encodes (ffmpeg) when they differ.
 */
export function joinable(infos: MediaInfo[], job: Job): boolean {
  const [a, ...rest] = infos;
  const v = job.video ?? {};
  const av = a?.video;
  if (
    !a ||
    !av ||
    !job.copyWhenPossible ||
    !FAST_READS.has(a.container) ||
    v.width ||
    v.height ||
    v.quality !== undefined ||
    v.fps ||
    v.rotate ||
    v.flip ||
    (v.speed ?? 1) !== 1 ||
    job.trim ||
    job.targetBytes ||
    isAudioOut(job) ||
    job.audio?.drop ||
    !audioUntouched(job) ||
    !containerTakesVideo(job.to, av.codec) ||
    (a.audio && !containerTakesAudio(job.to, a.audio.codec))
  )
    return false;
  return rest.every(
    (i) =>
      FAST_READS.has(i.container) &&
      !!i.video &&
      codecId(i.video.codec) === codecId(av.codec) &&
      i.video.width === av.width &&
      i.video.height === av.height &&
      i.video.rotation === av.rotation &&
      Math.abs(i.video.fps - av.fps) <= Math.max(0.05, av.fps * 0.02) &&
      !!i.audio === !!a.audio &&
      (!i.audio ||
        (codecId(i.audio.codec) === codecId(a.audio!.codec) &&
          i.audio.sampleRate === a.audio!.sampleRate &&
          i.audio.channels === a.audio!.channels)),
  );
}

/** plan() for several clips joined into one */
async function planJoin(files: File[], job: Job): Promise<Plan> {
  const infos: MediaInfo[] = [];
  for (const f of files) infos.push(await probe(f));
  const base = infos[0]!;
  const r = resolve(base, job);
  const total = infos.reduce((s, i) => s + i.durationSec, 0);
  if (joinable(infos, job))
    return {
      engine: "copy",
      width: r.wc.width,
      height: r.wc.height,
      videoBitrate: 0,
      audioBitrate: 0,
      estimatedBytes: infos.reduce((s, i) => s + i.sizeBytes, 0),
    };
  const sound = !job.audio?.drop && infos.some((i) => i.audio);
  const ab = sound ? r.wc.audioBitrate || 128_000 : 0;
  return {
    engine: "ffmpeg",
    width: r.wc.width,
    height: r.wc.height,
    videoBitrate: r.wc.videoBitrate,
    audioBitrate: ab,
    estimatedBytes: Math.round((((r.wc.videoBitrate + ab) * total) / 8) * 1.02),
    reason: "Joining clips uses the compatible engine",
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
    /** Exact times instead of `count` evenly spread ones */
    times?: number[];
    onThumb: (i: number, bitmap: ImageBitmap, t: number) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  const info = await probe(file).catch(() => null);
  const dur = opts.duration ?? info?.durationSec ?? 0;
  const s = opts.start ?? 0;
  const e = opts.end ?? dur;
  const times =
    opts.times ??
    Array.from(
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
    return frameFfmpeg(file, t, { ...opts, type, quality });
  }
}

/** One frame through ffmpeg.wasm (formats the fast reader can't open) */
async function frameFfmpeg(
  file: File,
  t: number,
  opts: { width?: number; type: string; quality: number },
  signal?: AbortSignal,
): Promise<Blob> {
  const fmt =
    opts.type === "image/jpeg"
      ? "jpg"
      : opts.type === "image/webp"
        ? "webp"
        : "png";
  const q = Math.round(2 + (1 - opts.quality) * 20);
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
      ...(fmt === "jpg" ? ["-q:v", String(q)] : []),
      out,
    ],
    ext: fmt,
    duration: 0,
    signal,
  });
  return new Blob([data as BlobPart], { type: opts.type });
}

/**
 * Stills at the given times (each the frame showing at that moment), handed to `onFrame` one by
 * one as they're made, in order. Uses the fast reader; other formats go frame by frame through
 * ffmpeg.wasm. `type` is "image/png" (default), "image/jpeg" or "image/webp".
 */
export async function frames(
  file: File,
  times: number[],
  opts: {
    width?: number;
    type?: string;
    quality?: number;
    onFrame: (i: number, blob: Blob, t: number) => void;
    onProgress?: (p: Progress) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  const type = opts.type ?? "image/png";
  const quality = opts.quality ?? 0.92;
  const stage = "Saving frames";
  let done = 0;
  try {
    await call<void>(
      { op: "stills", file, times, width: opts.width, type, quality },
      (m) => {
        if (!m.still) return;
        done = m.still.i + 1;
        opts.onFrame(m.still.i, m.still.blob, m.still.t);
        opts.onProgress?.({
          ratio: done / Math.max(1, times.length),
          stage,
          engine: "webcodecs",
        });
      },
      opts.signal,
    );
  } catch (e) {
    if (isAbort(e) || e instanceof WcFatal) throw e;
    // The fast reader can't open this file (or stopped part way): ffmpeg does the rest
    for (let i = done; i < times.length; i++) {
      if (opts.signal?.aborted)
        throw new DOMException("The job was cancelled", "AbortError");
      const blob = await frameFfmpeg(
        file,
        times[i]!,
        { width: opts.width, type, quality },
        opts.signal,
      );
      opts.onFrame(i, blob, times[i]!);
      opts.onProgress?.({
        ratio: (i + 1) / times.length,
        stage,
        engine: "ffmpeg",
      });
    }
  }
}

/**
 * The sound's outline for a waveform: `n` buckets over the file's length, each [min, max] of the
 * first channel (−1…1), flattened. Fast engine first (streams the sound); formats it can't read go
 * through ffmpeg (decoded to 8 kHz mono). Cached per file and size.
 */
const waves = new WeakMap<File, Map<number, Promise<Float32Array>>>();
export function waveform(
  file: File,
  n = 1000,
  opts: { signal?: AbortSignal } = {},
): Promise<Float32Array> {
  let byN = waves.get(file);
  if (!byN) waves.set(file, (byN = new Map()));
  const hit = byN.get(n);
  if (hit) return hit;
  const p = (async () => {
    try {
      return await call<Float32Array>(
        { op: "peaks", file, n },
        () => {},
        opts.signal,
      );
    } catch (e) {
      if (isAbort(e) || e instanceof WcFatal) throw e;
    }
    const info = await probe(file);
    const raw = await runFfmpeg({
      files: [file],
      args: ([inp], out) => [
        "-hide_banner",
        "-y",
        "-i",
        inp!,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "8000",
        "-f",
        "s16le",
        out,
      ],
      ext: "raw",
      duration: info.durationSec,
      signal: opts.signal,
    });
    const pcm = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1);
    const out = new Float32Array(n * 2);
    const per = pcm.length / n;
    for (let i = 0; i < pcm.length; i++) {
      const b = Math.min(n - 1, Math.floor(i / per));
      const v = pcm[i]! / 32768;
      if (v < out[b * 2]!) out[b * 2] = v;
      if (v > out[b * 2 + 1]!) out[b * 2 + 1] = v;
    }
    return out;
  })();
  p.catch(() => byN!.delete(n));
  byN.set(n, p);
  return p;
}

/**
 * Times (seconds) where the picture changes a lot, between `start` and `end` (default the whole
 * clip), the first frame included. `threshold` is ffmpeg's scene score (0–1; 0.3 finds cuts, lower
 * also finds big movements). At most `max` times (default 500).
 */
export async function sceneChanges(
  file: File,
  opts: {
    threshold?: number;
    start?: number;
    end?: number;
    max?: number;
    onProgress?: (p: Progress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<number[]> {
  const info = await probe(file);
  const start = Math.max(0, opts.start ?? 0);
  const end = Math.min(info.durationSec, opts.end ?? info.durationSec);
  const threshold = opts.threshold ?? 0.3;
  const max = opts.max ?? 500;
  const stage = "Finding scene changes";
  try {
    return await call<number[]>(
      { op: "scenes", file, start, end, threshold, max },
      (m) =>
        m.ratio !== undefined &&
        opts.onProgress?.({ ratio: m.ratio, stage, engine: "webcodecs" }),
      opts.signal,
    );
  } catch (e) {
    if (isAbort(e) || e instanceof WcFatal) throw e;
  }
  // ffmpeg's own scene filter; framecrc lists each picked frame's timestamp
  const data = await runFfmpeg({
    files: [file],
    args: ([inp], out) => [
      "-hide_banner",
      "-y",
      "-ss",
      String(start),
      "-t",
      String(Math.max(0.05, end - start)),
      "-i",
      inp!,
      "-an",
      "-vf",
      `scale=64:36,select='eq(n\\,0)+gt(scene\\,${threshold})'`,
      "-fps_mode",
      "passthrough",
      "-copyts",
      "-c:v",
      "rawvideo",
      "-f",
      "framecrc",
      out,
    ],
    ext: "txt",
    duration: end - start,
    stage,
    onProgress: opts.onProgress,
    signal: opts.signal,
  });
  const text = new TextDecoder().decode(data);
  const tb = /#tb 0: (\d+)\/(\d+)/.exec(text);
  const k = tb ? Number(tb[1]) / Number(tb[2]) : 1 / 1000;
  return text
    .split("\n")
    .filter((l) => /^0,/.test(l))
    .map((l) => Number(l.split(",")[2]) * k)
    .filter((t) => Number.isFinite(t))
    .slice(0, max);
}

/**
 * A GIF's size, measured: makes a short sample (up to `sampleSec`, default 2 s, from the middle
 * of the part) with the job's settings and scales it to the whole length. Exact for short clips.
 * Needs ffmpeg.wasm (loads it the first time). `plan()` gives a quick guess meanwhile.
 */
export async function estimateGif(
  file: File,
  job: Job,
  opts: { info?: MediaInfo; sampleSec?: number; signal?: AbortSignal } = {},
): Promise<number> {
  const info = opts.info ?? (await probe(file));
  const r = resolve(info, { ...job, to: "gif" });
  const a = job.trim?.start ?? 0;
  const b = Math.min(info.durationSec, job.trim?.end ?? info.durationSec);
  const len = Math.max(0.05, b - a);
  const sample = Math.min(len, opts.sampleSec ?? 2);
  const s0 = a + (len - sample) / 2;
  const data = await runFfmpeg({
    files: [file],
    args: ([inp], out) => [
      "-hide_banner",
      "-y",
      "-ss",
      String(s0),
      "-t",
      String(sample),
      "-i",
      inp!,
      "-vf",
      gifFilter(r.job, r.wc),
      "-an",
      "-loop",
      r.job.gif?.loop === false ? "-1" : "0",
      out,
    ],
    ext: "gif",
    duration: 0,
    signal: opts.signal,
  });
  return Math.round((data.length * len) / sample);
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
