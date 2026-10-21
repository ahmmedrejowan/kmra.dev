/**
 * Synthesised sounds (nothing is fetched): plucked strings (Karplus–Strong), a soft keyboard tone,
 * and metronome clicks. Buffers are computed once per pitch and cached.
 */
import { audio, out } from "./audio";

const cache = new Map<string, AudioBuffer>();

/**
 * A plucked string by Karplus–Strong: a burst of filtered noise circulating in a delay line one
 * period long, averaged each pass so the high partials die first, like a real string. The delay
 * is fractional (linear interpolation) so the pitch is exact, not rounded to a whole sample.
 */
export function pluckBuffer(freq: number, seconds = 2.6): AudioBuffer {
  const c = audio();
  const key = `pluck:${freq.toFixed(3)}:${seconds}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sr = c.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = c.createBuffer(1, n, sr);
  const y = buf.getChannelData(0);
  // The averaging adds half a sample of delay
  const delay = sr / freq - 0.5;
  const burst = Math.ceil(delay) + 2;
  // Low strings ring longer; damping per pass
  const decay = Math.min(
    0.9985,
    0.9965 + (0.002 * 110) / Math.max(110, freq) - 0.0006,
  );
  let seed = 7 + Math.round(freq * 13);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    let x = 0;
    if (i < burst) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      // Soft pick: low-passed noise
      const w = seed / 4294967296 - 0.5;
      prev = prev + 0.5 * (w - prev);
      x = prev;
    }
    const p = i - delay;
    let fb = 0;
    if (p >= 1) {
      const j = Math.floor(p);
      const f = p - j;
      const a = y[j]! * (1 - f) + y[j + 1]! * f;
      const b = y[j - 1]! * (1 - f) + y[j]! * f;
      fb = decay * 0.5 * (a + b);
    }
    y[i] = x + fb;
  }
  normalise(y, 0.55);
  fadeTail(y, sr);
  cache.set(key, buf);
  return buf;
}

/** A soft keyboard-like tone: a few harmonics with a quick attack and a long decay */
export function keyBuffer(freq: number, seconds = 1.6): AudioBuffer {
  const c = audio();
  const key = `key:${freq.toFixed(3)}:${seconds}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sr = c.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = c.createBuffer(1, n, sr);
  const y = buf.getChannelData(0);
  const parts = [
    [1, 1, 1.6],
    [2, 0.35, 2.6],
    [3, 0.12, 3.6],
    [4, 0.06, 4.5],
  ] as const;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const attack = Math.min(1, t / 0.006);
    let v = 0;
    for (const [h, a, d] of parts) {
      if (freq * h > sr / 2.2) continue;
      v += a * Math.exp(-t * d) * Math.sin(2 * Math.PI * freq * h * t);
    }
    y[i] = attack * v;
  }
  normalise(y, 0.4);
  fadeTail(y, sr);
  cache.set(key, buf);
  return buf;
}

function normalise(y: Float32Array, peak: number) {
  let m = 0;
  for (let i = 0; i < y.length; i++) m = Math.max(m, Math.abs(y[i]!));
  if (m > 0) for (let i = 0; i < y.length; i++) y[i] = (y[i]! / m) * peak;
}

function fadeTail(y: Float32Array, sr: number) {
  const k = Math.min(y.length, Math.floor(sr * 0.05));
  for (let i = 0; i < k; i++)
    y[y.length - 1 - i] = y[y.length - 1 - i]! * (i / k);
}

/** Play a buffer at a time; returns the source so it can be stopped early */
export function playBuffer(
  buf: AudioBuffer,
  when = 0,
  gain = 1,
  dest?: AudioNode,
) {
  const c = audio();
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(dest ?? out());
  src.start(Math.max(when, c.currentTime));
  return {
    src,
    stop(at = c.currentTime) {
      g.gain.setTargetAtTime(0, at, 0.02);
      src.stop(at + 0.15);
    },
  };
}

/** Pluck one string */
export const pluck = (freq: number, when = 0, gain = 1, seconds?: number) =>
  playBuffer(pluckBuffer(freq, seconds), when, gain);

/** Strum several pitches, low to high (or high to low with `up`) */
export function strum(freqs: number[], when = 0, spread = 0.035, up = false) {
  const c = audio();
  const t = Math.max(when, c.currentTime + 0.02);
  const order = up ? [...freqs].reverse() : freqs;
  return order.map((f, i) => pluck(f, t + i * spread, 0.8));
}

/** One keyboard note */
export const key = (freq: number, when = 0, gain = 1, seconds?: number) =>
  playBuffer(keyBuffer(freq, seconds), when, gain);

/* ---------- metronome sounds ---------- */

export type ClickSound = "click" | "wood" | "beep";
/** 3 accent, 2 beat, 1 subdivision */
export type ClickLevel = 1 | 2 | 3;

/** The click for a sound and level, made once per AudioContext */
export function clickBuffer(sound: ClickSound, level: ClickLevel): AudioBuffer {
  const c = audio();
  const key = `click:${sound}:${level}:${c.sampleRate}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sr = c.sampleRate;
  const len = sound === "beep" ? 0.07 : 0.05;
  const n = Math.floor(sr * len);
  const buf = c.createBuffer(1, n, sr);
  const y = buf.getChannelData(0);
  let seed = 99 + level;
  const noise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };
  const pitch =
    sound === "beep"
      ? [0, 660, 880, 1320][level]!
      : sound === "wood"
        ? [0, 700, 950, 1250][level]!
        : [0, 1500, 2000, 2800][level]!;
  const vol = [0, 0.45, 0.75, 1][level]!;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v: number;
    if (sound === "beep") {
      const env =
        Math.min(1, t / 0.002) * (t < len - 0.012 ? 1 : (len - t) / 0.012);
      v = env * Math.sin(2 * Math.PI * pitch * t) * 0.7;
    } else if (sound === "wood") {
      lp += 0.35 * (noise() - lp);
      const env = Math.exp(-t * 90);
      v = env * (0.75 * Math.sin(2 * Math.PI * pitch * t) + 0.9 * lp);
    } else {
      const env = Math.exp(-t * 260);
      v = env * (0.6 * Math.sin(2 * Math.PI * pitch * t) + 0.8 * noise());
    }
    y[i] = v * vol;
  }
  fadeTail(y, sr);
  cache.set(key, buf);
  return buf;
}
