/**
 * One AudioContext for the whole page, created on the first user gesture (browsers keep audio
 * locked until then) and resumed whenever it's needed. Everything plays through a master gain
 * and a limiter (a fast compressor), so chords and stacked tones can't clip.
 *
 *   tool sounds ─▶ master gain ─▶ limiter ─▶ speakers
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 2;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(limiter).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Where tools connect their sounds */
export function out(): AudioNode {
  audio();
  return master!;
}

/** True once the page has made sound (the context exists) */
export const started = () => ctx !== null;

/** Volume 0 … 1 from a slider, on a gentle curve (the ear hears loudness logarithmically) */
export const curve = (v: number) => (v <= 0 ? 0 : v * v);

/** Ramp a parameter without clicks */
export function glide(p: AudioParam, value: number, time = 0.03) {
  const c = audio();
  p.cancelScheduledValues(c.currentTime);
  p.setTargetAtTime(value, c.currentTime, time / 3);
}

/** Respect the reader's reduced-motion setting in animations */
export function reducedMotion(): boolean {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * A small per-page hook for the tests: tools register what they schedule or measure here. Only
 * when the end-to-end tests ask for it (they set `window.kmraTest` before the page loads), so
 * visitors never get the debug object.
 */
export function testHook(name: string, value: unknown) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    kmraTest?: boolean;
    kmraMusic?: Record<string, unknown>;
  };
  if (w.kmraTest !== true) return;
  (w.kmraMusic ??= {})[name] = value;
}
