/// <reference lib="webworker" />
/**
 * Frames as pictures on the fast engine, used by ./wc.worker.ts: many stills at given times
 * (extract frames, contact sheets) and scene-change detection. Mediabunny decodes with WebCodecs
 * (hardware where available) and scales on a canvas.
 */
import { CanvasSink, type InputVideoTrack } from "mediabunny";

/**
 * Pictures at the given times (each is the frame showing at that moment), sent one by one
 * through `onFrame` as they're encoded.
 */
export async function stillsAt(
  track: InputVideoTrack,
  times: number[],
  opts: { width?: number; type: string; quality: number },
  onFrame: (i: number, t: number, blob: Blob) => void,
  cancelled: () => boolean,
): Promise<void> {
  const sink = new CanvasSink(track, {
    ...(opts.width ? { width: opts.width } : {}),
    poolSize: 1,
  });
  let i = 0;
  for await (const c of sink.canvasesAtTimestamps(times)) {
    if (cancelled()) break;
    if (c) {
      const blob = await (c.canvas as OffscreenCanvas).convertToBlob({
        type: opts.type,
        quality: opts.quality,
      });
      onFrame(i, c.timestamp, blob);
    }
    i++;
  }
}

/**
 * Times where the picture changes a lot (cuts), like ffmpeg's `select='gt(scene,T)'`: every frame
 * is compared with the one before on a small copy; the score is the smaller of the mean absolute
 * difference and its change from the previous pair, as a share of the full range (0–1), so a
 * steady pan doesn't count but a cut does. The first frame of the range always counts.
 */
export async function sceneTimes(
  track: InputVideoTrack,
  opts: { start: number; end: number; threshold: number; max: number },
  onRatio: (r: number) => void,
  cancelled: () => boolean,
): Promise<number[]> {
  const sink = new CanvasSink(track, {
    width: 64,
    height: 36,
    fit: "fill",
    poolSize: 1,
  });
  const span = Math.max(0.001, opts.end - opts.start);
  const out: number[] = [];
  let prev: Uint8ClampedArray | null = null;
  let prevMafd = 0;
  let n = 0;
  for await (const c of sink.canvases(opts.start, opts.end)) {
    if (cancelled()) break;
    const cv = c.canvas as OffscreenCanvas;
    const px = cv
      .getContext("2d", { willReadFrequently: true })!
      .getImageData(0, 0, cv.width, cv.height).data;
    if (!prev) out.push(Math.max(opts.start, c.timestamp));
    else {
      let sad = 0;
      for (let k = 0; k < px.length; k += 4)
        sad +=
          Math.abs(px[k]! - prev[k]!) +
          Math.abs(px[k + 1]! - prev[k + 1]!) +
          Math.abs(px[k + 2]! - prev[k + 2]!);
      const mafd = (sad * 100) / ((px.length / 4) * 3 * 256);
      const score = Math.min(mafd, Math.abs(mafd - prevMafd)) / 100;
      prevMafd = mafd;
      if (score > opts.threshold) out.push(c.timestamp);
    }
    prev = new Uint8ClampedArray(px);
    if (out.length >= opts.max) break;
    if (++n % 10 === 0)
      onRatio(Math.min(0.99, (c.timestamp - opts.start) / span));
  }
  return out;
}
