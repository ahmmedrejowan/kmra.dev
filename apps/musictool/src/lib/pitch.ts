/**
 * Pitch detection: the McLeod Pitch Method (normalised square difference function, NSDF),
 * computed with an FFT so a 4096-sample window costs well under a millisecond. Pure functions,
 * used by the tuner's worker and imported directly by the tests.
 *
 * Accuracy: the period is found on the first strong NSDF peak (parabolic interpolation), then
 * refined on the furthest clean multiple of it (k·period / k), which keeps sines and rich tones
 * within a fraction of a cent from 30 Hz (5-string bass) to a few kHz.
 */

export interface Pitch {
  /** Hz */
  freq: number;
  /** NSDF peak height, 0 … 1: how periodic the sound is */
  clarity: number;
  /** Loudness of the window (root mean square) */
  rms: number;
}

export interface PitchOptions {
  minFreq?: number;
  maxFreq?: number;
  /** Quieter windows than this RMS give no pitch (silence, room noise) */
  gate?: number;
  /** Peaks below this clarity give no pitch */
  minClarity?: number;
  /** MPM's k: take the first peak at least this fraction of the highest one */
  k?: number;
  /** Fine-tune with a least-squares fit (default true) */
  fit?: boolean;
}

export function rms(buf: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i]! * buf[i]!;
  return Math.sqrt(s / Math.max(1, buf.length));
}

/** Window size for a sample rate: about 85 ms, a power of two (4096 at 44.1/48 kHz) */
export function windowSize(sampleRate: number): number {
  let n = 1024;
  while (n < sampleRate * 0.08) n *= 2;
  return n;
}

/* ---------- FFT (in place, radix 2) ---------- */

function fft(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let j = 0; j < half; j++) {
        const a = i + j;
        const b = a + half;
        const xr = re[b]! * cr - im[b]! * ci;
        const xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

/** Normalised square difference function of a window, lags 0 … maxLag */
export function nsdf(buf: ArrayLike<number>, maxLag: number): Float64Array {
  const n = buf.length;
  let size = 1;
  while (size < 2 * n) size <<= 1;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += buf[i]!;
  mean /= n;
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = re[i] = buf[i]! - mean;
  fft(re, im, false);
  for (let i = 0; i < size; i++) {
    re[i] = re[i]! * re[i]! + im[i]! * im[i]!;
    im[i] = 0;
  }
  fft(re, im, true);
  // re[τ]/size is the autocorrelation r'(τ); m'(τ) = Σ x[j]² + x[j+τ]² over the overlap
  const out = new Float64Array(maxLag + 1);
  let m = 0;
  for (let i = 0; i < n; i++) m += 2 * x[i]! * x[i]!;
  for (let t = 0; t <= maxLag; t++) {
    if (t > 0) m -= x[t - 1]! * x[t - 1]! + x[n - t]! * x[n - t]!;
    out[t] = m > 1e-12 ? (2 * (re[t]! / size)) / m : 0;
  }
  return out;
}

/** Vertex of the parabola through (t−1, t, t+1): [position, height] */
function parabola(d: Float64Array, t: number): [number, number] {
  const a = d[t - 1] ?? d[t]!;
  const b = d[t]!;
  const c = d[t + 1] ?? d[t]!;
  const den = a - 2 * b + c;
  if (den === 0) return [t, b];
  const shift = (0.5 * (a - c)) / den;
  return [t + shift, b - 0.25 * (a - c) * shift];
}

/**
 * The pitch of one window, or null for silence, noise or sounds without a clear pitch.
 * The window should hold at least two periods of the lowest note you expect.
 */
export function detectPitch(
  buf: ArrayLike<number>,
  sampleRate: number,
  opts: PitchOptions = {},
): Pitch | null {
  const {
    minFreq = 27,
    maxFreq = 4200,
    gate = 0.004,
    minClarity = 0.8,
    k = 0.9,
  } = opts;
  const level = rms(buf);
  if (level < gate || buf.length < 64) return null;
  const n = buf.length;
  const maxLag = Math.min(
    Math.ceil(sampleRate / minFreq) + 2,
    Math.floor(n * 0.62),
  );
  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  const d = nsdf(buf, maxLag);

  // Key maxima: the highest point of each positive stretch after the first zero crossing
  const peaks: number[] = [];
  let t = 1;
  while (t < maxLag && d[t]! > 0) t++;
  let best = -1;
  for (; t < maxLag; t++) {
    if (d[t]! > 0 && d[t - 1]! <= 0) best = t;
    if (best >= 0 && d[t]! > d[best]!) best = t;
    if (best >= 0 && d[t]! <= 0 && d[t - 1]! > 0) {
      peaks.push(best);
      best = -1;
    }
  }
  if (best >= 0 && best < maxLag - 1) peaks.push(best);
  const usable = peaks.filter((p) => p >= minLag);
  if (!usable.length) return null;
  const top = Math.max(...usable.map((p) => d[p]!));
  const pick = usable.find((p) => d[p]! >= k * top)!;
  let [period, clarity] = parabola(d, pick);
  if (clarity < minClarity) return null;

  // Follow the period out to its multiples (the error of k·period ÷ k shrinks with k), then
  // fine-tune with a least-squares fit of the note and its harmonics.
  period = refine(d, period, Math.floor(n * 0.6), clarity);
  // Near-pure tones (a tuning fork, a flute, a test tone) in noise: the NSDF wobbles, so take
  // the least-squares fit instead. Rich tones keep the NSDF answer: their harmonics already
  // average the noise out, and a fit of the fundamental alone would be pulled by them.
  if (opts.fit !== false) {
    const fit = fitFreq(buf, sampleRate / period, sampleRate);
    if (fit.share > 0.88) period = sampleRate / fit.freq;
  }
  const freq = sampleRate / period;
  if (freq < minFreq * 0.97 || freq > maxFreq * 1.03) return null;
  return { freq, clarity: Math.min(1, clarity), rms: level };
}

/** Follow the period out to its multiples in the NSDF and re-measure it there */
function refine(
  d: Float64Array,
  period: number,
  limit: number,
  clarity: number,
): number {
  const at = (k: number): number | null => {
    const centre = Math.round(period * k);
    const span = Math.max(
      1,
      Math.min(Math.ceil(k * 0.05), Math.floor(period / 4)),
    );
    let p = centre;
    for (let i = centre - span; i <= centre + span; i++)
      if (i > 0 && i < d.length - 1 && d[i]! > d[p]!) p = i;
    if (p <= 0 || p >= d.length - 1) return null;
    if (d[p]! < d[p - 1]! || d[p]! < d[p + 1]!) return null;
    const [pos, h] = parabola(d, p);
    return h >= 0.75 * clarity ? pos / k : null;
  };
  const first = at(1);
  if (first !== null && Math.abs(first - period) < period * 0.01)
    period = first;
  let k = 2;
  while (period * k < limit) {
    const p = at(k);
    if (p === null) break;
    period = p;
    k *= 2;
  }
  const last = Math.floor(limit / period);
  if (last >= 2) {
    const p = at(last);
    if (p !== null) period = p;
  }
  return period;
}

/**
 * Least-squares fit: the frequency whose sinusoid (and harmonics, if asked; each with its own
 * amplitude and phase, plus a constant) explains the most of the window. `share` is the part of
 * the window's variance it explains. This is the maximum-likelihood estimate in white noise and has
 * no edge bias, so it stays accurate with only a few periods in the window.
 */
export function fitFreq(
  buf: ArrayLike<number>,
  guess: number,
  sampleRate: number,
  harmonics = 1,
): { freq: number; share: number } {
  const n = buf.length;
  const x = Float64Array.from(buf as ArrayLike<number>);
  const m = 2 * harmonics + 1;
  const col = new Float64Array(m);
  const gram = new Float64Array(m * m);
  const rhs = new Float64Array(m);
  const cs = new Float64Array(harmonics);
  const sn = new Float64Array(harmonics);
  const rc = new Float64Array(harmonics);
  const rs = new Float64Array(harmonics);
  // Energy of the projection of x onto [1, cos hωt, sin hωt …]: rhsᵀ · Gram⁻¹ · rhs
  const energy = (f: number) => {
    gram.fill(0);
    rhs.fill(0);
    for (let h = 0; h < harmonics; h++) {
      const w = (2 * Math.PI * (h + 1) * f) / sampleRate;
      rc[h] = Math.cos(w);
      rs[h] = Math.sin(w);
      cs[h] = 1;
      sn[h] = 0;
    }
    for (let i = 0; i < n; i++) {
      col[0] = 1;
      for (let h = 0; h < harmonics; h++) {
        col[1 + 2 * h] = cs[h]!;
        col[2 + 2 * h] = sn[h]!;
        const t = cs[h]! * rc[h]! - sn[h]! * rs[h]!;
        sn[h] = cs[h]! * rs[h]! + sn[h]! * rc[h]!;
        cs[h] = t;
      }
      const v = x[i]!;
      for (let r = 0; r < m; r++) {
        const cr = col[r]!;
        rhs[r] = rhs[r]! + v * cr;
        for (let c = r; c < m; c++)
          gram[r * m + c] = gram[r * m + c]! + cr * col[c]!;
      }
    }
    for (let r = 0; r < m; r++)
      for (let c = 0; c < r; c++) gram[r * m + c] = gram[c * m + r]!;
    // Solve Gram · β = rhs (Gaussian elimination with partial pivoting); energy = rhs · β
    const A = Float64Array.from(gram);
    const y = Float64Array.from(rhs);
    for (let k = 0; k < m; k++) {
      let piv = k;
      for (let r = k + 1; r < m; r++)
        if (Math.abs(A[r * m + k]!) > Math.abs(A[piv * m + k]!)) piv = r;
      if (Math.abs(A[piv * m + k]!) < 1e-12) return 0;
      if (piv !== k) {
        for (let c = 0; c < m; c++)
          [A[k * m + c], A[piv * m + c]] = [A[piv * m + c]!, A[k * m + c]!];
        [y[k], y[piv]] = [y[piv]!, y[k]!];
      }
      for (let r = k + 1; r < m; r++) {
        const fct = A[r * m + k]! / A[k * m + k]!;
        if (!fct) continue;
        for (let c = k; c < m; c++)
          A[r * m + c] = A[r * m + c]! - fct * A[k * m + c]!;
        y[r] = y[r]! - fct * y[k]!;
      }
    }
    const beta = new Float64Array(m);
    for (let k = m - 1; k >= 0; k--) {
      let acc = y[k]!;
      for (let c = k + 1; c < m; c++) acc -= A[k * m + c]! * beta[c]!;
      beta[k] = acc / A[k * m + k]!;
    }
    let e = 0;
    for (let k = 0; k < m; k++) e += rhs[k]! * beta[k]!;
    return e;
  };
  // Coarse scan ±12 cents, then golden-section search around the best point
  const at = (cents: number) => guess * 2 ** (cents / 1200);
  let best = 0;
  let bestE = -1;
  for (let c = -12; c <= 12; c += 2) {
    const e = energy(at(c));
    if (e > bestE) {
      bestE = e;
      best = c;
    }
  }
  let lo = best - 2;
  let hi = best + 2;
  const g = (Math.sqrt(5) - 1) / 2;
  let a = hi - g * (hi - lo);
  let b = lo + g * (hi - lo);
  let ea = energy(at(a));
  let eb = energy(at(b));
  while (hi - lo > 0.01) {
    if (ea > eb) {
      hi = b;
      b = a;
      eb = ea;
      a = hi - g * (hi - lo);
      ea = energy(at(a));
    } else {
      lo = a;
      a = b;
      ea = eb;
      b = lo + g * (hi - lo);
      eb = energy(at(b));
    }
  }
  const freq = at((lo + hi) / 2);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i]!;
  mean /= n;
  let total = 0;
  for (let i = 0; i < n; i++) total += (x[i]! - mean) ** 2;
  const dc = mean * mean * n;
  return { freq, share: total > 0 ? (energy(freq) - dc) / total : 0 };
}

/** Median of a list (for steadying the tuner's reading) */
export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Steadies readings: keeps the last few frequencies, drops ones an octave away from the rest
 * (a string's attack often reads an octave off), and returns their median.
 */
export class Smoother {
  private xs: number[] = [];
  private size: number;
  constructor(size = 5) {
    this.size = size;
  }
  push(freq: number): number {
    if (this.xs.length) {
      const mid = median(this.xs);
      // A jump of more than a semitone and a half starts a new note
      if (Math.abs(1200 * Math.log2(freq / mid)) > 150) this.xs = [];
    }
    this.xs.push(freq);
    if (this.xs.length > this.size) this.xs.shift();
    return median(this.xs);
  }
  reset() {
    this.xs = [];
  }
}

/**
 * Synthetic test tones: sine, or band-limited sawtooth and square (built from harmonics below
 * Nyquist, like a real instrument through a microphone), with optional white noise (seeded).
 */
export function synth(
  freq: number,
  sampleRate: number,
  length: number,
  opts: {
    wave?: "sine" | "saw" | "square";
    amp?: number;
    noise?: number;
    phase?: number;
    seed?: number;
  } = {},
): Float32Array {
  const { wave = "sine", amp = 0.5, noise = 0, phase = 0.3 } = opts;
  let seed = opts.seed ?? 12345;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };
  const top = Math.max(1, Math.floor((sampleRate * 0.45) / freq));
  const parts: [number, number][] =
    wave === "sine"
      ? [[1, 1]]
      : Array.from({ length: top }, (_, i) => i + 1)
          .filter((h) => wave === "saw" || h % 2 === 1)
          .map((h) => [h, (wave === "saw" ? 0.6 : 0.8) / h]);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = (freq * i) / sampleRate + phase;
    let v = 0;
    for (const [h, a] of parts) v += a * Math.sin(2 * Math.PI * h * t);
    out[i] = amp * v + noise * 2 * rand();
  }
  return out;
}
