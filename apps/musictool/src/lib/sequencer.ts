/**
 * The beat maker's player: the metronome's "two clocks" (a worker timer wakes every 25 ms and
 * schedules each step due in the next 120 ms on the AudioContext clock), playing the pattern as it
 * is at that moment, so edits are heard within a step or two.
 *
 *   hit ─▶ velocity gain ─▶ drum channel (volume, mute/solo) ─▶ pan ─▶ beat bus ─▶ master
 */
import { audio, out, testHook } from "./audio";
import {
  DRUMS,
  PAN,
  VEL_GAIN,
  channelGain,
  stepLength,
  swingDelay,
  synth,
  type DrumId,
  type Pattern,
} from "./drums";

export interface Step {
  time: number;
  /** Step within the pattern */
  step: number;
  /** Drums that sounded, with their velocity */
  drums: [DrumId, number][];
}

const LOOKAHEAD = 0.12;
const INTERVAL = 25;

const buffers = new Map<string, AudioBuffer>();
function buffer(d: DrumId): AudioBuffer {
  const c = audio();
  const key = `${d}:${c.sampleRate}`;
  let b = buffers.get(key);
  if (!b) {
    const data = synth(d, c.sampleRate);
    b = c.createBuffer(1, data.length, c.sampleRate);
    b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    buffers.set(key, b);
  }
  return b;
}

export class Sequencer {
  pattern: Pattern;
  private timer: Worker | null = null;
  private fallback = 0;
  private bus: GainNode | null = null;
  private channels = new Map<DrumId, GainNode>();
  private sources = new Set<AudioBufferSourceNode>();
  /** The open hat still ringing, so a closed hat can cut it */
  private openHat: { gain: GainNode; src: AudioBufferSourceNode } | null = null;
  private next = 0;
  /** Time of the next step without swing */
  private grid = 0;
  private playing = false;
  /** Steps scheduled but not yet shown */
  queue: Step[] = [];
  /** The last 400 scheduled steps (for the tests) */
  log: Step[] = [];

  constructor(pattern: Pattern) {
    this.pattern = pattern;
    testHook("beats", this);
  }

  get running() {
    return this.playing;
  }

  private wire() {
    if (this.bus) return;
    const c = audio();
    this.bus = c.createGain();
    this.bus.connect(out());
    for (const d of DRUMS) {
      const g = c.createGain();
      g.gain.value = channelGain(this.pattern, d);
      const pan = c.createStereoPanner();
      pan.pan.value = PAN[d];
      g.connect(pan).connect(this.bus);
      this.channels.set(d, g);
    }
  }

  /** Change the pattern; a playing loop picks it up from the next step */
  set(p: Pattern) {
    this.pattern = p;
    if (this.next >= p.steps) this.next = 0;
    if (!this.bus) return;
    const c = audio();
    for (const d of DRUMS)
      this.channels
        .get(d)!
        .gain.setTargetAtTime(channelGain(p, d), c.currentTime, 0.01);
  }

  private play(d: DrumId, vel: number, at: number) {
    const c = audio();
    const src = c.createBufferSource();
    src.buffer = buffer(d);
    const g = c.createGain();
    g.gain.value = VEL_GAIN[vel as 1 | 2] ?? 1;
    src.connect(g).connect(this.channels.get(d)!);
    src.start(at);
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      g.disconnect();
    };
    if (d === "hat" && this.openHat) {
      // The closed hat chokes the open one, as on a drum machine
      this.openHat.gain.gain.setTargetAtTime(0, at, 0.004);
      this.openHat = null;
    }
    if (d === "open") this.openHat = { gain: g, src };
  }

  /** Hear one drum now (clicking its name) */
  preview(d: DrumId) {
    this.wire();
    this.play(d, 2, audio().currentTime);
  }

  start() {
    if (this.playing) return;
    this.wire();
    const c = audio();
    this.playing = true;
    this.next = 0;
    this.grid = c.currentTime + 0.06;
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
    this.playing = false;
    const c = audio();
    for (const s of this.sources) {
      try {
        s.stop(c.currentTime + 0.01);
      } catch {
        // already ended
      }
    }
    this.sources.clear();
    this.openHat = null;
    this.queue = [];
  }

  /** Stop and disconnect for good (the page is leaving) */
  dispose() {
    this.stop();
    this.bus?.disconnect();
    this.bus = null;
    this.channels.clear();
  }

  private pump() {
    if (!this.playing) return;
    const c = audio();
    // After a long stall (tab asleep), skip ahead instead of firing a burst of late steps
    if (this.grid < c.currentTime - 0.2) this.grid = c.currentTime + 0.05;
    while (this.grid < c.currentTime + LOOKAHEAD) {
      const p = this.pattern;
      if (this.next >= p.steps) this.next = 0;
      const i = this.next;
      const time = this.grid + (i % 2 === 1 ? swingDelay(p.bpm, p.swing) : 0);
      const drums: [DrumId, number][] = [];
      for (const d of DRUMS) {
        const v = p.grid[d][i];
        if (!v) continue;
        drums.push([d, v]);
        this.play(d, v, time);
      }
      const s = { time, step: i, drums };
      this.queue.push(s);
      this.log.push(s);
      if (this.log.length > 400) this.log.shift();
      this.grid += stepLength(p.bpm);
      this.next = (i + 1) % p.steps;
    }
  }

  /** The latest step that has sounded by now (and drops older ones from the queue) */
  heard(): Step | null {
    if (!this.playing) return null;
    const now = audio().currentTime;
    let last: Step | null = null;
    while (this.queue.length && this.queue[0]!.time <= now)
      last = this.queue.shift()!;
    return last;
  }
}
