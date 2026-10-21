/**
 * The beat maker's pure engine, checked directly (no browser): step timing with swing, the
 * starter patterns, resizing, links, stored patterns, mute/solo, the drum sounds and the mixdown
 * (length, wrap-around tails, the hi-hat choke, no clipping) and the WAV writer.
 */
import { expect, test } from "@playwright/test";
import {
  DRUMS,
  LENGTHS,
  STARTERS,
  audible,
  channelGain,
  emptyPattern,
  fromHash,
  fromStarter,
  hits,
  loopLength,
  mixdown,
  resize,
  sane,
  starter,
  stepTime,
  synth,
  toHash,
  wav,
  type DrumId,
} from "../../apps/musictool/src/lib/drums.ts";
import { getApp } from "../../packages/registry/src/index.ts";

const SR = 22050;
const sounds = Object.fromEntries(
  DRUMS.map((d) => [d, synth(d, SR)]),
) as Record<DrumId, Float32Array>;
const energy = (x: Float32Array, from: number, to: number) => {
  let e = 0;
  for (let i = from; i < to; i++) e += x[i]! * x[i]!;
  return e;
};

test("steps are sixteenths, and swing delays only the off-beat ones by up to a triplet", () => {
  // 120 BPM: a beat is 0.5 s, a step 0.125 s
  expect(stepTime(0, 120, 0)).toBe(0);
  expect(stepTime(1, 120, 0)).toBeCloseTo(0.125, 9);
  expect(stepTime(4, 120, 100)).toBeCloseTo(0.5, 9);
  // Full swing puts the off-beat sixteenth on the triplet: 2/3 of the way through the eighth
  expect(stepTime(1, 120, 100)).toBeCloseTo(0.25 * (2 / 3), 9);
  expect(stepTime(3, 120, 50)).toBeCloseTo(0.375 + 0.125 / 6, 9);
});

test("starter patterns: valid rows, unique ids, and every use case points at one", () => {
  const ids = new Set<string>();
  for (const s of STARTERS) {
    expect(ids.has(s.id), s.id).toBe(false);
    ids.add(s.id);
    expect(LENGTHS as readonly number[]).toContain(s.steps);
    for (const [d, row] of Object.entries(s.rows)) {
      expect(DRUMS as readonly string[], s.id).toContain(d);
      expect(row, `${s.id} ${d}`).toHaveLength(s.steps);
      expect(row).toMatch(/^[xo.]+$/);
    }
    const p = fromStarter(s);
    expect(p.bpm).toBe(s.bpm);
    expect(hits(p)).toBeGreaterThan(4);
    // Every starter has a kick on the downbeat
    expect(p.grid.kick[0]).toBeGreaterThan(0);
  }
  for (const t of getApp("musictool").tasks.filter(
    (t) => t.tool === "beat-maker",
  ))
    expect(starter(t.preset.pattern), t.slug).toBeTruthy();
});

test("changing the length repeats the bar or keeps the start", () => {
  const p = fromStarter(starter("rock")!);
  const long = resize(p, 32);
  expect(long.grid.kick).toEqual([...p.grid.kick, ...p.grid.kick]);
  const waltz = resize(p, 12);
  expect(waltz.grid.snare).toEqual(p.grid.snare.slice(0, 12));
  expect(waltz.steps).toBe(12);
});

test("a beat survives a link, and bad links are ignored", () => {
  const p = fromStarter(starter("house")!);
  p.vol.clap = 0.5;
  p.mute.open = true;
  p.solo.kick = true;
  const back = fromHash(`#${toHash(p)}`)!;
  expect(back).toEqual(p);
  expect(fromHash("#bpm=90")).toBeNull();
  expect(fromHash("#steps=7&kick=1")).toBeNull();
  expect(fromHash("")).toBeNull();
  // Out-of-range values are clamped, unknown digits become rests
  const odd = fromHash("#bpm=999&swing=300&steps=16&kick=2x91")!;
  expect(odd.bpm).toBe(240);
  expect(odd.swing).toBe(100);
  expect(odd.grid.kick.slice(0, 4)).toEqual([2, 0, 0, 1]);
});

test("stored patterns are checked before use", () => {
  expect(sane(null)).toBeNull();
  expect(sane({ steps: 5, grid: {} })).toBeNull();
  const p = sane({
    steps: 16,
    bpm: 5000,
    grid: { kick: [2, 9, 1] },
    vol: { kick: 3 },
  })!;
  expect(p.bpm).toBe(240);
  expect(p.grid.kick.slice(0, 4)).toEqual([2, 0, 1, 0]);
  expect(p.grid.kick).toHaveLength(16);
  expect(p.vol.kick).toBe(0.8);
  expect(p.grid.snare.every((v) => v === 0)).toBe(true);
});

test("mute and solo: solo wins, and silent drums get no gain", () => {
  const p = emptyPattern();
  expect(DRUMS.every((d) => audible(p, d))).toBe(true);
  p.mute.hat = true;
  expect(audible(p, "hat")).toBe(false);
  expect(channelGain(p, "hat")).toBe(0);
  p.solo.snare = true;
  expect(DRUMS.filter((d) => audible(p, d))).toEqual(["snare"]);
  expect(channelGain(p, "snare")).toBeCloseTo(0.64, 9);
});

test("drum sounds: the same every time, never clipping, and the kick is low", () => {
  for (const d of DRUMS) {
    const a = synth(d, SR);
    expect(a).toEqual(synth(d, SR));
    let peak = 0;
    for (const v of a) peak = Math.max(peak, Math.abs(v));
    expect(peak, d).toBeGreaterThan(0.3);
    expect(peak, d).toBeLessThanOrEqual(0.95 + 1e-6);
    // Faded out at the end
    expect(Math.abs(a[a.length - 1]!), d).toBeLessThan(1e-3);
  }
  // Kick: count zero crossings over its body; a low drum crosses rarely
  const k = synth("kick", 44100);
  let z = 0;
  for (let i = 4410; i < 13230; i++) if (k[i - 1]! < 0 !== k[i]! < 0) z++;
  const hz = z / 2 / 0.2;
  expect(hz).toBeGreaterThan(40);
  expect(hz).toBeLessThan(90);
});

test("mixdown: exact loop length, hits where the steps are, tails wrap, no clipping", () => {
  const p = emptyPattern(16, 120, 0);
  p.grid.kick[0] = 2;
  p.grid.snare[8] = 2;
  const [L, R] = mixdown(p, SR, 2, sounds);
  expect(L.length).toBe(Math.round(loopLength(p) * 2 * SR));
  expect(L.length).toBe(88200);
  // Kick in the middle: equal in both channels
  expect(energy(L, 0, 400)).toBeGreaterThan(1);
  expect(energy(L, 0, 400)).toBeCloseTo(energy(R, 0, 400), 6);
  // Silence just before the snare (step 8 = 1 s), sound right after it
  const snareAt = SR * 1;
  expect(energy(L, snareAt - 200, snareAt)).toBeLessThan(
    energy(L, snareAt, snareAt + 200) / 100,
  );
  // An open hat on the last step rings past the end and wraps to the start of the file
  const tail = emptyPattern(16, 120, 0);
  tail.grid.open[15] = 2;
  const [T] = mixdown(tail, SR, 1, sounds);
  expect(energy(T, 0, 200)).toBeGreaterThan(0.01);
  // A busy pattern at full volume never clips
  const loud = fromStarter(starter("house")!);
  for (const d of DRUMS) {
    loud.vol[d] = 1;
    loud.grid[d] = loud.grid[d].map(() => 2);
  }
  const [A, B] = mixdown(loud, SR, 1, sounds);
  let peak = 0;
  for (let i = 0; i < A.length; i++)
    peak = Math.max(peak, Math.abs(A[i]!), Math.abs(B[i]!));
  expect(peak).toBeLessThanOrEqual(0.95 + 1e-6);
});

test("mixdown: a closed hat cuts an open hat short", () => {
  const p = emptyPattern(16, 120, 0);
  p.grid.open[0] = 2;
  const [free] = mixdown(p, SR, 1, sounds);
  p.grid.hat[2] = 1;
  const hatOnly = emptyPattern(16, 120, 0);
  hatOnly.grid.hat[2] = 1;
  const [both] = mixdown(p, SR, 1, sounds);
  const [justHat] = mixdown(hatOnly, SR, 1, sounds);
  // After the closed hat (step 2 = 0.25 s) only the closed hat is left
  const from = Math.round(0.25 * SR) + 80;
  const to = Math.round(0.45 * SR);
  expect(energy(free, from, to)).toBeGreaterThan(0.05);
  expect(
    Math.abs(energy(both, from, to) - energy(justHat, from, to)),
  ).toBeLessThan(1e-3);
});

test("WAV: a valid 16-bit stereo header and the samples in order", () => {
  const L = new Float32Array([0, 0.5, -1]);
  const R = new Float32Array([1, -0.5, 0]);
  const b = new DataView(wav([L, R], 44100));
  const s = (o: number) =>
    String.fromCharCode(...new Uint8Array(b.buffer, o, 4));
  expect(s(0)).toBe("RIFF");
  expect(s(8)).toBe("WAVE");
  expect(b.getUint16(22, true)).toBe(2);
  expect(b.getUint32(24, true)).toBe(44100);
  expect(b.getUint16(34, true)).toBe(16);
  expect(b.getUint32(40, true)).toBe(12);
  expect([0, 1, 2, 3, 4, 5].map((i) => b.getInt16(44 + i * 2, true))).toEqual([
    0, 32767, 16384, -16383, -32767, 0,
  ]);
});
