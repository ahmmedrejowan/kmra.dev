/**
 * Music theory for every MusicTool tool: spelled notes (so F♯ dim is F♯ A C, not F♯ A B♯ … or
 * G♭ A C), frequencies against an adjustable A4, intervals, chords, scales and instrument
 * tunings. Pure functions only, no audio and no DOM, so tests can import them directly.
 */

export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
/** Pitch class of each natural letter */
const NATURAL = [0, 2, 4, 5, 7, 9, 11];

/** A note name without octave: a letter (0 = C … 6 = B) and an accidental (−2 … +2 semitones). */
export interface Spelled {
  l: number;
  a: number;
}

/** Interval as letter steps and semitones: a major third is [2, 4], a diminished fifth [4, 6]. */
export type Iv = readonly [steps: number, semis: number];

export const mod = (n: number, m: number) => ((n % m) + m) % m;

export function pc(n: Spelled): number {
  return mod(NATURAL[n.l]! + n.a, 12);
}

const ACC = { "-2": "𝄫", "-1": "♭", "0": "", "1": "♯", "2": "𝄪" } as Record<
  string,
  string
>;
const ACC_ASCII = { "-2": "bb", "-1": "b", "0": "", "1": "#", "2": "##" } as Record<
  string,
  string
>;

/** "F♯" (or "F#" with ascii) */
export function noteName(n: Spelled, ascii = false): string {
  return LETTERS[n.l]! + (ascii ? ACC_ASCII : ACC)[String(n.a)]!;
}

/** Parse "F#", "Bb", "E♭", "C##" */
export function parseNote(s: string): Spelled | null {
  const m = /^([A-Ga-g])(##|bb|#|b|♯|♭|𝄪|𝄫)?$/.exec(s.trim());
  if (!m) return null;
  const l = LETTERS.indexOf(m[1]!.toUpperCase() as (typeof LETTERS)[number]);
  const acc = m[2] ?? "";
  const a =
    acc === "#" || acc === "♯"
      ? 1
      : acc === "##" || acc === "𝄪"
        ? 2
        : acc === "b" || acc === "♭"
          ? -1
          : acc === "bb" || acc === "𝄫"
            ? -2
            : 0;
  return { l, a };
}

/** Spell the note an interval above a root: transpose({F♯}, [2, 3]) is A. */
export function transpose(root: Spelled, [steps, semis]: Iv): Spelled {
  const l = mod(root.l + steps, 7);
  const want = mod(pc(root) + semis, 12);
  let a = mod(want - NATURAL[l]!, 12);
  if (a > 6) a -= 12;
  return { l, a };
}

/** The twelve keys/roots the pickers offer, spelled the usual way. */
export const ROOTS: Spelled[] = [
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
].map((s) => parseNote(s)!);

/** Chromatic names for the tuner and pickers, sharps by default. */
export const SHARPS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const FLATS = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

/* ---------- pitch and frequency ---------- */

/** MIDI note number to Hz, with A4 (MIDI 69) at `a4` Hz */
export function freqOf(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** Hz to a fractional MIDI note number */
export function midiOf(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4);
}

/** Cents from b to a (positive when a is higher) */
export function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(a / b);
}

export interface NoteReading {
  midi: number;
  /** Name without octave, e.g. "C♯" */
  name: string;
  octave: number;
  /** −50 … +50 from the nearest equal-tempered note */
  cents: number;
  /** The nearest note's exact frequency */
  target: number;
}

/** The nearest note to a frequency, and how far off it is in cents */
export function readNote(freq: number, a4 = 440, flats = false): NoteReading {
  const m = midiOf(freq, a4);
  const midi = Math.round(m);
  return {
    midi,
    name: (flats ? FLATS : SHARPS)[mod(midi, 12)]!,
    octave: Math.floor(midi / 12) - 1,
    cents: (m - midi) * 100,
    target: freqOf(midi, a4),
  };
}

/** "A4" for MIDI 69 */
export function midiName(midi: number, flats = false): string {
  return `${(flats ? FLATS : SHARPS)[mod(midi, 12)]}${Math.floor(midi / 12) - 1}`;
}

/** MIDI of a spelled note in an octave (C4 = 60). B♯3 is 60, C♭4 is 59. */
export function midiAt(n: Spelled, octave: number): number {
  return (octave + 1) * 12 + NATURAL[n.l]! + n.a;
}

/* ---------- intervals ---------- */

export interface IntervalDef {
  id: string;
  short: string;
  name: string;
  semis: number;
}

export const INTERVALS: IntervalDef[] = [
  { id: "m2", short: "m2", name: "Minor 2nd", semis: 1 },
  { id: "M2", short: "M2", name: "Major 2nd", semis: 2 },
  { id: "m3", short: "m3", name: "Minor 3rd", semis: 3 },
  { id: "M3", short: "M3", name: "Major 3rd", semis: 4 },
  { id: "P4", short: "P4", name: "Perfect 4th", semis: 5 },
  { id: "TT", short: "TT", name: "Tritone", semis: 6 },
  { id: "P5", short: "P5", name: "Perfect 5th", semis: 7 },
  { id: "m6", short: "m6", name: "Minor 6th", semis: 8 },
  { id: "M6", short: "M6", name: "Major 6th", semis: 9 },
  { id: "m7", short: "m7", name: "Minor 7th", semis: 10 },
  { id: "M7", short: "M7", name: "Major 7th", semis: 11 },
  { id: "P8", short: "P8", name: "Octave", semis: 12 },
];

/** Degree label of an interval: [2, 3] is "♭3", [4, 8] is "♯5", [8, 14] is "9" */
export function degreeLabel([steps, semis]: Iv): string {
  const octave = Math.floor(steps / 7);
  const natural = NATURAL[steps % 7]! + 12 * octave;
  const d = semis - natural;
  const acc = d === 0 ? "" : d === -1 ? "♭" : d === 1 ? "♯" : d === -2 ? "𝄫" : d === 2 ? "𝄪" : "";
  return acc + String(steps + 1);
}

/* ---------- chords ---------- */

export interface ChordType {
  id: string;
  /** Suffix after the root: "", "m", "maj7", "m7♭5" */
  symbol: string;
  name: string;
  iv: Iv[];
}

const R: Iv = [0, 0];
const M3: Iv = [2, 4];
const m3: Iv = [2, 3];
const P5: Iv = [4, 7];
const d5: Iv = [4, 6];
const A5: Iv = [4, 8];
const m7: Iv = [6, 10];
const M7: Iv = [6, 11];
const d7: Iv = [6, 9];
const M6: Iv = [5, 9];
const M2: Iv = [1, 2];
const P4: Iv = [3, 5];
const M9: Iv = [8, 14];

export const CHORDS: ChordType[] = [
  { id: "maj", symbol: "", name: "Major", iv: [R, M3, P5] },
  { id: "m", symbol: "m", name: "Minor", iv: [R, m3, P5] },
  { id: "7", symbol: "7", name: "Dominant 7th", iv: [R, M3, P5, m7] },
  { id: "maj7", symbol: "maj7", name: "Major 7th", iv: [R, M3, P5, M7] },
  { id: "m7", symbol: "m7", name: "Minor 7th", iv: [R, m3, P5, m7] },
  { id: "sus2", symbol: "sus2", name: "Suspended 2nd", iv: [R, M2, P5] },
  { id: "sus4", symbol: "sus4", name: "Suspended 4th", iv: [R, P4, P5] },
  { id: "7sus4", symbol: "7sus4", name: "7th suspended 4th", iv: [R, P4, P5, m7] },
  { id: "dim", symbol: "dim", name: "Diminished", iv: [R, m3, d5] },
  { id: "dim7", symbol: "dim7", name: "Diminished 7th", iv: [R, m3, d5, d7] },
  { id: "m7b5", symbol: "m7♭5", name: "Half-diminished", iv: [R, m3, d5, m7] },
  { id: "aug", symbol: "aug", name: "Augmented", iv: [R, M3, A5] },
  { id: "6", symbol: "6", name: "Major 6th", iv: [R, M3, P5, M6] },
  { id: "m6", symbol: "m6", name: "Minor 6th", iv: [R, m3, P5, M6] },
  { id: "add9", symbol: "add9", name: "Added 9th", iv: [R, M3, P5, M9] },
  { id: "9", symbol: "9", name: "Dominant 9th", iv: [R, M3, P5, m7, M9] },
  { id: "m9", symbol: "m9", name: "Minor 9th", iv: [R, m3, P5, m7, M9] },
  { id: "maj9", symbol: "maj9", name: "Major 9th", iv: [R, M3, P5, M7, M9] },
  { id: "5", symbol: "5", name: "Power chord", iv: [R, P5] },
];

export const chordType = (id: string) => CHORDS.find((c) => c.id === id) ?? CHORDS[0]!;

export interface Chord {
  root: Spelled;
  type: ChordType;
  notes: Spelled[];
  /** Pitch classes, same order as notes */
  pcs: number[];
  degrees: string[];
  symbol: string;
}

export function chord(root: Spelled, type: ChordType): Chord {
  const notes = type.iv.map((iv) => transpose(root, iv));
  return {
    root,
    type,
    notes,
    pcs: notes.map(pc),
    degrees: type.iv.map(degreeLabel),
    symbol: noteName(root) + type.symbol,
  };
}

/* ---------- scales ---------- */

export interface ScaleType {
  id: string;
  name: string;
  iv: Iv[];
}

const steps = (semis: number[], st: number[]): Iv[] => semis.map((s, i) => [st[i]!, s] as const);
const SEVEN = [0, 1, 2, 3, 4, 5, 6];

export const SCALES: ScaleType[] = [
  { id: "major", name: "Major", iv: steps([0, 2, 4, 5, 7, 9, 11], SEVEN) },
  { id: "minor", name: "Natural minor", iv: steps([0, 2, 3, 5, 7, 8, 10], SEVEN) },
  { id: "harmonic-minor", name: "Harmonic minor", iv: steps([0, 2, 3, 5, 7, 8, 11], SEVEN) },
  { id: "melodic-minor", name: "Melodic minor", iv: steps([0, 2, 3, 5, 7, 9, 11], SEVEN) },
  { id: "major-pentatonic", name: "Major pentatonic", iv: steps([0, 2, 4, 7, 9], [0, 1, 2, 4, 5]) },
  { id: "minor-pentatonic", name: "Minor pentatonic", iv: steps([0, 3, 5, 7, 10], [0, 2, 3, 4, 6]) },
  { id: "blues", name: "Blues", iv: steps([0, 3, 5, 6, 7, 10], [0, 2, 3, 4, 4, 6]) },
  { id: "ionian", name: "Ionian", iv: steps([0, 2, 4, 5, 7, 9, 11], SEVEN) },
  { id: "dorian", name: "Dorian", iv: steps([0, 2, 3, 5, 7, 9, 10], SEVEN) },
  { id: "phrygian", name: "Phrygian", iv: steps([0, 1, 3, 5, 7, 8, 10], SEVEN) },
  { id: "lydian", name: "Lydian", iv: steps([0, 2, 4, 6, 7, 9, 11], SEVEN) },
  { id: "mixolydian", name: "Mixolydian", iv: steps([0, 2, 4, 5, 7, 9, 10], SEVEN) },
  { id: "aeolian", name: "Aeolian", iv: steps([0, 2, 3, 5, 7, 8, 10], SEVEN) },
  { id: "locrian", name: "Locrian", iv: steps([0, 1, 3, 5, 6, 8, 10], SEVEN) },
  {
    id: "chromatic",
    name: "Chromatic",
    iv: steps([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]),
  },
];

export const scaleType = (id: string) => SCALES.find((s) => s.id === id) ?? SCALES[0]!;

/** Flat keys spell the chromatic scale with flats */
const usesFlats = (root: Spelled) => root.a < 0 || (root.l === 3 && root.a === 0);
const CHROMATIC_FLAT = steps([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6]);

export interface Scale {
  root: Spelled;
  type: ScaleType;
  notes: Spelled[];
  pcs: number[];
  degrees: string[];
  /** Semitones above the root */
  semis: number[];
}

export function scale(root: Spelled, type: ScaleType): Scale {
  const iv = type.id === "chromatic" && usesFlats(root) ? CHROMATIC_FLAT : type.iv;
  const notes = iv.map((i) => transpose(root, i));
  return {
    root,
    type,
    notes,
    pcs: notes.map(pc),
    degrees: iv.map(degreeLabel),
    semis: iv.map((i) => i[1]),
  };
}

/* ---------- instruments and tunings ---------- */

export interface Tuning {
  id: string;
  name: string;
  /** MIDI note of each string, lowest-pitched (thickest) string first in playing order */
  strings: number[];
  /** Spell the string names with flats */
  flats?: boolean;
}

export interface Instrument {
  id: string;
  name: string;
  tunings: Tuning[];
}

export const INSTRUMENTS: Instrument[] = [
  { id: "chromatic", name: "Chromatic", tunings: [] },
  {
    id: "guitar",
    name: "Guitar",
    tunings: [
      { id: "standard", name: "Standard", strings: [40, 45, 50, 55, 59, 64] },
      { id: "drop-d", name: "Drop D", strings: [38, 45, 50, 55, 59, 64] },
      { id: "half-step-down", name: "Half-step down", strings: [39, 44, 49, 54, 58, 63], flats: true },
      { id: "open-g", name: "Open G", strings: [38, 43, 50, 55, 59, 62] },
      { id: "open-d", name: "Open D", strings: [38, 45, 50, 54, 57, 62] },
      { id: "dadgad", name: "DADGAD", strings: [38, 45, 50, 55, 57, 62] },
    ],
  },
  {
    id: "ukulele",
    name: "Ukulele",
    tunings: [
      { id: "standard", name: "Standard (GCEA)", strings: [67, 60, 64, 69] },
      { id: "low-g", name: "Low G", strings: [55, 60, 64, 69] },
      { id: "baritone", name: "Baritone (DGBE)", strings: [50, 55, 59, 64] },
    ],
  },
  {
    id: "bass",
    name: "Bass",
    tunings: [
      { id: "4-string", name: "4 strings (EADG)", strings: [28, 33, 38, 43] },
      { id: "5-string", name: "5 strings (BEADG)", strings: [23, 28, 33, 38, 43] },
    ],
  },
  { id: "violin", name: "Violin", tunings: [{ id: "standard", name: "Standard (GDAE)", strings: [55, 62, 69, 76] }] },
  { id: "viola", name: "Viola", tunings: [{ id: "standard", name: "Standard (CGDA)", strings: [48, 55, 62, 69] }] },
  { id: "cello", name: "Cello", tunings: [{ id: "standard", name: "Standard (CGDA)", strings: [36, 43, 50, 57] }] },
  { id: "mandolin", name: "Mandolin", tunings: [{ id: "standard", name: "Standard (GDAE)", strings: [55, 62, 69, 76] }] },
];

export const instrument = (id: string) => INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0]!;

/** The string closest to a frequency (in cents), or null when there are no strings */
export function nearestString(freq: number, strings: number[], a4 = 440) {
  let best = -1;
  let bestCents = Infinity;
  strings.forEach((m, i) => {
    const c = centsBetween(freq, freqOf(m, a4));
    if (Math.abs(c) < Math.abs(bestCents)) {
      bestCents = c;
      best = i;
    }
  });
  return best < 0 ? null : { index: best, cents: bestCents };
}

/* ---------- tempo ---------- */

/** Classical tempo marking for a BPM */
export function tempoName(bpm: number): string {
  if (bpm < 40) return "Grave";
  if (bpm < 60) return "Largo";
  if (bpm < 66) return "Larghetto";
  if (bpm < 76) return "Adagio";
  if (bpm < 108) return "Andante";
  if (bpm < 120) return "Moderato";
  if (bpm < 156) return "Allegro";
  if (bpm < 176) return "Vivace";
  if (bpm < 200) return "Presto";
  return "Prestissimo";
}
