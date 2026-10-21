/**
 * Metronome engine, "A tale of two clocks": a coarse timer (in a worker, so background tabs don't
 * slow it) wakes up every 25 ms and schedules every click due in the next 120 ms on the
 * AudioContext's own clock, which is sample-accurate. The visuals follow the same scheduled
 * times, so what you see matches what you hear.
 *
 * `Planner` is the pure part (what plays when) and is what the tests check.
 */
import { audio, out, testHook } from "./audio";
import { clickBuffer, type ClickSound } from "./sound";

/** Per-beat accent: 2 accent, 1 normal, 0 mute */
export type Accent = 0 | 1 | 2;

export interface MetroSettings {
  bpm: number;
  beats: number;
  /** Note value of a beat: 2, 4, 8 or 16 */
  unit: number;
  accents: Accent[];
  /** Clicks per beat: 1, 2 (eighths), 3 (triplets), 4 (sixteenths) */
  sub: number;
  sound: ClickSound;
  /** 0 … 1 */
  volume: number;
  trainer: { on: boolean; step: number; every: number; max: number };
}

export interface Tick {
  time: number;
  bar: number;
  beat: number;
  sub: number;
  /** 3 accent, 2 beat, 1 subdivision, 0 silent */
  level: 0 | 1 | 2 | 3;
  bpm: number;
}

export const MIN_BPM = 20;
export const MAX_BPM = 300;
export const clampBpm = (v: number) =>
  Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v)));

/**
 * Default accents for a meter: the downbeat, plus the start of each group in compound and odd
 * meters (6/8 → 1 and 4; 7/8 → 2+2+3; 5/4 → 3+2).
 */
export function defaultAccents(beats: number, unit: number): Accent[] {
  const a: Accent[] = Array.from({ length: beats }, () => 1);
  a[0] = 2;
  if (unit === 8 && beats % 3 === 0 && beats > 3)
    for (let i = 3; i < beats; i += 3) a[i] = 2;
  else if (beats === 5) a[3] = 2;
  else if (beats === 7) {
    a[2] = 2;
    a[4] = 2;
  }
  return a;
}

/** Seconds between clicks (beat ÷ subdivision) */
export const tickLength = (bpm: number, sub: number) => 60 / bpm / sub;

/** Pure scheduler state: which click comes next, and when. */
export class Planner {
  s: MetroSettings;
  time: number;
  bar = 0;
  beat = 0;
  sub = 0;
  /** BPM changes made by the speed trainer */
  onBpm?: (bpm: number) => void;

  constructor(settings: MetroSettings, start: number) {
    this.s = settings;
    this.time = start;
  }

  current(): Tick {
    const { accents, beats } = this.s;
    const beat = this.beat % beats;
    const acc = accents[beat] ?? 1;
    const level: Tick["level"] =
      acc === 0 ? 0 : this.sub > 0 ? 1 : acc === 2 ? 3 : 2;
    return {
      time: this.time,
      bar: this.bar,
      beat,
      sub: this.sub,
      level,
      bpm: this.s.bpm,
    };
  }

  /** Step to the next click */
  advance() {
    this.time += tickLength(this.s.bpm, this.s.sub);
    this.sub++;
    if (this.sub >= this.s.sub) {
      this.sub = 0;
      this.beat++;
      if (this.beat >= this.s.beats) {
        this.beat = 0;
        this.bar++;
        const t = this.s.trainer;
        if (
          t.on &&
          t.every > 0 &&
          this.bar % t.every === 0 &&
          this.s.bpm < t.max
        ) {
          const bpm = clampBpm(Math.min(t.max, this.s.bpm + t.step));
          this.s = { ...this.s, bpm };
          this.onBpm?.(bpm);
        }
      }
    }
  }

  /** Every click from now until `until` (seconds) */
  until(until: number): Tick[] {
    const out: Tick[] = [];
    while (this.time < until) {
      out.push(this.current());
      this.advance();
    }
    return out;
  }
}

const LOOKAHEAD = 0.12;
const INTERVAL = 25;

/** The running metronome: schedules clicks and reports them for the visuals. */
export class Metronome {
  private planner: Planner | null = null;
  private timer: Worker | null = null;
  private fallback = 0;
  private gain: GainNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  /** Clicks scheduled but not yet shown */
  queue: Tick[] = [];
  /** The last 400 scheduled clicks (for the tests) */
  log: Tick[] = [];
  settings: MetroSettings;
  onBpm?: (bpm: number) => void;

  constructor(settings: MetroSettings) {
    this.settings = settings;
    testHook("metronome", this);
  }

  get running() {
    return this.planner !== null;
  }

  /** Change settings; a running metronome picks them up from the next click */
  set(settings: MetroSettings) {
    this.settings = settings;
    if (this.planner) {
      const beatChanged = this.planner.s.beats !== settings.beats;
      this.planner.s = settings;
      if (beatChanged && this.planner.beat >= settings.beats)
        this.planner.beat = 0;
      if (this.planner.sub >= settings.sub) this.planner.sub = 0;
    }
    if (this.gain) this.gain.gain.value = settings.volume * settings.volume;
  }

  start() {
    if (this.planner) return;
    const c = audio();
    this.gain = c.createGain();
    this.gain.gain.value = this.settings.volume * this.settings.volume;
    this.gain.connect(out());
    this.planner = new Planner(this.settings, c.currentTime + 0.06);
    this.planner.onBpm = (bpm) => {
      this.settings = { ...this.settings, bpm };
      this.onBpm?.(bpm);
    };
    this.queue = [];
    this.log = [];
    this.pump();
    try {
      this.timer = new Worker(new URL("./clock.worker.ts", import.meta.url), {
        type: "module",
      });
      this.timer.onmessage = () => this.pump();
      this.timer.postMessage(INTERVAL);
    } catch {
      this.fallback = window.setInterval(() => this.pump(), INTERVAL);
    }
  }

  stop() {
    this.timer?.terminate();
    this.timer = null;
    clearInterval(this.fallback);
    this.planner = null;
    const c = audio();
    for (const s of this.sources) {
      try {
        s.stop(c.currentTime);
      } catch {
        // already ended
      }
    }
    this.sources.clear();
    this.gain?.disconnect();
    this.gain = null;
    this.queue = [];
  }

  private pump() {
    const p = this.planner;
    if (!p || !this.gain) return;
    const c = audio();
    // After a long stall (tab asleep), skip ahead instead of firing a burst of late clicks
    if (p.time < c.currentTime - 0.2) p.time = c.currentTime + 0.05;
    for (const t of p.until(c.currentTime + LOOKAHEAD)) {
      this.queue.push(t);
      this.log.push(t);
      if (this.log.length > 400) this.log.shift();
      if (t.level === 0) continue;
      const src = c.createBufferSource();
      src.buffer = clickBuffer(this.settings.sound, t.level);
      src.connect(this.gain);
      src.start(t.time);
      this.sources.add(src);
      src.onended = () => this.sources.delete(src);
    }
  }

  /** The latest click that has sounded by now (and drops older ones from the queue) */
  heard(): Tick | null {
    if (!this.planner) return null;
    const now = audio().currentTime;
    let last: Tick | null = null;
    while (this.queue.length && this.queue[0]!.time <= now)
      last = this.queue.shift()!;
    return last;
  }
}

/* ---------- tap tempo ---------- */

/**
 * BPM from tap times (ms): the median of the recent intervals, so one late tap doesn't throw it.
 * Returns null until there are two taps.
 */
export function tapTempo(times: number[], recent = 8) {
  if (times.length < 2) return null;
  const iv: number[] = [];
  for (let i = Math.max(1, times.length - recent); i < times.length; i++)
    iv.push(times[i]! - times[i - 1]!);
  const s = [...iv].sort((a, b) => a - b);
  const mid = s.length >> 1;
  const med = s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
  const mean = iv.reduce((a, b) => a + b, 0) / iv.length;
  const sd = Math.sqrt(iv.reduce((a, b) => a + (b - mean) ** 2, 0) / iv.length);
  return {
    bpm: 60000 / med,
    /** Spread of the intervals relative to their mean (0 = perfectly even) */
    spread: mean > 0 ? sd / mean : 0,
    intervals: iv.length,
  };
}

/** A pause this long (or 2.5 beats, if longer) starts a new count */
export const TAP_RESET_MS = 2000;
export const tapResets = (gap: number, lastBpm: number | null) =>
  gap > Math.max(TAP_RESET_MS, lastBpm ? (2.5 * 60000) / lastBpm : 0);
