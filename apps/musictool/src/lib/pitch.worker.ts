/// <reference lib="webworker" />
/**
 * The tuner's analysis, off the main thread: keeps the last window of microphone samples (sent
 * by the worklet in 1024-sample blocks), runs the pitch detector on every block and posts the
 * reading to the page. Samples are overwritten as new ones arrive; nothing is kept or sent.
 */
import { detectPitch, windowSize } from "./pitch";

let rate = 48000;
let ring = new Float32Array(windowSize(rate));
let filled = 0;
let input: MessagePort | null = null;

function onBlock(block: Float32Array) {
  const n = ring.length;
  if (block.length >= n) ring.set(block.subarray(block.length - n));
  else {
    ring.copyWithin(0, block.length);
    ring.set(block, n - block.length);
  }
  filled = Math.min(n, filled + block.length);
  if (filled < n) return;
  const p = detectPitch(ring, rate);
  let level = 0;
  for (let i = n - block.length; i < n; i++)
    level = Math.max(level, Math.abs(ring[i]!));
  (self as unknown as Worker).postMessage({ pitch: p, level });
}

self.onmessage = (
  e: MessageEvent<
    { sampleRate: number; port?: MessagePort } | { block: Float32Array }
  >,
) => {
  const d = e.data;
  if ("block" in d) return onBlock(d.block);
  rate = d.sampleRate;
  ring = new Float32Array(windowSize(rate));
  filled = 0;
  input?.close();
  input = d.port ?? null;
  if (input)
    input.onmessage = (m: MessageEvent<Float32Array>) => onBlock(m.data);
};
