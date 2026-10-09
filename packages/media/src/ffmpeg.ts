/**
 * The compatible engine: ffmpeg.wasm (@ffmpeg/ffmpeg + @ffmpeg/core), loaded only when a job
 * needs it. The core's JS and wasm are served from this site (`/ffmpeg/`, copied from
 * node_modules at build), never from a CDN. ffmpeg runs in its own worker; inputs are mounted
 * with WORKERFS (read straight from the File, not copied into memory).
 *
 * The multi-threaded core would be used when the page is cross-origin isolated and the site ships
 * it under `/ffmpeg/mt/`; no app does (core-mt 0.12.10 hung on encodes, see vidtool's
 * astro.config.mjs), so it's the single-threaded core.
 *
 * Known gaps in @ffmpeg/core 0.12.10, worked around in ./args: libvpx-vp9 and libopus crash
 * ("memory access out of bounds"), so ffmpeg makes WebM as VP8 + Vorbis. The fast engine (./wc)
 * makes VP9 + Opus. A run that crashes takes its instance down; the next job starts a fresh one.
 */
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { MediaInfo, Progress } from "./types";

let base = "/ffmpeg/";
/** Where the core files are served (same origin). Default "/ffmpeg/". */
export function setFfmpegBase(url: string) {
  base = url.endsWith("/") ? url : `${url}/`;
}

let instance: Promise<FFmpeg> | null = null;
let wasmUrl: Promise<string> | null = null;
let multi = false;
/** One job at a time: ffmpeg has one file system and one log stream */
let queue: Promise<unknown> = Promise.resolve();

const abs = (p: string) => new URL(p, location.href).href;

/** Whether ffmpeg has been downloaded (the next job needs no download) */
export function ffmpegLoaded(): boolean {
  return wasmUrl !== null;
}
/** Whether the multi-threaded core is in use (after load) */
export function ffmpegThreads(): "multi" | "single" {
  return multi ? "multi" : "single";
}

let mtCheck: Promise<boolean> | null = null;
function useMulti(): Promise<boolean> {
  mtCheck ??= (async () => {
    if (typeof crossOriginIsolated === "undefined" || !crossOriginIsolated)
      return false;
    try {
      const r = await fetch(`${base}mt/ffmpeg-core.js`, { method: "HEAD" });
      return r.ok;
    } catch {
      return false;
    }
  })();
  return mtCheck;
}

/** Download the wasm once with progress, keep it as a blob: URL for reloads after a cancel. */
function fetchWasm(
  url: string,
  onRatio?: (r: number) => void,
): Promise<string> {
  wasmUrl ??= (async () => {
    const res = await fetch(url);
    if (!res.ok || !res.body)
      throw new Error(`Couldn't load the video engine (${res.status})`);
    const total = Number(res.headers.get("content-length")) || 32_000_000;
    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      got += value.length;
      onRatio?.(Math.min(0.99, got / total));
    }
    return URL.createObjectURL(
      new Blob(parts as BlobPart[], { type: "application/wasm" }),
    );
  })().catch((e) => {
    wasmUrl = null;
    throw e;
  });
  return wasmUrl;
}

/** Load ffmpeg (downloads ~31 MB the first time; the service worker keeps it after that). */
export function loadFfmpeg(
  onProgress?: (p: Progress) => void,
): Promise<FFmpeg> {
  instance ??= (async () => {
    const say = (ratio: number) =>
      onProgress?.({
        ratio,
        stage: "Loading the video engine",
        engine: "ffmpeg",
      });
    // Only the first load downloads anything; later ones (a fresh instance per job) are quick
    const fresh = !wasmUrl;
    if (fresh) say(0);
    const [{ FFmpeg }, mt] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      useMulti(),
    ]);
    multi = mt;
    const dir = mt ? `${base}mt/` : base;
    const wasm = await fetchWasm(
      abs(`${dir}ffmpeg-core.wasm`),
      fresh ? say : undefined,
    );
    const ff = new FFmpeg();
    await ff.load({
      coreURL: abs(`${dir}ffmpeg-core.js`),
      wasmURL: wasm,
      ...(mt ? { workerURL: abs(`${dir}ffmpeg-core.worker.js`) } : {}),
    });
    if (fresh) say(1);
    return ff;
  })().catch((e) => {
    instance = null;
    throw e;
  });
  return instance;
}

/**
 * Stop ffmpeg (on cancel, or after a run that crashed: a wasm trap leaves the instance unusable);
 * the next job starts a fresh one, which only costs compiling the already-downloaded wasm.
 */
async function kill() {
  const p = instance;
  instance = null;
  if (!p) return;
  try {
    (await p).terminate();
  } catch {
    /* already gone */
  }
}

function abortError() {
  return new DOMException("The job was cancelled", "AbortError");
}

/** "00:01:02.50" → 62.5 */
function clock(s: string) {
  const [h, m, sec] = s.split(":").map(Number);
  return (h ?? 0) * 3600 + (m ?? 0) * 60 + (sec ?? 0);
}

export interface FfmpegTask {
  files: File[];
  /** Build the command from the mounted input paths and the output path */
  args: (inputs: string[], output: string) => string[];
  /** Output file extension */
  ext: string;
  /** Expected output duration (for progress), seconds */
  duration: number;
  /** Progress stage text ("Converting", "Compressing" …) */
  stage?: string;
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
}

let jobNo = 0;

/** Run one ffmpeg command; resolves with the output bytes. */
export function runFfmpeg(t: FfmpegTask): Promise<Uint8Array> {
  const job = queue.then(() => exec(t));
  queue = job.catch(() => {});
  return job;
}

async function exec(t: FfmpegTask): Promise<Uint8Array> {
  if (t.signal?.aborted) throw abortError();
  const ff = await loadFfmpeg(t.onProgress);
  if (t.signal?.aborted) throw abortError();
  const id = ++jobNo;
  const dir = `/job${id}`;
  const out = `/out${id}.${t.ext}`;
  // Neutral names: ffmpeg would read "a:b.mp4" as a protocol
  const files = t.files.map(
    (f, i) =>
      new File(
        [f],
        `in${i}.${(f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"}`,
        { type: f.type },
      ),
  );
  await ff.createDir(dir);
  await ff.mount("WORKERFS" as never, { files }, dir);
  const inputs = files.map((f) => `${dir}/${f.name}`);
  const log: string[] = [];
  const stage = t.stage ?? "Converting";
  const onLog = ({ message }: { message: string }) => {
    log.push(message);
    if (log.length > 60) log.shift();
    const m = /time=\s*(-?\d+:\d+:\d+(?:\.\d+)?)/.exec(message);
    if (m && t.duration > 0)
      t.onProgress?.({
        ratio: Math.max(0, Math.min(0.99, clock(m[1]!) / t.duration)),
        stage,
        engine: "ffmpeg",
      });
  };
  ff.on("log", onLog);
  let aborted = false;
  let ok = false;
  const onAbort = () => {
    aborted = true;
    void kill();
  };
  t.signal?.addEventListener("abort", onAbort);
  try {
    t.onProgress?.({ ratio: 0, stage, engine: "ffmpeg" });
    const code = await ff.exec(t.args(inputs, out));
    if (aborted) throw abortError();
    if (code !== 0) {
      const why = log
        .filter((l) => /error|invalid|not|unsupported|failed/i.test(l))
        .slice(-3);
      throw new Error(
        `The video engine stopped (${code}). ${why.join(" ")}`.trim(),
      );
    }
    const data = (await ff.readFile(out)) as Uint8Array;
    await ff.deleteFile(out).catch(() => {});
    ok = true;
    return data;
  } catch (e) {
    if (aborted || t.signal?.aborted) throw abortError();
    throw e;
  } finally {
    t.signal?.removeEventListener("abort", onAbort);
    if (!aborted) {
      ff.off("log", onLog);
      if (ok) {
        await ff.unmount(dir).catch(() => {});
        await ff.deleteDir(dir).catch(() => {});
      } else await kill();
    }
  }
}

/* ---------- probe (ffprobe) ---------- */

interface ProbeJson {
  format?: {
    format_name?: string;
    duration?: string;
    bit_rate?: string;
    size?: string;
  };
  streams?: {
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    pix_fmt?: string;
    r_frame_rate?: string;
    avg_frame_rate?: string;
    bit_rate?: string;
    sample_rate?: string;
    channels?: number;
    duration?: string;
    tags?: Record<string, string>;
    side_data_list?: { rotation?: number }[];
    disposition?: { attached_pic?: number };
  }[];
}

const rate = (r?: string) => {
  if (!r) return 0;
  const [a, b] = r.split("/").map(Number);
  return b ? (a ?? 0) / b : (a ?? 0);
};

const CONTAINERS: [RegExp, string][] = [
  [/mov,mp4/, "mp4"],
  [/matroska,webm/, "matroska"],
  [/^avi/, "avi"],
  [/flv/, "flv"],
  [/asf/, "asf"],
  [/gif/, "gif"],
  [/mpegts/, "ts"],
  [/^mpeg/, "mpeg"],
  [/mp3/, "mp3"],
  [/wav/, "wav"],
  [/ogg/, "ogg"],
];

/** Read a file's details with ffprobe (for formats the fast reader doesn't know). */
export async function probeFfmpeg(
  file: File,
  onProgress?: (p: Progress) => void,
): Promise<MediaInfo> {
  const task = queue.then(async () => {
    const ff = await loadFfmpeg(onProgress);
    const id = ++jobNo;
    const dir = `/probe${id}`;
    const ext =
      (file.name.split(".").pop() || "bin")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "bin";
    const f = new File([file], `in.${ext}`);
    await ff.createDir(dir);
    await ff.mount("WORKERFS" as never, { files: [f] }, dir);
    try {
      await ff.ffprobe([
        "-v",
        "error",
        "-show_format",
        "-show_streams",
        "-of",
        "json",
        `${dir}/${f.name}`,
        "-o",
        `/probe${id}.json`,
      ]);
      const text = (await ff.readFile(`/probe${id}.json`, "utf8")) as string;
      await ff.deleteFile(`/probe${id}.json`).catch(() => {});
      await ff.unmount(dir).catch(() => {});
      await ff.deleteDir(dir).catch(() => {});
      return JSON.parse(text) as ProbeJson;
    } catch (e) {
      await kill();
      throw e;
    }
  });
  queue = task.catch(() => {});
  const json = await task;
  const fmt = json.format ?? {};
  const streams = json.streams ?? [];
  const v = streams.find(
    (s) => s.codec_type === "video" && !s.disposition?.attached_pic,
  );
  const a = streams.find((s) => s.codec_type === "audio");
  const name = fmt.format_name ?? "";
  let container =
    CONTAINERS.find(([re]) => re.test(name))?.[1] ?? name.split(",")[0] ?? "";
  if (container === "mp4" && /\.mov$/i.test(file.name)) container = "mov";
  if (container === "matroska" && /\.webm$/i.test(file.name))
    container = "webm";
  const durationSec =
    Number(fmt.duration) || Number(v?.duration) || Number(a?.duration) || 0;
  let rotation = 0;
  if (v) {
    const r =
      v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ??
      Number(v.tags?.rotate ?? 0);
    rotation = (((-r % 360) + 360) % 360) as number;
  }
  const turned = rotation === 90 || rotation === 270;
  return {
    container,
    durationSec,
    sizeBytes: file.size,
    bitrate:
      Number(fmt.bit_rate) || (durationSec ? (file.size * 8) / durationSec : 0),
    video: v
      ? {
          codec: v.codec_name ?? "",
          width: (turned ? v.height : v.width) ?? 0,
          height: (turned ? v.width : v.height) ?? 0,
          rotation,
          fps:
            Math.round((rate(v.avg_frame_rate) || rate(v.r_frame_rate)) * 100) /
            100,
          bitrate: Number(v.bit_rate) || 0,
          pixelFormat: v.pix_fmt,
        }
      : undefined,
    audio: a
      ? {
          codec: a.codec_name ?? "",
          sampleRate: Number(a.sample_rate) || 0,
          channels: a.channels ?? 0,
          bitrate: Number(a.bit_rate) || 0,
        }
      : undefined,
    other: streams
      .filter(
        (s) =>
          s !== v &&
          s !== a &&
          s.codec_type !== "video" &&
          s.codec_type !== "audio",
      )
      .map((s) => `${s.codec_type ?? "data"}: ${s.codec_name ?? "?"}`),
  };
}
