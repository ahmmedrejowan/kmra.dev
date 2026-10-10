/**
 * The beat maker's engine, with no browser APIs, so the page, the export worker and the tests all
 * use the same code:
 *
 * - `synth(id, sampleRate)`: the eight drum sounds, made from sine waves and noise (no samples, so
 *   nothing to fetch and no licences), in the style of the classic analogue drum machines.
 * - `Pattern`: tempo, swing, length and one row of steps per drum (0 off, 1 on, 2 accent), with
 *   per-drum volume, mute and solo.
 * - `stepTime`: when a step plays, swing included.
 * - `mixdown`: the pattern rendered to stereo samples for download, wrapped so it loops seamlessly.
 * - `STARTERS`: the starter patterns; `toHash`/`fromHash`: a pattern in a link.
 */

export const DRUMS = ["kick", "snare", "clap", "hat", "open", "tomLow", "tomHigh", "rim"] as const;
export type DrumId = (typeof DRUMS)[number];

export const DRUM_NAMES: Record<DrumId, string> = {
  kick: "Kick",
  snare: "Snare",
  clap: "Clap",
  hat: "Closed hat",
  open: "Open hat",
  tomLow: "Low tom",
  tomHigh: "High tom",
  rim: "Rim",
};

/** Stereo position, -1 left … 1 right: hats and toms spread a little, the kick in the middle */
export const PAN: Record<DrumId, number> = {
  kick: 0,
  snare: 0,
  clap: 0.05,
  hat: 0.25,
  open: 0.3,
  tomLow: -0.3,
  tomHigh: 0.2,
  rim: -0.15,
};

/** 0 off, 1 on, 2 accent */
export type Vel = 0 | 1 | 2;
export const VEL_GAIN = [0, 0.62, 1] as const;

/** Bar lengths: 3/4 (12 sixteenths), 4/4 (16), two bars of 4/4 (32) */
export const LENGTHS = [12, 16, 32] as const;
export const STEPS_PER_BEAT = 4;

export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const clampBpm = (v: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v)));

export interface Pattern {
  bpm: number;
  /** 0 straight … 100 full shuffle (the off-beat sixteenth on the triplet) */
  swing: number;
  steps: number;
  grid: Record<DrumId, Vel[]>;
  /** 0 … 1 per drum */
  vol: Record<DrumId, number>;
  mute: Record<DrumId, boolean>;
  solo: Record<DrumId, boolean>;
}

const each = <V>(f: (d: DrumId) => V) =>
  Object.fromEntries(DRUMS.map((d) => [d, f(d)])) as Record<DrumId, V>;

export const DEFAULT_VOL = 0.8;

export function emptyPattern(steps = 16, bpm = 100, swing = 0): Pattern {
  return {
    bpm,
    swing,
    steps,
    grid: each(() => Array.from({ length: steps }, () => 0 as Vel)),
    vol: each(() => DEFAULT_VOL),
    mute: each(() => false),
    solo: each(() => false),
  };
}

/** Change the length: a longer pattern repeats what's there, a shorter one keeps the start */
export function resize(p: Pattern, steps: number): Pattern {
  return {
    ...p,
    steps,
    grid: each((d) => Array.from({ length: steps }, (_, i) => p.grid[d][i % p.steps] ?? 0)),
  };
}

/** Whether a drum is heard: solo wins over mute */
export function audible(p: Pattern, d: DrumId): boolean {
  const anySolo = DRUMS.some((x) => p.solo[x]);
  return anySolo ? p.solo[d] : !p.mute[d];
}

/** Gain of a drum's channel: its volume on a gentle curve, 0 when it isn't heard */
export const channelGain = (p: Pattern, d: DrumId) => (audible(p, d) ? p.vol[d] * p.vol[d] : 0);

export const stepLength = (bpm: number) => 60 / bpm / STEPS_PER_BEAT;

/** How late the off-beat sixteenths play: up to a third of a step (the triplet) */
export const swingDelay = (bpm: number, swing: number) => ((swing / 100) * stepLength(bpm)) / 3;

/** Seconds from the start of the loop to step `i` */
export const stepTime = (i: number, bpm: number, swing: number) =>
  i * stepLength(bpm) + (i % 2 === 1 ? swingDelay(bpm, swing) : 0);

export const loopLength = (p: Pattern) => p.steps * stepLength(p.bpm);

export const hits = (p: Pattern) => DRUMS.reduce((n, d) => n + p.grid[d].filter(Boolean).length, 0);

/* ---------- sounds ---------- */

function noise(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
}

/** One-pole high-pass, in place */
function highpass(y: Float32Array, sr: number, fc: number) {
  const rc = 1 / (2 * Math.PI * fc);
  const a = rc / (rc + 1 / sr);
  let px = 0;
  let py = 0;
  for (let i = 0; i < y.length; i++) {
    const x = y[i]!;
    py = a * (py + x - px);
    px = x;
    y[i] = py;
  }
}

/** One-pole low-pass, in place */
function lowpass(y: Float32Array, sr: number, fc: number) {
  const k = 1 - Math.exp((-2 * Math.PI * fc) / sr);
  let v = 0;
  for (let i = 0; i < y.length; i++) {
    v += k * (y[i]! - v);
    y[i] = v;
  }
}

function finish(y: Float32Array, sr: number, peak: number) {
  let m = 0;
  for (let i = 0; i < y.length; i++) m = Math.max(m, Math.abs(y[i]!));
  if (m > 0) for (let i = 0; i < y.length; i++) y[i] = (y[i]! / m) * peak;
  // A short fade at the end so nothing clicks
  const k = Math.min(y.length, Math.floor(sr * 0.006));
  for (let i = 0; i < k; i++) y[y.length - 1 - i] = y[y.length - 1 - i]! * (i / k);
  return y;
}

/** The 808 hi-hat's six detuned square waves: the metallic part of a hat */
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

function hat(sr: number, seconds: number, decay: number, seed: number, peak: number) {
  const n = Math.floor(sr * seconds);
  const y = new Float32Array(n);
  const r = noise(seed);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let m = 0;
    for (const f of METAL) m += Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1;
    y[i] = (m / METAL.length) * 0.6 + r() * 0.5;
  }
  highpass(y, sr, 7000);
  highpass(y, sr, 7000);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    y[i] = y[i]! * Math.min(1, t / 0.0005) * Math.exp(-t / decay);
  }
  return finish(y, sr, peak);
}

function tom(sr: number, f0: number, decay: number, seed: number) {
  const n = Math.floor(sr * 0.5);
  const y = new Float32Array(n);
  const r = noise(seed);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (2 * Math.PI * f0 * (1 + 0.45 * Math.exp(-t / 0.03))) / sr;
    y[i] = Math.sin(ph) * Math.exp(-t / decay) + r() * 0.15 * Math.exp(-t / 0.01);
  }
  return finish(y, sr, 0.8);
}

/** A drum sound as mono samples; the same input always gives the same sound */
export function synth(id: DrumId, sr: number): Float32Array {
  switch (id) {
    case "kick": {
      const n = Math.floor(sr * 0.6);
      const y = new Float32Array(n);
      const r = noise(1);
      let ph = 0;
      let click = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        // The pitch drops fast from about 160 Hz to 48 Hz: the thump, then the boom
        ph += (2 * Math.PI * (48 + 110 * Math.exp(-t / 0.045))) / sr;
        click += 0.3 * (r() - click);
        const v = Math.sin(ph) * Math.min(1, t / 0.001) * Math.exp(-t / 0.28);
        y[i] = Math.tanh(1.4 * (v + click * Math.exp(-t / 0.003) * 0.6));
      }
      return finish(y, sr, 0.95);
    }
    case "snare": {
      const n = Math.floor(sr * 0.35);
      const body = new Float32Array(n);
      const wires = new Float32Array(n);
      const r = noise(2);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        body[i] =
          (Math.sin(2 * Math.PI * 185 * t) * 0.6 + Math.sin(2 * Math.PI * 330 * t) * 0.35) *
          Math.exp(-t / 0.06);
        wires[i] = r();
      }
      highpass(wires, sr, 1500);
      for (let i = 0; i < n; i++) body[i] = body[i]! * 0.55 + wires[i]! * Math.exp(-i / sr / 0.11) * 0.8;
      return finish(body, sr, 0.85);
    }
    case "clap": {
      const n = Math.floor(sr * 0.4);
      const y = new Float32Array(n);
      const r = noise(3);
      for (let i = 0; i < n; i++) y[i] = r();
      highpass(y, sr, 900);
      lowpass(y, sr, 2600);
      lowpass(y, sr, 2600);
      // Three quick slaps, then the room
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let e = 0;
        for (const t0 of [0, 0.011, 0.022]) if (t >= t0) e = Math.max(e, Math.exp(-(t - t0) / 0.004));
        if (t >= 0.031) e = Math.max(e, 0.8 * Math.exp(-(t - 0.031) / 0.09));
        y[i] = y[i]! * e;
      }
      return finish(y, sr, 0.8);
    }
    case "hat":
      return hat(sr, 0.12, 0.022, 4, 0.5);
    case "open":
      return hat(sr, 0.55, 0.16, 5, 0.45);
    case "tomLow":
      return tom(sr, 95, 0.22, 6);
    case "tomHigh":
      return tom(sr, 165, 0.18, 7);
    case "rim": {
      const n = Math.floor(sr * 0.06);
      const y = new Float32Array(n);
      const r = noise(8);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        y[i] =
          (Math.sin(2 * Math.PI * 1720 * t) * 0.6 + Math.sin(2 * Math.PI * 480 * t) * 0.5) *
            Math.exp(-t / 0.009) +
          r() * 0.3 * Math.exp(-t / 0.003);
      }
      return finish(y, sr, 0.7);
    }
  }
}

/* ---------- mixdown ---------- */

/** Equal-power pan gains [left, right] */
export function panGains(pan: number): [number, number] {
  const a = ((pan + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

/**
 * The pattern rendered `loops` times as stereo samples. Sounds that ring past the end wrap
 * around to the start, so the file loops without a gap or a click. A closed hat cuts an open
 * hat short, as on a drum machine. The result is scaled down if it would clip.
 */
export function mixdown(
  p: Pattern,
  sr: number,
  loops: number,
  sounds: Record<DrumId, Float32Array>,
): [Float32Array, Float32Array] {
  const loop = loopLength(p);
  const total = Math.round(loop * loops * sr);
  const L = new Float32Array(total);
  const R = new Float32Array(total);
  // Every hat hit in order, for the choke
  const hatTimes: number[] = [];
  for (let k = 0; k < loops; k++)
    for (let i = 0; i < p.steps; i++)
      if (p.grid.hat[i] && audible(p, "hat")) hatTimes.push(k * loop + stepTime(i, p.bpm, p.swing));
  for (const d of DRUMS) {
    const g = channelGain(p, d);
    if (g === 0) continue;
    const [gl, gr] = panGains(PAN[d]);
    const s = sounds[d];
    for (let k = 0; k < loops; k++)
      for (let i = 0; i < p.steps; i++) {
        const v = p.grid[d][i];
        if (!v) continue;
        const t = k * loop + stepTime(i, p.bpm, p.swing);
        let len = s.length;
        if (d === "open") {
          const next = hatTimes.find((h) => h > t) ?? (hatTimes.length ? hatTimes[0]! + loop * loops : Infinity);
          len = Math.min(len, Math.round((next - t) * sr));
        }
        const fade = Math.min(len, Math.floor(sr * 0.005));
        const start = Math.round(t * sr);
        const a = g * VEL_GAIN[v];
        for (let j = 0; j < len; j++) {
          const x = s[j]! * a * (j >= len - fade && len < s.length ? (len - j) / fade : 1);
          const at = (start + j) % total;
          L[at] = L[at]! + x * gl;
          R[at] = R[at]! + x * gr;
        }
      }
  }
  let peak = 0;
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(L[i]!), Math.abs(R[i]!));
  if (peak > 0.95) {
    const k = 0.95 / peak;
    for (let i = 0; i < total; i++) {
      L[i] = L[i]! * k;
      R[i] = R[i]! * k;
    }
  }
  return [L, R];
}

/** 16-bit stereo WAV */
export function wav([L, R]: [Float32Array, Float32Array], sr: number): ArrayBuffer {
  const n = L.length;
  const buf = new ArrayBuffer(44 + n * 4);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 4, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 4, true);
  const q = (x: number) => Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 4, q(L[i]!), true);
    v.setInt16(46 + i * 4, q(R[i]!), true);
  }
  return buf;
}

/* ---------- starter patterns ---------- */

export interface Starter {
  id: string;
  name: string;
  bpm: number;
  swing: number;
  steps: number;
  /** One string per drum: x accent, o on, . off */
  rows: Partial<Record<DrumId, string>>;
}

export const STARTERS: Starter[] = [
  {
    id: "boom-bap",
    name: "Hip-hop",
    bpm: 90,
    swing: 40,
    steps: 16,
    rows: {
      kick: "x......o..x.....",
      snare: "....x.......x...",
      hat: "o.o.o.o.o.o.o.oo",
    },
  },
  {
    id: "rock",
    name: "Rock",
    bpm: 110,
    swing: 0,
    steps: 16,
    rows: {
      kick: "x.......x.x.....",
      snare: "....x.......x...",
      hat: "x.o.x.o.x.o.x.o.",
    },
  },
  {
    id: "house",
    name: "House",
    bpm: 124,
    swing: 0,
    steps: 16,
    rows: {
      kick: "x...x...x...x...",
      clap: "....x.......x...",
      hat: "oo.ooo.ooo.ooo.o",
      open: "..x...x...x...x.",
    },
  },
  {
    id: "trap",
    name: "Trap",
    bpm: 140,
    swing: 0,
    steps: 16,
    rows: {
      kick: "x......x.x......",
      clap: "........x.......",
      hat: "xoooxoooxoooxooo",
      open: "..............o.",
    },
  },
  {
    id: "reggaeton",
    name: "Reggaeton",
    bpm: 95,
    swing: 0,
    steps: 16,
    rows: {
      kick: "x...x...x...x...",
      snare: "...x..x....x..x.",
      hat: "o.o.o.o.o.o.o.o.",
    },
  },
  {
    id: "lofi",
    name: "Lo-fi",
    bpm: 80,
    swing: 55,
    steps: 16,
    rows: {
      kick: "x......o.ox.....",
      snare: "....x.......x...",
      hat: "o.oo.o.oo.oo.o.o",
      rim: ".......o........",
    },
  },
  {
    id: "funk",
    name: "Funk",
    bpm: 100,
    swing: 20,
    steps: 16,
    rows: {
      kick: "x.x.......x..o..",
      snare: "....x..o.o..x..o",
      hat: "xoooxoooxoooxooo",
    },
  },
  {
    id: "waltz",
    name: "Waltz (3/4)",
    bpm: 90,
    swing: 0,
    steps: 12,
    rows: {
      kick: "x...........",
      snare: "....o...o...",
      hat: "o.o.o.o.o.o.",
    },
  },
  {
    id: "drum-and-bass",
    name: "Drum and bass",
    bpm: 172,
    swing: 0,
    steps: 32,
    rows: {
      kick: "x.........x.....x.........o.....",
      snare: "....x.......x.......x.......x..o",
      hat: "o.o.o.o.o.o.o.o.o.o.o.o.o.o.o.o.",
      open: "..............o...............o.",
    },
  },
];

const cell = (c: string): Vel => (c === "x" ? 2 : c === "o" ? 1 : 0);

export function fromStarter(s: Starter, keep?: Pattern): Pattern {
  const p = emptyPattern(s.steps, s.bpm, s.swing);
  for (const d of DRUMS) {
    const row = s.rows[d];
    if (row) p.grid[d] = Array.from({ length: s.steps }, (_, i) => cell(row[i] ?? "."));
  }
  // Keep the reader's mix when switching patterns
  if (keep) {
    p.vol = { ...keep.vol };
    p.mute = { ...keep.mute };
    p.solo = { ...keep.solo };
  }
  return p;
}

export const starter = (id: unknown) => STARTERS.find((s) => s.id === id);

/* ---------- a pattern in a link ---------- */

/** `#bpm=90&swing=40&steps=16&kick=2000000100200000&…&vol=80,80,…&mute=hat` */
export function toHash(p: Pattern): string {
  const q = new URLSearchParams();
  q.set("bpm", String(p.bpm));
  q.set("swing", String(p.swing));
  q.set("steps", String(p.steps));
  for (const d of DRUMS) if (p.grid[d].some(Boolean)) q.set(d, p.grid[d].join(""));
  if (DRUMS.some((d) => p.vol[d] !== DEFAULT_VOL))
    q.set("vol", DRUMS.map((d) => Math.round(p.vol[d] * 100)).join(","));
  const muted = DRUMS.filter((d) => p.mute[d]);
  if (muted.length) q.set("mute", muted.join(","));
  const solo = DRUMS.filter((d) => p.solo[d]);
  if (solo.length) q.set("solo", solo.join(","));
  return q.toString();
}

/** A pattern from a link, or null when the link doesn't hold one */
export function fromHash(hash: string): Pattern | null {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const steps = Number(q.get("steps"));
  if (!(LENGTHS as readonly number[]).includes(steps)) return null;
  if (!DRUMS.some((d) => q.has(d))) return null;
  const bpm = clampBpm(Number(q.get("bpm")) || 100);
  const swing = Math.min(100, Math.max(0, Math.round(Number(q.get("swing")) || 0)));
  const p = emptyPattern(steps, bpm, swing);
  for (const d of DRUMS) {
    const row = q.get(d);
    if (row)
      p.grid[d] = Array.from({ length: steps }, (_, i) => {
        const c = Number(row[i]);
        return (c === 1 || c === 2 ? c : 0) as Vel;
      });
  }
  const vol = q.get("vol")?.split(",").map(Number);
  if (vol?.length === DRUMS.length)
    DRUMS.forEach((d, i) => {
      const v = vol[i]!;
      if (Number.isFinite(v)) p.vol[d] = Math.min(1, Math.max(0, v / 100));
    });
  for (const d of q.get("mute")?.split(",") ?? []) if (d in p.mute) p.mute[d as DrumId] = true;
  for (const d of q.get("solo")?.split(",") ?? []) if (d in p.solo) p.solo[d as DrumId] = true;
  return p;
}

/** A stored pattern that may be from an older version or edited by hand: fill in what's missing */
export function sane(v: unknown): Pattern | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Partial<Pattern>;
  if (!(LENGTHS as readonly number[]).includes(o.steps as number) || !o.grid) return null;
  const p = emptyPattern(o.steps!, clampBpm(Number(o.bpm) || 100), Math.min(100, Math.max(0, Number(o.swing) || 0)));
  for (const d of DRUMS) {
    const row = o.grid[d];
    if (Array.isArray(row))
      p.grid[d] = Array.from({ length: p.steps }, (_, i) => (row[i] === 1 || row[i] === 2 ? row[i] : 0) as Vel);
    const vol = o.vol?.[d];
    if (typeof vol === "number" && vol >= 0 && vol <= 1) p.vol[d] = vol;
    p.mute[d] = o.mute?.[d] === true;
    p.solo[d] = o.solo?.[d] === true;
  }
  return p;
}
