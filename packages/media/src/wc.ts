/**
 * Main-thread client for the fast engine's worker (./wc.worker.ts). One worker, started on first
 * use; each call has an id, progress messages and a final reply. Internal: tools use ./engine.
 */
import type { Container, Engine, Job, MediaInfo } from "./types";

export interface WcPlan {
  width: number;
  height: number;
  videoBitrate: number;
  audioBitrate: number;
  /** The output frame differs from the source */
  resized: boolean;
}

export type WcRequest =
  | { op: "probe"; id: number; file: File }
  | {
      op: "convert";
      id: number;
      file: File;
      info: MediaInfo;
      job: Job;
      plan: WcPlan;
    }
  | { op: "thumbs"; id: number; file: File; times: number[]; height: number }
  | {
      op: "frame";
      id: number;
      file: File;
      t: number;
      width?: number;
      type: string;
      quality: number;
    }
  | {
      op: "stills";
      id: number;
      file: File;
      times: number[];
      width?: number;
      type: string;
      quality: number;
    }
  | {
      op: "scenes";
      id: number;
      file: File;
      start: number;
      end: number;
      threshold: number;
      max: number;
    }
  | { op: "concat"; id: number; files: File[]; to: Container }
  | { op: "peaks"; id: number; file: File; n: number }
  | { op: "cancel"; target: number };

interface Reply {
  id: number;
  done?: boolean;
  result?: unknown;
  error?: string;
  unsupported?: boolean;
  fatal?: boolean;
  aborted?: boolean;
  ratio?: number;
  engine?: Engine;
  thumb?: { i: number; t: number; bitmap: ImageBitmap };
  still?: { i: number; t: number; blob: Blob };
}

/** The fast engine can't do this job; use ffmpeg */
export class WcUnsupported extends Error {}
/** The file itself is the problem (no sound to extract …); don't retry elsewhere */
export class WcFatal extends Error {}

let worker: Worker | null = null;
let next = 1;
const pending = new Map<number, (r: Reply) => void>();

function get(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./wc.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (e: MessageEvent<Reply>) =>
    pending.get(e.data.id)?.(e.data);
  worker.onerror = () => {
    // A crash (out of memory …): fail everything in flight, start fresh next time
    for (const cb of pending.values())
      cb({ id: 0, done: true, error: "The fast engine stopped" });
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

type Payload<T> = T extends { op: infer _ } ? Omit<T, "id"> : never;

export function call<T>(
  msg: Payload<Exclude<WcRequest, { op: "cancel" }>>,
  on?: (r: Reply) => void,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted)
    return Promise.reject(
      new DOMException("The job was cancelled", "AbortError"),
    );
  const id = next++;
  const w = get();
  return new Promise<T>((resolve, reject) => {
    const abort = () => w.postMessage({ op: "cancel", target: id });
    signal?.addEventListener("abort", abort);
    pending.set(id, (r) => {
      if (!r.done) return on?.(r);
      pending.delete(id);
      signal?.removeEventListener("abort", abort);
      if (r.aborted || signal?.aborted)
        reject(new DOMException("The job was cancelled", "AbortError"));
      else if (r.error !== undefined)
        reject(
          r.fatal
            ? new WcFatal(r.error)
            : r.unsupported
              ? new WcUnsupported(r.error)
              : new Error(r.error),
        );
      else resolve(r.result as T);
    });
    w.postMessage({ ...msg, id });
  });
}
