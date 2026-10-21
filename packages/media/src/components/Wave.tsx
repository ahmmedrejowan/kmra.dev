import { useEffect, useRef, useState } from "react";
import { waveform } from "../engine";

/**
 * Draw a waveform (min/max pairs from `waveform()`) into a canvas, one bar per pixel column,
 * mirrored around the middle. `played` (0–1) colours the part before the playhead.
 */
export function drawPeaks(
  c: HTMLCanvasElement,
  peaks: Float32Array,
  opts: { played?: number; color: string },
) {
  const ctx = c.getContext("2d")!;
  const W = c.width;
  const H = c.height;
  ctx.clearRect(0, 0, W, H);
  const n = peaks.length / 2;
  // Scale so the loudest part fills most of the height (quiet files stay visible)
  let top = 0.05;
  for (let i = 0; i < peaks.length; i++)
    top = Math.max(top, Math.abs(peaks[i]!));
  const k = ((H / 2) * 0.92) / top;
  const mid = H / 2;
  const cut = (opts.played ?? 0) * W;
  ctx.save();
  for (let x = 0; x < W; x++) {
    const b0 = Math.floor((x / W) * n);
    const b1 = Math.max(b0 + 1, Math.floor(((x + 1) / W) * n));
    let lo = 0;
    let hi = 0;
    for (let b = b0; b < b1 && b < n; b++) {
      lo = Math.min(lo, peaks[b * 2]!);
      hi = Math.max(hi, peaks[b * 2 + 1]!);
    }
    const y0 = mid - hi * k;
    const h = Math.max(1, (hi - lo) * k);
    // Unplayed: a light tint of the colour; played: the full colour
    ctx.globalAlpha = x < cut ? 1 : 0.32;
    ctx.fillStyle = opts.color;
    ctx.fillRect(x, y0, 1, h);
  }
  ctx.restore();
}

/** The page's accent colour, for waveforms */
export function waveColors(el: Element) {
  const color =
    getComputedStyle(el).getPropertyValue("--acc").trim() || "#d6409f";
  return { color };
}

/** A file's waveform peaks (null while loading, or when the file has no readable sound) */
export function usePeaks(file: Blob | null, n = 1200) {
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [failed, setFailed] = useState(false);
  const cur = useRef<Blob | null>(null);
  useEffect(() => {
    cur.current = file;
    setPeaks(null);
    setFailed(false);
    if (!file) return;
    const f =
      file instanceof File
        ? file
        : new File([file], "audio", { type: file.type });
    const ac = new AbortController();
    waveform(f, n, { signal: ac.signal })
      .then((p) => cur.current === file && setPeaks(p))
      .catch(() => cur.current === file && setFailed(true));
    return () => ac.abort();
  }, [file, n]);
  return { peaks, failed };
}
