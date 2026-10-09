/**
 * The contract between the video/audio tools (apps/vidtool, later apps/audiotool) and the media
 * engine in this package. Tools describe WHAT they want as a Job; the engine decides HOW: the
 * fast path uses WebCodecs (hardware encoders) where the browser supports the codecs, otherwise
 * ffmpeg.wasm (self-hosted, in a worker). Everything runs on the device.
 */

export type VideoContainer = "mp4" | "webm" | "mov" | "mkv";
export type AudioContainer = "mp3" | "m4a" | "wav" | "ogg" | "opus" | "flac";
export type Container = VideoContainer | AudioContainer | "gif";

export interface MediaInfo {
  /** Detected container, e.g. "mp4", "mov", "webm", "matroska", "avi", "gif" */
  container: string;
  durationSec: number;
  sizeBytes: number;
  /** Overall bitrate, bits per second (0 if unknown) */
  bitrate: number;
  video?: {
    /** "h264", "hevc", "vp9", "av1", "mpeg4" … */
    codec: string;
    /** Display size: what a player shows, after `rotation` (a portrait phone clip is 1080×1920) */
    width: number;
    height: number;
    /** Display rotation from metadata (0, 90, 180, 270) */
    rotation: number;
    fps: number;
    bitrate: number;
    pixelFormat?: string;
    /** Full codec string when known, e.g. "avc1.64001f", "vp09.00.10.08" */
    codecString?: string;
    /** Codec profile and level for people, e.g. "High, level 3.1" */
    profile?: string;
    /** Bits per colour sample (8, 10 …) when known */
    bitDepth?: number;
    /** Colour description from the stream (names as WebCodecs/ffprobe give them) */
    colour?: {
      primaries?: string;
      transfer?: string;
      matrix?: string;
      fullRange?: boolean;
    };
    /** High dynamic range (PQ or HLG transfer) */
    hdr?: boolean;
    /** Stored frame size before rotation and pixel aspect */
    codedWidth?: number;
    codedHeight?: number;
  };
  audio?: {
    codec: string;
    sampleRate: number;
    channels: number;
    bitrate: number;
    /** Full codec string when known, e.g. "mp4a.40.2" (AAC-LC) */
    codecString?: string;
    profile?: string;
  };
  /** Other streams (subtitles, data), human-readable */
  other?: string[];
  /**
   * Descriptive tags from the file, keyed by a readable name: "Created", "Encoder", "Title",
   * "Location" (ISO 6709, e.g. "+40.7128-074.0060/") … Only what the file has.
   */
  tags?: Record<string, string>;
}

export type Fit = "contain" | "cover" | "pad-blur" | "stretch";

/** Which engine does (or would do) a job */
export type Engine = "webcodecs" | "ffmpeg" | "copy";

/** Video codecs a job may ask for; the engine picks one the container and browser support otherwise */
export type VideoCodecName = "h264" | "hevc" | "vp8" | "vp9" | "av1";

export interface Job {
  to: Container;
  /** Keep only this part, in seconds */
  trim?: { start: number; end: number };
  video?: {
    /** Output size; omit to keep the source size (after rotation) */
    width?: number;
    height?: number;
    /** How to fit a different aspect ratio */
    fit?: Fit;
    /** Background for "contain" padding (CSS colour) */
    padColor?: string;
    /** 0 (smallest) – 100 (best); ignored when targetBytes is set */
    quality?: number;
    fps?: number;
    /** Preferred codec (falls back to what the container and browser support) */
    codec?: VideoCodecName;
    /** Clockwise turn applied on top of the source rotation */
    rotate?: 0 | 90 | 180 | 270;
    /**
     * Turn by changing the display rotation only (no re-encode, instant) when the output is MP4 or
     * MOV and nothing else changes the picture. Players that ignore the rotation show it unturned.
     */
    rotateMetadata?: boolean;
    flip?: "h" | "v";
    /** Playback speed factor (0.25–4) */
    speed?: number;
    /** Drop the video stream (audio-only outputs set this) */
    drop?: boolean;
  };
  audio?: {
    drop?: boolean;
    /**
     * With `video.speed`: keep the sound's pitch (time-stretch; default) or let it rise and fall
     * with the speed like a tape (false)
     */
    keepPitch?: boolean;
    /** kbps */
    bitrate?: number;
    /** Volume factor (1 = unchanged) */
    volume?: number;
    /** Loudness normalisation (EBU R128) */
    normalize?: boolean;
    fadeInSec?: number;
    fadeOutSec?: number;
    sampleRate?: number;
    channels?: 1 | 2;
  };
  /** Aim for an output at or under this size (two-pass/bitrate maths) */
  targetBytes?: number;
  /** Prefer copying streams without re-encoding when the job allows it */
  copyWhenPossible?: boolean;
  /**
   * GIF output (`to: "gif"`): width in pixels (height follows), frame rate, whether it loops
   * forever, dithering (true/"bayer" = ordered pattern, smallest; "diffusion" = error diffusion,
   * smoothest gradients, larger; false = none, flat colours) and the palette size (2–256 colours,
   * default 256). The palette is made for the clip first (palettegen), then applied (paletteuse).
   */
  gif?: {
    width?: number;
    fps?: number;
    loop?: boolean;
    dither?: boolean | "bayer" | "diffusion";
    colors?: number;
  };
  /**
   * Play the input this many times in a row (default 1). Meant for short animations (GIF to MP4).
   * See-through parts of an animated GIF/WebP get `video.padColor` (default white) in a video.
   */
  repeat?: number;
}

export interface Progress {
  /** 0–1 */
  ratio: number;
  /** Short English status ("Loading the video engine", "Encoding"), translated by the UI */
  stage: string;
  /** Which engine is doing the work */
  engine?: Engine;
}

export interface RunOptions {
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
  /** Force an engine ("auto" = fastest that can do the job). "copy" falls back to the others. */
  engine?: "auto" | "webcodecs" | "ffmpeg";
  /** Base name for the output file (defaults to the input's name) */
  name?: string;
  /** Added to the output name, e.g. "compressed" → "clip-compressed.mp4" */
  suffix?: string;
}

/** What `plan()` decided for a job before it runs */
export interface Plan {
  engine: Engine;
  /** Output size after rotation, fit and scaling (0 when there's no video) */
  width: number;
  height: number;
  /** Video bitrate the encoder aims for, bits per second (0 = copied or no video) */
  videoBitrate: number;
  /** Audio bitrate, bits per second (0 = copied, none or uncompressed) */
  audioBitrate: number;
  /** Estimated output size in bytes (null when it can't be told, e.g. stream copy of part of a file) */
  estimatedBytes: number | null;
  /** Short English reason when the slower engine is used ("This format needs the compatible engine") */
  reason?: string;
}

export interface Output {
  blob: Blob;
  /** Suggested file name, e.g. "holiday-compressed.mp4" */
  name: string;
  info?: MediaInfo;
  engine: Engine;
  /** Wall-clock time the job took, milliseconds */
  ms: number;
}
