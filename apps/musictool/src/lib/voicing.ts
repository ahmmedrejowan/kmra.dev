/**
 * Chord fingerings, searched rather than looked up: for every position up the neck, try each
 * string muted, open or fretted on a chord tone within a four-fret span, keep the shapes a hand
 * can play (at most four fingers, a barre counts as one), and rank them: low and open first,
 * root in the bass, all chord tones present, as many strings ringing as possible.
 */
import { mod, type Chord } from "./theory";

export interface Voicing {
  /** Fret per string, lowest string first; −1 muted, 0 open */
  frets: number[];
  /** Lowest fret shown on the diagram (1 = at the nut) */
  base: number;
  /** A barre: fret and the string range it covers */
  barre: { fret: number; from: number; to: number } | null;
  /** Finger number per string (0 none) */
  fingers: number[];
  score: number;
}

export interface Fretted {
  id: "guitar" | "ukulele" | "bass";
  strings: number[];
  /** Root must be the lowest note */
  rootBass: boolean;
  /** Fewest strings that must sound */
  minStrings: number;
}

export const FRETTED: Record<Fretted["id"], Fretted> = {
  guitar: { id: "guitar", strings: [40, 45, 50, 55, 59, 64], rootBass: true, minStrings: 4 },
  ukulele: { id: "ukulele", strings: [67, 60, 64, 69], rootBass: false, minStrings: 4 },
  bass: { id: "bass", strings: [28, 33, 38, 43], rootBass: true, minStrings: 2 },
};

const SPAN = 4;
const MAX_FRET = 14;

/** "x32010" (frets above 9 in brackets) */
export const fretCode = (frets: number[]) =>
  frets.map((f) => (f < 0 ? "x" : f > 9 ? `(${f})` : String(f))).join("");

export function voicings(chord: Chord, inst: Fretted, limit = 8): Voicing[] {
  if (inst.id === "bass") return bassPatterns(chord, inst);
  const pcs = new Set(chord.pcs);
  const rootPc = chord.pcs[0]!;
  // With five-note chords on four strings, the fifth may go
  const fifthPc = chord.type.iv.find((iv) => iv[0] === 4)?.[1];
  const optional = fifthPc === 7 && chord.pcs.length >= 4 ? mod(rootPc + 7, 12) : -1;
  const need = [...pcs].filter((p) => p !== optional);

  const found = new Map<string, Voicing>();
  for (let lo = 0; lo <= MAX_FRET - SPAN + 1; lo++) {
    const options = inst.strings.map((open, s) => {
      const opts: number[] = [];
      if (inst.rootBass && s < 2) opts.push(-1);
      if (pcs.has(mod(open, 12))) opts.push(0);
      for (let f = Math.max(1, lo); f < lo + SPAN; f++) if (pcs.has(mod(open + f, 12))) opts.push(f);
      return opts;
    });
    const pick: number[] = [];
    const walk = (s: number) => {
      if (s === inst.strings.length) {
        const v = judge(pick, inst, chord, need, rootPc);
        if (v) {
          const k = pick.join(",");
          const had = found.get(k);
          if (!had || had.score < v.score) found.set(k, v);
        }
        return;
      }
      for (const f of options[s]!) {
        // Muted strings only below the first sounding one
        if (f < 0 && s > 0 && pick[s - 1]! >= 0) continue;
        pick[s] = f;
        walk(s + 1);
      }
    };
    walk(0);
  }
  return [...found.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

function judge(frets: number[], inst: Fretted, chord: Chord, need: number[], rootPc: number): Voicing | null {
  const sounding = frets.map((f, s) => (f < 0 ? null : inst.strings[s]! + f));
  const notes = sounding.filter((n): n is number => n !== null);
  if (notes.length < inst.minStrings) return null;
  const have = new Set(notes.map((n) => mod(n, 12)));
  for (const p of need) if (!have.has(p)) return null;
  const lowest = Math.min(...notes);
  if (inst.rootBass && mod(lowest, 12) !== rootPc) return null;

  const fretted = frets.filter((f) => f > 0);
  const min = fretted.length ? Math.min(...fretted) : 0;
  const max = fretted.length ? Math.max(...fretted) : 0;
  if (max - min >= SPAN) return null;

  // Fingers: a barre on the lowest fret covers every string from its first to last use, if no
  // string between them is open or muted (and the barre is on the lowest fret)
  let barre: Voicing["barre"] = null;
  const atMin = frets.map((f, s) => (f === min ? s : -1)).filter((s) => s >= 0);
  if (min > 0 && atMin.length >= 2) {
    const from = atMin[0]!;
    const to = atMin[atMin.length - 1]!;
    let ok = true;
    for (let s = from; s <= to; s++) if (frets[s]! < min) ok = false;
    if (ok) barre = { fret: min, from, to };
  }
  const others = frets.filter((f, s) => f > 0 && !(barre && f === barre.fret && s >= barre.from && s <= barre.to));
  const fingerCount = others.length + (barre ? 1 : 0);
  if (fingerCount > 4) return null;
  if (!barre && fretted.length > 4) return null;
  // Prefer no barre when four fingers do the job
  if (barre && fretted.length <= 4 && atMin.length < 3) barre = null;

  const fingers = assignFingers(frets, barre, min);
  if (!fingers) return null;

  const opens = frets.filter((f) => f === 0).length;
  const muted = frets.filter((f) => f < 0).length;
  const distinct = have.size;
  let score = 100;
  score -= min * 3.2 + (max > 4 ? 4 : 0);
  score += opens * 2.2;
  score -= muted * 2.5;
  score -= (max - min) * 1.5;
  score -= fingerCount * 1.2;
  score += distinct === chord.pcs.length ? 6 : 0;
  if (barre) score -= 3;
  // The root on top-ish/bass helps ukulele shapes too
  if (!inst.rootBass && mod(sounding[0] ?? 0, 12) === rootPc) score += 0.5;
  // Doubled thirds sound muddy; fine, but slightly less preferred
  const base = max <= 4 ? 1 : min;
  return { frets: [...frets], base, barre, fingers, score };
}

/** Finger numbers: 1 for the barre/lowest fret, then by fret and string, at most 4 */
function assignFingers(frets: number[], barre: Voicing["barre"], min: number): number[] | null {
  const fingers = frets.map(() => 0);
  const rest: [number, number][] = [];
  frets.forEach((f, s) => {
    if (f <= 0) return;
    if (barre && f === barre.fret && s >= barre.from && s <= barre.to) fingers[s] = 1;
    else rest.push([f, s]);
  });
  rest.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let next = barre ? 2 : 1;
  for (const [f, s] of rest) {
    // Fingers follow the frets: the finger for fret min+k is at least k+1
    next = Math.max(next, Math.min(4, f - min + 1));
    if (next > 4) return null;
    fingers[s] = next;
    next++;
  }
  return fingers;
}

/** Bass: root, fifth and octave shapes (with the third or seventh when it fits), up the neck */
function bassPatterns(chord: Chord, inst: Fretted): Voicing[] {
  const rootPc = chord.pcs[0]!;
  const out: Voicing[] = [];
  const fifth = chord.type.iv.find((iv) => iv[0] === 4)?.[1];
  const third = chord.type.iv.find((iv) => iv[0] === 2 || iv[0] === 1 || iv[0] === 3)?.[1];
  for (let s = 0; s < 2; s++) {
    const open = inst.strings[s]!;
    for (const r of [mod(rootPc - open, 12), mod(rootPc - open, 12) + 12]) {
      if (r > 12) continue;
      const frets = inst.strings.map(() => -1);
      frets[s] = r;
      // Fifth on the next string, two frets up (a fourth above the string = 5 semitones)
      const iv2 = fifth ?? third;
      if (iv2 !== undefined && s + 1 < inst.strings.length) {
        const f = r + iv2 - 5;
        if (f >= 0) frets[s + 1] = f;
      }
      // Octave two strings up, two frets up
      if (s + 2 < inst.strings.length && r + 2 >= 0) frets[s + 2] = r + 2;
      const fretted = frets.filter((f) => f > 0);
      if (!fretted.length && frets.every((f) => f <= 0) && r !== 0) continue;
      const min = fretted.length ? Math.min(...fretted) : 0;
      const max = fretted.length ? Math.max(...fretted) : 0;
      if (max - min >= SPAN) continue;
      const fingers = assignFingers(frets, null, min) ?? frets.map(() => 0);
      out.push({
        frets,
        base: max <= 4 ? 1 : min,
        barre: null,
        fingers,
        score: 100 - r * 2 - s,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
