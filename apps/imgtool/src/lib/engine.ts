import type { Settings } from "./settings";
import type { EncodeResult, WorkerRequest } from "./image.worker";

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
type Body = WorkerRequest extends infer R
  ? R extends { id: number }
    ? Omit<R, "id">
    : never
  : never;

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./image.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id);
      if (!p) return;
      pending.delete(data.id);
      if (data.ok) p.resolve(data.value);
      else p.reject(new Error(data.error));
    };
  }
  return worker;
}

function call<T>(body: Body): Promise<T> {
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    getWorker().postMessage({ ...body, id });
  });
}

export const engine = {
  load: (key: string, file: Blob) =>
    call<{ w: number; h: number }>({ kind: "load", key, file }),
  drop: (key: string) => call<void>({ kind: "drop", key }),
  encode: (key: string, srcType: string, settings: Settings) =>
    call<EncodeResult>({ kind: "encode", key, srcType, settings }),
  sample: async () =>
    new File([await call<Blob>({ kind: "sample" })], "sample-sunset.jpg", {
      type: "image/jpeg",
    }),
};

export type { EncodeResult };
