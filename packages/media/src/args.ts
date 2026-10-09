/**
 * Builds ffmpeg command lines from a Job (pure, no browser APIs). Used by the ffmpeg.wasm engine;
 * the same maths (sizes, bitrates) as the WebCodecs engine comes from ./plan.
 */
import { isAudioOut, outDuration } from "./plan";
import type { Container, Job, MediaInfo } from "./types";

export interface FfmpegPlan {
  width: number;
  height: number;
  videoBitrate: number;
  audioBitrate: number;
  /** Copy the video / audio stream as it is */
  copyVideo: boolean;
  copyAudio: boolean;
}

const n = (x: number) => String(Math.round(x * 1000) / 1000);

/** Video codecs each container can hold, as ffmpeg/ffprobe names them */
const VIDEO_OK: Partial<Record<Container, string[]>> = {
  mp4: ["h264", "hevc", "av1", "mpeg4"],
  mov: ["h264", "hevc", "prores", "mpeg4"],
  mkv: ["h264", "hevc", "vp8", "vp9", "av1", "mpeg4"],
  webm: ["vp8", "vp9", "av1"],
};
const AUDIO_OK: Partial<Record<Container, string[]>> = {
  mp4: ["aac", "mp3", "alac"],
  mov: ["aac", "mp3", "alac", "pcm_s16le", "pcm_s24le"],
  mkv: ["aac", "mp3", "opus", "vorbis", "flac", "ac3"],
  webm: ["opus", "vorbis"],
  m4a: ["aac", "alac"],
  mp3: ["mp3"],
  ogg: ["vorbis", "opus"],
  opus: ["opus"],
  flac: ["flac"],
  wav: ["pcm_s16le"],
};

/** Normalise codec names from either engine ("avc" → "h264", "pcm-s16" → "pcm_s16le") */
export function codecId(c: string | undefined): string {
  const s = (c ?? "").toLowerCase();
  if (s === "avc" || s.startsWith("avc1") || s === "h.264") return "h264";
  if (s === "hev1" || s === "hvc1" || s === "h.265") return "hevc";
  if (s.startsWith("pcm-s16")) return "pcm_s16le";
  if (s.startsWith("pcm-s24")) return "pcm_s24le";
  return s;
}

export function containerTakesVideo(to: Container, codec: string | undefined) {
  return !!VIDEO_OK[to]?.includes(codecId(codec));
}
export function containerTakesAudio(to: Container, codec: string | undefined) {
  return !!AUDIO_OK[to]?.includes(codecId(codec));
}

/** Whether the job leaves the picture alone (so the video stream could be copied) */
export function videoUntouched(
  info: MediaInfo,
  job: Job,
  resized: boolean,
): boolean {
  const v = job.video ?? {};
  return (
    !resized &&
    v.quality === undefined &&
    !job.targetBytes &&
    !v.fps &&
    (!v.rotate || metadataTurn(job)) &&
    !v.flip &&
    (v.speed ?? 1) === 1 &&
    !(v.codec && codecId(v.codec) !== codecId(info.video?.codec))
  );
}

/** The job turns the picture by the display rotation only (MP4/MOV, no flip): no re-encode */
export function metadataTurn(job: Job): boolean {
  const v = job.video ?? {};
  return (
    !!v.rotate &&
    !!v.rotateMetadata &&
    !v.flip &&
    (job.to === "mp4" || job.to === "mov")
  );
}

/** Whether the job leaves the sound alone */
export function audioUntouched(job: Job): boolean {
  const a = job.audio ?? {};
  return (
    !a.bitrate &&
    (a.volume ?? 1) === 1 &&
    !a.normalize &&
    !a.fadeInSec &&
    !a.fadeOutSec &&
    !a.sampleRate &&
    !a.channels &&
    !a.pitch &&
    !a.reverse &&
    !a.removeSilence &&
    !job.targetBytes &&
    (job.video?.speed ?? 1) === 1
  );
}

/** atempo only takes 0.5–2 per stage (newer builds 0.5–100), so chain stages */
function atempo(speed: number): string[] {
  const out: string[] = [];
  let s = speed;
  while (s > 2) {
    out.push("atempo=2");
    s /= 2;
  }
  while (s < 0.5) {
    out.push("atempo=0.5");
    s /= 0.5;
  }
  out.push(`atempo=${n(s)}`);
  return out;
}

/**
 * GIF filter graph: frame rate and size, then a palette made for this clip (palettegen, counting
 * only what changes between frames so moving parts get the colours) applied with the chosen
 * dithering (paletteuse). One command, two passes over the frames.
 */
export function gifFilter(
  job: Job,
  p: { width: number; height: number },
): string {
  const g = job.gif ?? {};
  const fps = g.fps ?? 12;
  const speed = job.video?.speed ?? 1;
  const colors = Math.max(2, Math.min(256, Math.round(g.colors ?? 256)));
  const dither =
    g.dither === false
      ? "none"
      : g.dither === "diffusion"
        ? "sierra2_4a"
        : "bayer:bayer_scale=4";
  const size = p.width > 0 ? `${p.width}:${p.height}` : `${g.width ?? 480}:-2`;
  return (
    `${speed !== 1 ? `setpts=PTS/${n(speed)},` : ""}fps=${n(fps)},scale=${size}:flags=lanczos,` +
    `split[s0][s1];[s0]palettegen=max_colors=${colors}:stats_mode=diff[pal];` +
    `[s1][pal]paletteuse=dither=${dither}:diff_mode=rectangle`
  );
}

/** Animated pictures (GIF, WebP) as a source: see-through parts get a solid background */
const ANIMATED = new Set(["gif", "webp"]);

function videoFilters(info: MediaInfo, job: Job, p: FfmpegPlan): string {
  const v = job.video ?? {};
  const f: string[] = [];
  if (ANIMATED.has(info.container)) {
    // Paint the frame's own copy flat in the background colour, then lay the frame over it
    const bg = (v.padColor ?? "#ffffff").replace("#", "0x");
    f.push(
      `format=rgba,split[kg][kt];[kg]drawbox=c=${bg}@1:t=fill[kgb];[kgb][kt]overlay=format=auto`,
    );
  }
  if (v.rotate === 90) f.push("transpose=1");
  else if (v.rotate === 180) f.push("hflip,vflip");
  else if (v.rotate === 270) f.push("transpose=2");
  if (v.flip === "h") f.push("hflip");
  else if (v.flip === "v") f.push("vflip");
  const W = p.width;
  const H = p.height;
  const fit = v.fit ?? "contain";
  const sized = !!(v.width || v.height);
  if (!sized) f.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
  else if (!(v.width && v.height) || fit === "stretch")
    f.push(`scale=${W}:${H}`);
  else if (fit === "cover")
    f.push(
      `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`,
    );
  else if (fit === "pad-blur") {
    const bw = Math.max(16, Math.round(W / 16 / 2) * 2);
    const bh = Math.max(16, Math.round(H / 16 / 2) * 2);
    f.push(
      `split[kb][kf];[kb]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},boxblur=4:2,scale=${W}:${H}[kbg];` +
        `[kf]scale=${W}:${H}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[kfg];` +
        `[kbg][kfg]overlay=(W-w)/2:(H-h)/2`,
    );
  } else {
    const color = (v.padColor ?? "black").replace("#", "0x");
    f.push(
      `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${color}`,
    );
  }
  f.push("setsar=1");
  if (v.fps) f.push(`fps=${n(v.fps)}`);
  if ((v.speed ?? 1) !== 1)
    // New timestamps, then back to a steady frame rate (frames dropped or repeated)
    f.push(
      `setpts=PTS/${n(v.speed!)}`,
      `fps=${n(v.fps ?? (info.video?.fps || 30))}`,
    );
  f.push("format=yuv420p");
  return f.join(",");
}

function audioFilters(info: MediaInfo, job: Job): string {
  const a = job.audio ?? {};
  const f: string[] = [];
  if (a.removeSilence) {
    const th = a.removeSilence.thresholdDb ?? -45;
    const d = a.removeSilence.minSec ?? 0.5;
    // Trim the start, then every gap longer than d (keeping a short pause so speech still breathes)
    f.push(
      `silenceremove=start_periods=1:start_threshold=${th}dB:start_silence=0.1:stop_periods=-1:stop_duration=${n(d)}:stop_threshold=${th}dB:stop_silence=0.25`,
    );
  }
  const speed = job.video?.speed ?? 1;
  if (speed !== 1)
    f.push(
      ...(a.keepPitch === false && info.audio?.sampleRate
        ? // Like a tape: faster is higher, slower is lower
          [
            `asetrate=${Math.round(info.audio.sampleRate * speed)}`,
            `aresample=${info.audio.sampleRate}`,
          ]
        : atempo(speed)),
    );
  if (a.pitch && info.audio?.sampleRate) {
    // Resample to shift the pitch, then stretch back to the same length
    const k = Math.pow(2, a.pitch / 12);
    f.push(
      `asetrate=${Math.round(info.audio.sampleRate * k)}`,
      `aresample=${info.audio.sampleRate}`,
      ...atempo(1 / k),
    );
  }
  if (a.reverse) f.push("areverse");
  if (a.normalize) f.push("loudnorm=I=-16:TP=-1.5:LRA=11");
  if ((a.volume ?? 1) !== 1) f.push(`volume=${n(a.volume!)}`);
  const dur = outDuration(info, job);
  if (a.fadeInSec) f.push(`afade=t=in:st=0:d=${n(a.fadeInSec)}`);
  if (a.fadeOutSec && dur > a.fadeOutSec)
    f.push(`afade=t=out:st=${n(dur - a.fadeOutSec)}:d=${n(a.fadeOutSec)}`);
  return f.join(",");
}

function videoCodec(job: Job, p: FfmpegPlan): string[] {
  const br = Math.max(50_000, p.videoBitrate);
  const rate = [
    "-b:v",
    String(br),
    "-maxrate",
    String(Math.round(br * 1.5)),
    "-bufsize",
    String(br * 2),
  ];
  const c = job.video?.codec;
  // WebM gets VP8: libvpx-vp9 in @ffmpeg/core 0.12 crashes ("memory access out of bounds").
  // The fast engine makes VP9 WebM; this is the fallback.
  if (job.to === "webm" || c === "vp9" || c === "vp8")
    return [
      "-c:v",
      "libvpx",
      ...rate,
      "-deadline",
      "realtime",
      "-cpu-used",
      "8",
    ];
  if (c === "hevc")
    return [
      "-c:v",
      "libx265",
      ...rate,
      "-preset",
      "ultrafast",
      "-tag:v",
      "hvc1",
    ];
  return [
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    ...rate,
    "-pix_fmt",
    "yuv420p",
  ];
}

function audioCodec(job: Job, p: FfmpegPlan): string[] {
  const br = p.audioBitrate ? ["-b:a", String(p.audioBitrate)] : [];
  const ac = job.audio?.channels ? ["-ac", String(job.audio.channels)] : [];
  const extra = [
    ...(job.audio?.sampleRate ? ["-ar", String(job.audio.sampleRate)] : []),
    ...ac,
  ];
  switch (job.to) {
    // libopus in @ffmpeg/core 0.12 crashes ("memory access out of bounds"): WebM and Ogg get
    // Vorbis, .opus files ffmpeg's own Opus encoder (48 kHz only). The fast engine uses Opus.
    case "webm":
    case "ogg":
      return ["-c:a", "libvorbis", ...br, ...extra];
    case "opus":
      return ["-c:a", "opus", "-strict", "-2", "-ar", "48000", ...br, ...ac];
    case "mp3":
      return ["-c:a", "libmp3lame", ...br, ...extra];
    case "wav":
      return ["-c:a", "pcm_s16le", ...extra];
    case "flac":
      return ["-c:a", "flac", ...extra];
    default:
      return ["-c:a", "aac", ...br, ...extra];
  }
}

/**
 * ffmpeg arguments for one input. `input` and `output` are paths inside ffmpeg's file system.
 */
export function ffmpegArgs(
  info: MediaInfo,
  job: Job,
  p: FfmpegPlan,
  input: string,
  output: string,
): string[] {
  const a: string[] = ["-hide_banner", "-y"];
  if (job.trim) a.push("-ss", n(Math.max(0, job.trim.start)));
  if ((job.repeat ?? 1) > 1)
    a.push("-stream_loop", String(Math.round(job.repeat!) - 1));
  a.push("-i", input);
  if (job.trim) a.push("-t", n(Math.max(0.05, job.trim.end - job.trim.start)));
  a.push("-map_metadata", "0", "-map_chapters", "-1", "-sn", "-dn");
  // Where it was filmed stays private: the location tag isn't copied
  a.push("-metadata", "location=", "-metadata", "location-eng=");

  if (job.to === "gif") {
    a.push(
      "-vf",
      gifFilter(job, p),
      "-an",
      "-loop",
      job.gif?.loop === false ? "-1" : "0",
      output,
    );
    return a;
  }

  const noVideo = isAudioOut(job) || !info.video;
  const noAudio = !!job.audio?.drop || !info.audio;
  if (!noVideo) a.push("-map", "0:v:0");
  if (!noAudio) a.push("-map", "0:a:0");

  if (noVideo) a.push("-vn");
  else if (p.copyVideo) {
    a.push("-c:v", "copy");
    if (metadataTurn(job))
      a.push(
        "-metadata:s:v:0",
        // ffmpeg 5.1's mov muxer reads this tag counter-clockwise
        `rotate=${(360 - (((info.video?.rotation ?? 0) + job.video!.rotate!) % 360)) % 360}`,
      );
  } else a.push("-vf", videoFilters(info, job, p), ...videoCodec(job, p));

  if (noAudio) a.push("-an");
  else if (p.copyAudio) a.push("-c:a", "copy");
  else {
    const af = audioFilters(info, job);
    if (af) a.push("-af", af);
    a.push(...audioCodec(job, p));
  }

  if (job.to === "mp4" || job.to === "mov" || job.to === "m4a")
    a.push("-movflags", "+faststart");
  if (job.to === "mp4" && p.copyVideo && codecId(info.video?.codec) === "hevc")
    a.push("-tag:v", "hvc1");
  // Copying from the middle of a file: start at the keyframe, keep timestamps sane
  if (job.trim && (p.copyVideo || p.copyAudio))
    a.push("-avoid_negative_ts", "make_zero");
  if (job.to === "m4a") a.push("-f", "ipod");
  a.push(output);
  return a;
}

/**
 * ffmpeg arguments that join several inputs end to end (re-encoded to one size, frame rate and
 * sound format, so clips of any shape can be joined). Inputs without sound get silence.
 */
export function concatArgs(
  infos: MediaInfo[],
  job: Job,
  p: FfmpegPlan,
  inputs: string[],
  output: string,
): string[] {
  const a: string[] = ["-hide_banner", "-y"];
  for (const i of inputs) a.push("-i", i);
  if (isAudioOut(job) || infos.every((i) => !i.video)) {
    // Sound only: each file's sound in a row (a silent gap for a file without any)
    const parts = infos.map((info, i) =>
      info.audio
        ? `[${i}:a:0]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`
        : `anullsrc=r=48000:cl=stereo,atrim=duration=${n(info.durationSec)}[a${i}]`,
    );
    parts.push(
      `${infos.map((_, i) => `[a${i}]`).join("")}concat=n=${infos.length}:v=0:a=1[aout]`,
    );
    a.push("-filter_complex", parts.join(";"), "-map", "[aout]", "-vn");
    a.push(...audioCodec(job, p), output);
    return a;
  }
  const W = p.width;
  const H = p.height;
  const fps = job.video?.fps ?? Math.round(infos[0]?.video?.fps || 30);
  const withAudio = !job.audio?.drop && infos.some((i) => i.audio);
  const parts: string[] = [];
  const pads: string[] = [];
  infos.forEach((info, i) => {
    if (job.video?.fit === "pad-blur") {
      // A blurred, enlarged copy fills the frame behind the whole clip
      const bw = Math.max(16, Math.round(W / 16 / 2) * 2);
      const bh = Math.max(16, Math.round(H / 16 / 2) * 2);
      parts.push(
        `[${i}:v:0]split[b${i}][f${i}]`,
        `[b${i}]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},boxblur=4:2,scale=${W}:${H}[bg${i}]`,
        `[f${i}]scale=${W}:${H}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[fg${i}]`,
        `[bg${i}][fg${i}]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=${fps},format=yuv420p[v${i}]`,
      );
    } else {
      const color = (job.video?.padColor ?? "black").replace("#", "0x");
      parts.push(
        `[${i}:v:0]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${color},setsar=1,fps=${fps},format=yuv420p[v${i}]`,
      );
    }
    pads.push(`[v${i}]`);
    if (withAudio) {
      parts.push(
        info.audio
          ? `[${i}:a:0]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`
          : `anullsrc=r=48000:cl=stereo,atrim=duration=${n(info.durationSec)}[a${i}]`,
      );
      pads.push(`[a${i}]`);
    }
  });
  parts.push(
    `${pads.join("")}concat=n=${infos.length}:v=1:a=${withAudio ? 1 : 0}[vout]${withAudio ? "[aout]" : ""}`,
  );
  a.push("-filter_complex", parts.join(";"), "-map", "[vout]");
  if (withAudio) a.push("-map", "[aout]");
  a.push(...videoCodec(job, p));
  if (withAudio) a.push(...audioCodec(job, p));
  if (job.to === "mp4" || job.to === "mov") a.push("-movflags", "+faststart");
  a.push(output);
  return a;
}
