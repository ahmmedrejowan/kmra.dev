/**
 * Pure helpers shared by both engines and the tools: output names and types, output size after
 * rotation and fit, bitrates for a quality or a target size, and size estimates. No browser APIs,
 * so tools can call them while rendering.
 */
import type { Container, Job, MediaInfo } from "./types";

export const AUDIO_CONTAINERS = new Set<Container>([
  "mp3",
  "m4a",
  "wav",
  "ogg",
  "opus",
  "flac",
]);

export const MIME: Record<Container, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  gif: "image/gif",
};

/** True when the job's output has no picture (MP3, M4A, WAV …) */
export function isAudioOut(job: Job): boolean {
  return AUDIO_CONTAINERS.has(job.to) || !!job.video?.drop;
}

/** "Holiday clip.MOV" → "Holiday clip" */
export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "video";
}

/** "clip.mov" + mp4 + "compressed" → "clip-compressed.mp4" */
export function outputName(
  input: string,
  to: Container,
  suffix?: string,
): string {
  return `${baseName(input)}${suffix ? `-${suffix}` : ""}.${to}`;
}

/** Duration of the output in seconds, after trim and speed */
export function outDuration(info: MediaInfo, job: Job): number {
  const d = job.trim
    ? Math.max(
        0,
        Math.min(info.durationSec, job.trim.end) - Math.max(0, job.trim.start),
      )
    : info.durationSec;
  return d / (job.video?.speed ?? 1);
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Output frame size: the source's display size, turned by `video.rotate`, then the requested
 * width/height (one side alone keeps the aspect ratio). Always even, as H.264 needs.
 */
export function outputSize(
  info: MediaInfo,
  job: Job,
): { width: number; height: number } {
  const v = info.video;
  if (!v || isAudioOut(job)) return { width: 0, height: 0 };
  const turn = job.video?.rotate === 90 || job.video?.rotate === 270;
  const sw = turn ? v.height : v.width;
  const sh = turn ? v.width : v.height;
  const w = job.video?.width;
  const h = job.video?.height;
  if (w && h) return { width: even(w), height: even(h) };
  if (w) return { width: even(w), height: even((w * sh) / sw) };
  if (h) return { width: even((h * sw) / sh), height: even(h) };
  return { width: even(sw), height: even(sh) };
}

/** True when the output frame differs from the source (needs scaling, cropping or padding) */
export function resizes(info: MediaInfo, job: Job): boolean {
  const v = info.video;
  if (!v) return false;
  if (!job.video?.width && !job.video?.height) return false;
  const turn = job.video?.rotate === 90 || job.video?.rotate === 270;
  const { width, height } = outputSize(info, job);
  return (
    width !== even(turn ? v.height : v.width) ||
    height !== even(turn ? v.width : v.height)
  );
}

/** Frame rate of the output */
export function outFps(info: MediaInfo, job: Job): number {
  const src = info.video?.fps || 30;
  return Math.min(job.video?.fps ?? src, 120) || 30;
}

/** Codec efficiency relative to H.264 (VP9/AV1/HEVC need fewer bits for the same look) */
function efficiency(job: Job): number {
  const c = job.video?.codec;
  if (c === "av1") return 0.6;
  if (c === "vp9" || c === "hevc" || (!c && job.to === "webm")) return 0.7;
  return 1;
}

/** Source video bitrate (bits/s), estimated from the file when the stream doesn't say */
function sourceVideoBitrate(info: MediaInfo): number {
  const v = info.video?.bitrate ?? 0;
  if (v > 0) return v;
  const total =
    info.bitrate ||
    (info.durationSec ? (info.sizeBytes * 8) / info.durationSec : 0);
  return Math.max(
    0,
    total - (info.audio?.bitrate ?? (info.audio ? 128_000 : 0)),
  );
}

/**
 * Audio bitrate for a re-encode, bits/s. The job's own bitrate wins; otherwise the source's,
 * capped at 128 kbps (160 for MP3, which needs more for the same sound). 0 = no audio / PCM.
 */
export function audioBitrate(info: MediaInfo, job: Job): number {
  if (!info.audio || job.audio?.drop) return 0;
  if (job.to === "wav" || job.to === "flac") return 0;
  if (job.audio?.bitrate) return job.audio.bitrate * 1000;
  const cap = job.to === "mp3" ? 160_000 : 128_000;
  const src = info.audio.bitrate || cap;
  return Math.min(cap, Math.max(64_000, src));
}

/**
 * Video bitrate for a quality (0–100, default 70), bits/s: a bits-per-pixel budget for the output
 * size and frame rate, never more than (a share of) what the source spends, so re-encoding
 * doesn't make files bigger.
 */
export function qualityBitrate(info: MediaInfo, job: Job): number {
  const { width, height } = outputSize(info, job);
  if (!width) return 0;
  const q = Math.max(0, Math.min(100, job.video?.quality ?? 70)) / 100;
  const fps = outFps(info, job);
  let br = (0.02 + 0.13 * q) * width * height * fps * efficiency(job);
  const src = sourceVideoBitrate(info);
  if (src > 0 && info.video) {
    const px =
      (width * height) / Math.max(1, info.video.width * info.video.height);
    br = Math.min(br, src * Math.min(1, px) * (0.3 + 0.65 * q));
  }
  return Math.round(Math.max(120_000, br));
}

/** Standard heights, tallest first, used to bring long clips down for a target size */
const LADDER = [2160, 1440, 1080, 720, 540, 480, 360, 240];

/**
 * Bitrates for an output at or under `job.targetBytes`: the budget over the output duration,
 * minus audio and container overhead. When the bits per pixel would be too few for a sharp
 * picture, it also picks a smaller frame (a shorter side from the ladder), unless the job set
 * its own size.
 */
export function targetPlan(
  info: MediaInfo,
  job: Job,
): { videoBitrate: number; audioBitrate: number; height?: number } {
  const dur = Math.max(0.1, outDuration(info, job));
  const bytes = job.targetBytes ?? 0;
  // ~2.5% container overhead plus a little fixed header space
  const total = Math.max(40_000, ((bytes * 0.975 - 16_000) * 8) / dur);
  let audio = 0;
  if (info.audio && !job.audio?.drop) {
    audio =
      total < 400_000
        ? 48_000
        : total < 1_000_000
          ? 64_000
          : total < 3_000_000
            ? 96_000
            : 128_000;
    if (job.audio?.bitrate) audio = Math.min(audio, job.audio.bitrate * 1000);
    if (job.to === "wav" || job.to === "flac") audio = 0;
  }
  if (isAudioOut(job))
    return {
      videoBitrate: 0,
      audioBitrate: Math.round(Math.min(total, 320_000)),
    };
  let video = Math.max(50_000, total - audio);
  const src = sourceVideoBitrate(info);
  // Never aim above what the source spends: the file would only grow
  if (src > 0) video = Math.min(video, src * 0.95);
  const v = info.video;
  if (!v || job.video?.width || job.video?.height)
    return { videoBitrate: Math.round(video), audioBitrate: audio };
  const turn = job.video?.rotate === 90 || job.video?.rotate === 270;
  const sw = turn ? v.height : v.width;
  const sh = turn ? v.width : v.height;
  const short = Math.min(sw, sh);
  const fps = outFps(info, job);
  const minBpp = 0.045 * efficiency(job);
  let pick: number | undefined;
  for (const s of LADDER) {
    if (s > short) continue;
    const k = s / short;
    if (video / (sw * k * sh * k * fps) >= minBpp) {
      pick = s;
      break;
    }
    pick = s;
  }
  // `height` here is the short side; the caller turns it into width/height
  return {
    videoBitrate: Math.round(video),
    audioBitrate: audio,
    height: pick && pick < short ? pick : undefined,
  };
}

/** Apply targetPlan's smaller frame to a job (short side → width/height) */
export function withTargetSize(info: MediaInfo, job: Job, short?: number): Job {
  if (!short || !info.video) return job;
  const portrait = info.video.height > info.video.width;
  const turn = job.video?.rotate === 90 || job.video?.rotate === 270;
  const tall = portrait !== turn;
  return {
    ...job,
    video: { ...job.video, ...(tall ? { width: short } : { height: short }) },
  };
}

/** Rough output size, bytes (null when it can't be told) */
export function estimateBytes(
  info: MediaInfo,
  job: Job,
  videoBitrate: number,
  audioBits: number,
  copy: boolean,
): number | null {
  const dur = outDuration(info, job);
  if (!dur) return null;
  if (job.targetBytes && !copy)
    return Math.min(
      job.targetBytes,
      Math.round((((videoBitrate + audioBits) * dur) / 8) * 1.02),
    );
  if (copy) {
    const share = info.durationSec ? dur / info.durationSec : 1;
    let bits = info.sizeBytes * 8 * share;
    if ((job.audio?.drop || !info.audio) && info.audio)
      bits -= (info.audio.bitrate || 128_000) * dur;
    if (isAudioOut(job)) bits = (info.audio?.bitrate || 128_000) * dur;
    return Math.max(0, Math.round(bits / 8));
  }
  if (job.to === "wav" && info.audio)
    return Math.round(
      dur *
        (job.audio?.sampleRate ?? info.audio.sampleRate ?? 48_000) *
        (job.audio?.channels ?? info.audio.channels ?? 2) *
        2,
    );
  return Math.round((((videoBitrate + audioBits) * dur) / 8) * 1.02);
}

/* ---------- time and size text ---------- */

/** 75.25 → "1:15.2", 3725 → "1:02:05.0" */
export function fmtTime(sec: number, decimals = 1): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = s.toFixed(decimals).padStart(decimals ? 3 + decimals : 2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "1:15.2", "75.2", "1:02:05" → seconds (NaN when it isn't a time) */
export function parseTime(text: string): number {
  const parts = text.trim().replace(",", ".").split(":");
  if (
    !parts.length ||
    parts.length > 3 ||
    parts.some((p) => !/^\d*\.?\d*$/.test(p) || p === "")
  )
    return NaN;
  return parts.reduce((acc, p) => acc * 60 + parseFloat(p), 0);
}
