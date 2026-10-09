/**
 * Audio speed changes for the fast engine, streaming (chunks in, chunks out; planar float32):
 *
 *   tempo(speed, rate, channels)   time-stretch that keeps the pitch (WSOLA: overlapping 40 ms
 *                                  windows taken from where the sound lines up best)
 *   tape(speed, channels)          plain resampling: faster is higher, slower is lower
 *
 * `push(planes)` returns the output made so far (possibly empty). The last ~40 ms of a stretch
 * isn't flushed, which is below what a speed change can notice. Pure: no browser APIs.
 */

export interface Stretcher {
  push(planes: Float32Array[]): Float32Array[];
}

/** Planar buffer with an absolute start index, dropped from the front as it's used */
class Buffer {
  data: Float32Array[];
  base = 0;
  constructor(channels: number) {
    this.data = Array.from({ length: channels }, () => new Float32Array(0));
  }
  get end() {
    return this.base + (this.data[0]?.length ?? 0);
  }
  append(planes: Float32Array[]) {
    this.data = this.data.map((d, c) => {
      const add = planes[c] ?? planes[0]!;
      const out = new Float32Array(d.length + add.length);
      out.set(d);
      out.set(add, d.length);
      return out;
    });
  }
  /** Forget everything before absolute index `from` */
  drop(from: number) {
    const k = Math.min(from - this.base, this.data[0]?.length ?? 0);
    if (k <= 0) return;
    this.data = this.data.map((d) => d.slice(k));
    this.base += k;
  }
}

export function tempo(
  speed: number,
  sampleRate: number,
  channels: number,
): Stretcher {
  const N = Math.max(256, Math.round((sampleRate * 0.04) / 2) * 2);
  const Hs = N / 2;
  const Ha = Hs * speed;
  const delta = Math.round(sampleRate * 0.012);
  // Periodic Hann: two windows half a window apart add up to exactly 1
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++)
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const buf = new Buffer(channels);
  let mono = new Float32Array(0);
  const tail = Array.from({ length: channels }, () => new Float32Array(Hs));
  let k = 0;
  let prev = -1;

  /** Similarity of mono[a..a+L) and mono[b..b+L), normalised by the candidate's energy */
  const score = (a: number, b: number, L: number, step: number) => {
    let dot = 0;
    let e = 1e-9;
    for (let i = 0; i < L; i += step) {
      const x = mono[a + i]!;
      dot += x * mono[b + i]!;
      e += x * x;
    }
    return dot / Math.sqrt(e);
  };

  /** Input position near `nominal` that continues the previous window most smoothly */
  const best = (nominal: number, ref: number) => {
    const lo = Math.max(buf.base, nominal - delta);
    const hi = nominal + delta;
    const r = ref - buf.base;
    let at = Math.max(lo, Math.min(hi, nominal));
    let top = -Infinity;
    for (let p = lo; p <= hi; p += 4) {
      const s = score(p - buf.base, r, Hs, 4);
      if (s > top) {
        top = s;
        at = p;
      }
    }
    const c = at;
    top = -Infinity;
    for (let p = Math.max(lo, c - 3); p <= Math.min(hi, c + 3); p++) {
      const s = score(p - buf.base, r, Hs, 1);
      if (s > top) {
        top = s;
        at = p;
      }
    }
    return at;
  };

  return {
    push(planes) {
      buf.append(planes);
      const m = new Float32Array(planes[0]!.length);
      for (const p of planes) for (let i = 0; i < m.length; i++) m[i]! += p[i]!;
      const all = new Float32Array(mono.length + m.length);
      all.set(mono);
      all.set(m, mono.length);
      mono = all;

      const out: Float32Array[][] = [];
      for (;;) {
        const nominal = Math.round(k * Ha);
        const need = prev < 0 ? N : Math.max(nominal + delta, prev + Hs) + N;
        if (buf.end < need) break;
        const pos = prev < 0 ? 0 : best(nominal, prev + Hs);
        const o = pos - buf.base;
        const chunk: Float32Array[] = [];
        for (let c = 0; c < channels; c++) {
          const d = buf.data[c]!;
          const t = tail[c]!;
          const y = new Float32Array(Hs);
          for (let i = 0; i < Hs; i++) y[i] = t[i]! + d[o + i]! * win[i]!;
          for (let i = Hs; i < N; i++) t[i - Hs] = d[o + i]! * win[i]!;
          chunk.push(y);
        }
        out.push(chunk);
        prev = pos;
        k++;
        const keep = Math.min(Math.round(k * Ha) - delta, prev + Hs);
        const from = Math.max(buf.base, keep - 8);
        const cut = from - buf.base;
        if (cut > 0) {
          buf.drop(from);
          mono = mono.slice(cut);
        }
      }
      return joinChunks(out, channels);
    },
  };
}

export function tape(speed: number, channels: number): Stretcher {
  const buf = new Buffer(channels);
  // Absolute input position of the next output sample
  let pos = 0;
  return {
    push(planes) {
      buf.append(planes);
      const n = Math.max(0, Math.floor((buf.end - 1 - pos) / speed));
      const out = Array.from({ length: channels }, () => new Float32Array(n));
      for (let j = 0; j < n; j++) {
        const x = pos + j * speed;
        const i = Math.floor(x);
        const f = x - i;
        const a = i - buf.base;
        for (let c = 0; c < channels; c++) {
          const d = buf.data[c]!;
          out[c]![j] = d[a]! + (d[a + 1]! - d[a]!) * f;
        }
      }
      pos += n * speed;
      buf.drop(Math.floor(pos));
      return out;
    },
  };
}

function joinChunks(chunks: Float32Array[][], channels: number) {
  const len = chunks.reduce((s, c) => s + c[0]!.length, 0);
  const out = Array.from({ length: channels }, () => new Float32Array(len));
  let at = 0;
  for (const ch of chunks) {
    for (let c = 0; c < channels; c++) out[c]!.set(ch[c]!, at);
    at += ch[0]!.length;
  }
  return out;
}
