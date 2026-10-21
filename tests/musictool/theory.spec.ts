/**
 * MusicTool's pure parts, checked directly (no browser): the pitch detector on synthetic tones
 * with and without noise, the music theory (spelling, chords, scales), chord fingerings, the
 * metronome's schedule and the tap-tempo maths.
 */
import { expect, test } from "@playwright/test";
import { detectPitch, synth } from "../../apps/musictool/src/lib/pitch.ts";
import {
  chord,
  chordType,
  midiOf,
  noteName,
  parseNote,
  readNote,
  scale,
  scaleType,
} from "../../apps/musictool/src/lib/theory.ts";
import {
  FRETTED,
  fretCode,
  voicings,
} from "../../apps/musictool/src/lib/voicing.ts";
import {
  Planner,
  defaultAccents,
  tapResets,
  tapTempo,
  type MetroSettings,
} from "../../apps/musictool/src/lib/metronome.ts";

const cents = (f: number, ref: number) => 1200 * Math.log2(f / ref);

test.describe("pitch detector", () => {
  const cases: [number, string][] = [
    [82.41, "E2"],
    [110, "A2"],
    [196, "G3"],
    [440, "A4"],
    [1000, "B5"],
  ];
  for (const rate of [44100, 48000])
    for (const wave of ["sine", "saw"] as const)
      for (const noise of [0, 0.05])
        test(`${wave} at ${rate} Hz${noise ? " with noise" : ""}: right note within ±1 cent`, () => {
          for (const [f, name] of cases)
            for (const phase of [0, 0.37, 0.71]) {
              const p = detectPitch(
                synth(f, rate, 4096, { wave, noise, phase }),
                rate,
              );
              expect(p, `${f} Hz`).not.toBeNull();
              const n = readNote(p!.freq);
              expect(`${n.name}${n.octave}`, `${f} Hz`).toBe(name);
              expect(
                Math.abs(cents(p!.freq, f)),
                `${f} Hz ${wave} phase ${phase}`,
              ).toBeLessThan(1);
            }
        });

  test("5-string bass low B (30.87 Hz) and a high E (1318.5 Hz)", () => {
    for (const [f, name] of [
      [30.868, "B0"],
      [1318.51, "E6"],
    ] as const) {
      const p = detectPitch(synth(f, 48000, 4096, { wave: "saw" }), 48000)!;
      expect(`${readNote(p.freq).name}${readNote(p.freq).octave}`).toBe(name);
      expect(Math.abs(cents(p.freq, f))).toBeLessThan(1);
    }
  });

  test("silence and noise give no note", () => {
    expect(detectPitch(new Float32Array(4096), 48000)).toBeNull();
    expect(
      detectPitch(synth(440, 48000, 4096, { amp: 0.001 }), 48000),
    ).toBeNull();
    expect(
      detectPitch(synth(440, 48000, 4096, { amp: 0, noise: 0.3 }), 48000),
    ).toBeNull();
  });

  test("the reference pitch moves the reading", () => {
    const n = readNote(442, 442);
    expect(`${n.name}${n.octave}`).toBe("A4");
    expect(n.cents).toBeCloseTo(0, 6);
    expect(readNote(440, 442).cents).toBeCloseTo(cents(440, 442), 6);
    expect(midiOf(261.6256)).toBeCloseTo(60, 4);
  });
});

test("chords are spelled from theory", () => {
  const notes = (root: string, type: string) =>
    chord(parseNote(root)!, chordType(type))
      .notes.map((n) => noteName(n, true))
      .join(" ");
  expect(notes("C", "maj")).toBe("C E G");
  expect(notes("A", "m7")).toBe("A C E G");
  expect(notes("F#", "dim")).toBe("F# A C");
  expect(notes("Bb", "7")).toBe("Bb D F Ab");
  expect(notes("Eb", "maj7")).toBe("Eb G Bb D");
  expect(notes("C#", "aug")).toBe("C# E# G##");
  expect(notes("B", "m7b5")).toBe("B D F A");
  expect(notes("G", "9")).toBe("G B D F A");
  expect(chord(parseNote("F#")!, chordType("dim")).symbol).toBe("F♯dim");
});

test("scales are spelled from theory", () => {
  const notes = (root: string, type: string) =>
    scale(parseNote(root)!, scaleType(type))
      .notes.map((n) => noteName(n, true))
      .join(" ");
  expect(notes("A", "minor-pentatonic")).toBe("A C D E G");
  expect(notes("D", "dorian")).toBe("D E F G A B C");
  expect(notes("F", "major")).toBe("F G A Bb C D E");
  expect(notes("A", "blues")).toBe("A C D Eb E G");
  expect(notes("E", "harmonic-minor")).toBe("E F# G A B C D#");
  expect(notes("Bb", "chromatic").split(" ")).toHaveLength(12);
  expect(scale(parseNote("D")!, scaleType("dorian")).degrees.join(" ")).toBe(
    "1 2 ♭3 4 5 6 ♭7",
  );
});

test("chord shapes: playable, only chord tones, the common open shapes first", () => {
  const first = (root: string, type: string, inst: keyof typeof FRETTED) =>
    fretCode(
      voicings(chord(parseNote(root)!, chordType(type)), FRETTED[inst])[0]!
        .frets,
    );
  expect(first("C", "maj", "guitar")).toBe("x32010");
  expect(first("A", "m7", "guitar")).toBe("x02010");
  expect(first("G", "maj", "guitar")).toBe("320003");
  expect(first("E", "maj", "guitar")).toBe("022100");
  expect(first("D", "maj", "guitar")).toBe("xx0232");
  expect(first("F", "maj", "guitar")).toBe("133211");
  expect(first("C", "maj", "ukulele")).toBe("0003");
  expect(first("A", "m7", "ukulele")).toBe("0000");
  expect(first("G", "maj", "ukulele")).toBe("0232");
  for (const inst of ["guitar", "ukulele", "bass"] as const)
    for (const root of [
      "C",
      "C#",
      "D",
      "Eb",
      "E",
      "F",
      "F#",
      "G",
      "Ab",
      "A",
      "Bb",
      "B",
    ])
      for (const type of [
        "maj",
        "m",
        "7",
        "maj7",
        "m7",
        "dim",
        "aug",
        "sus4",
      ]) {
        const c = chord(parseNote(root)!, chordType(type));
        const list = voicings(c, FRETTED[inst]);
        expect(list.length, `${c.symbol} on ${inst}`).toBeGreaterThan(0);
        for (const v of list) {
          const played = v.frets.flatMap((f, s) =>
            f < 0 ? [] : [FRETTED[inst].strings[s]! + f],
          );
          for (const m of played)
            expect(c.pcs, `${c.symbol} ${fretCode(v.frets)}`).toContain(m % 12);
          const fretted = v.frets.filter((f) => f > 0);
          if (fretted.length)
            expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThan(4);
          if (inst !== "ukulele")
            expect(Math.min(...played) % 12).toBe(c.pcs[0]);
        }
      }
});

const settings = (over: Partial<MetroSettings> = {}): MetroSettings => ({
  bpm: 120,
  beats: 4,
  unit: 4,
  accents: defaultAccents(4, 4),
  sub: 1,
  sound: "click",
  volume: 1,
  trainer: { on: false, step: 5, every: 4, max: 200 },
  ...over,
});

test("metronome schedule: even spacing, accents, subdivisions, speed trainer", () => {
  const p = new Planner(settings({ bpm: 90 }), 1);
  const ticks = p.until(1 + 8 * (60 / 90) - 1e-9);
  expect(ticks).toHaveLength(8);
  ticks.forEach((t, i) => expect(t.time).toBeCloseTo(1 + (i * 60) / 90, 9));
  expect(ticks.map((t) => t.level)).toEqual([3, 2, 2, 2, 3, 2, 2, 2]);

  expect(defaultAccents(6, 8)).toEqual([2, 1, 1, 2, 1, 1]);
  expect(defaultAccents(7, 8)).toEqual([2, 1, 2, 1, 2, 1, 1]);
  const six = new Planner(
    settings({ beats: 6, unit: 8, accents: defaultAccents(6, 8) }),
    0,
  ).until(2.999);
  expect(six.map((t) => t.level)).toEqual([3, 2, 2, 3, 2, 2]);

  const trip = new Planner(settings({ bpm: 100, sub: 3 }), 0).until(0.6 - 1e-9);
  expect(trip.map((t) => t.level)).toEqual([3, 1, 1]);
  expect(trip[1]!.time).toBeCloseTo(0.2, 9);

  // Muted beats are scheduled silent
  const muted = new Planner(settings({ accents: [2, 0, 1, 1] }), 0).until(
    1.999,
  );
  expect(muted.map((t) => t.level)).toEqual([3, 0, 2, 2]);

  // +10 BPM every 2 bars up to 140, in 2/4
  const tr = new Planner(
    settings({
      beats: 2,
      accents: [2, 1],
      bpm: 120,
      trainer: { on: true, step: 10, every: 2, max: 140 },
    }),
    0,
  );
  const all = tr.until(12);
  const bpmAtBar = (bar: number) => all.find((t) => t.bar === bar)!.bpm;
  expect([0, 1, 2, 3, 4, 5, 6, 7].map(bpmAtBar)).toEqual([
    120, 120, 130, 130, 140, 140, 140, 140,
  ]);
  // Bar 2 starts exactly two bars of 120 BPM after the start
  expect(all.find((t) => t.bar === 2)!.time).toBeCloseTo(2, 9);
});

test("tap tempo: median of intervals, resets after a pause", () => {
  expect(tapTempo([0])).toBeNull();
  expect(tapTempo([0, 500, 1000, 1500, 2000])!.bpm).toBeCloseTo(120, 9);
  // One late tap doesn't move the median
  expect(tapTempo([0, 500, 1000, 1640, 2000, 2500, 3000])!.bpm).toBeCloseTo(
    120,
    9,
  );
  expect(tapTempo([0, 500, 1000, 1500])!.spread).toBe(0);
  expect(tapResets(2100, 120)).toBe(true);
  expect(tapResets(1900, 120)).toBe(false);
  // Very slow tempos wait longer before starting over
  expect(tapResets(2500, 30)).toBe(false);
});
