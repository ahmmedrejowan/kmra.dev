/**
 * Speed changes for the fast engine (used by ./wc.worker.ts as Mediabunny `process` steps):
 * video frames get new timestamps on a steady frame-rate grid (frames dropped when faster,
 * repeated when slower), and the sound is time-stretched (pitch kept) or resampled like a tape.
 */
import { AudioSample, VideoSample } from "mediabunny";
import { tape, tempo, type Stretcher } from "./stretch";

/**
 * Video: each frame covers [t, t + duration) / speed in the output; every slot of the output
 * frame rate that starts inside that span gets the frame. `draw` (optional) turns the frame into
 * a canvas first (padding, effects).
 */
export function retime(
  speed: number,
  fps: number,
  draw?: (s: VideoSample) => OffscreenCanvas,
) {
  const step = 1 / fps;
  let next: number | null = null;
  return (sample: VideoSample): VideoSample[] | null => {
    const t0 = sample.timestamp / speed;
    const t1 = (sample.timestamp + (sample.duration || step * speed)) / speed;
    next ??= Math.max(0, Math.round(t0 / step));
    const src = draw ? draw(sample) : null;
    const out: VideoSample[] = [];
    while (next * step < t1 - 1e-6) {
      const t = next * step;
      const s = src
        ? new VideoSample(src, { timestamp: t, duration: step })
        : sample.clone();
      s.setTimestamp(t);
      s.setDuration(step);
      out.push(s);
      next++;
    }
    return out.length ? out : null;
  };
}

/** Audio: the same speed, keeping the pitch (time-stretch) or not (tape) */
export function respeed(speed: number, keepPitch: boolean) {
  let st: Stretcher | null = null;
  let t0 = 0;
  let made = 0;
  return (sample: AudioSample): AudioSample | null => {
    const ch = sample.numberOfChannels;
    const sr = sample.sampleRate;
    const n = sample.numberOfFrames;
    if (!st) {
      st = keepPitch ? tempo(speed, sr, ch) : tape(speed, ch);
      t0 = sample.timestamp / speed;
    }
    const planes = Array.from({ length: ch }, (_, c) => {
      const a = new Float32Array(n);
      sample.copyTo(a, { planeIndex: c, format: "f32-planar" });
      return a;
    });
    const out = st.push(planes);
    const m = out[0]?.length ?? 0;
    if (!m) return null;
    const data = new Float32Array(m * ch);
    out.forEach((p, c) => data.set(p, c * m));
    const res = new AudioSample({
      data,
      format: "f32-planar",
      numberOfChannels: ch,
      sampleRate: sr,
      timestamp: t0 + made / sr,
    });
    made += m;
    return res;
  };
}
