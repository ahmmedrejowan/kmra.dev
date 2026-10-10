import { useT } from "@kmra/ui/lib/i18n-react";
import { mod } from "../lib/theory";

export interface Mark {
  /** Pitch class */
  pc: number;
  label: string;
  root: boolean;
}

const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

/**
 * A fretboard, nut on the left, highest string on top (as in tab). Marked pitch classes get a dot
 * on every fret where they fall; the root is filled with the accent colour.
 */
export function Fretboard({
  strings,
  frets,
  marks,
  active,
  title,
}: {
  /** MIDI of each open string, lowest string first */
  strings: number[];
  frets: number;
  marks: Mark[];
  /** A MIDI note being played (lit up wherever it can be played) */
  active?: number | null;
  title: string;
}) {
  const byPc = new Map(marks.map((m) => [m.pc, m]));
  const fw = 58;
  const left = 40;
  const top = 24;
  const sg = 34;
  const n = strings.length;
  const w = left + frets * fw + 16;
  const h = top + (n - 1) * sg + 40;
  const fx = (f: number) => left + f * fw;
  // Highest string on top
  const sy = (s: number) => top + (n - 1 - s) * sg;
  const cx = (f: number) => (f === 0 ? left - 18 : fx(f) - fw / 2);
  const dots = [];
  for (let s = 0; s < n; s++)
    for (let f = 0; f <= frets; f++) {
      const midi = strings[s]! + f;
      const m = byPc.get(mod(midi, 12));
      if (!m) continue;
      const on = active === midi;
      dots.push(
        <g
          key={`${s}-${f}`}
          className={`mt-fb-dot${m.root ? " root" : ""}${on ? " on" : ""}`}
          data-string={s}
          data-fret={f}
        >
          <circle cx={cx(f)} cy={sy(s)} r={13} />
          <text x={cx(f)} y={sy(s) + 4.5} textAnchor="middle">
            {m.label}
          </text>
        </g>,
      );
    }
  return (
    <svg className="mt-fretboard" viewBox={`0 0 ${w} ${h}`} width={w} role="img" aria-label={title}>
      <rect className="mt-fb-wood" x={left} y={top - 14} width={frets * fw} height={(n - 1) * sg + 28} rx={4} />
      {INLAYS.filter((f) => f <= frets).map((f) => (
        <circle key={f} className="mt-fb-inlay" cx={fx(f) - fw / 2} cy={top + ((n - 1) * sg) / 2} r={5} />
      ))}
      {[12, 24]
        .filter((f) => f <= frets)
        .map((f) => (
          <g key={f}>
            <circle className="mt-fb-inlay" cx={fx(f) - fw / 2} cy={top + ((n - 1) * sg) / 2 - sg} r={5} />
            <circle className="mt-fb-inlay" cx={fx(f) - fw / 2} cy={top + ((n - 1) * sg) / 2 + sg} r={5} />
          </g>
        ))}
      {Array.from({ length: frets + 1 }, (_, f) => (
        <line
          key={f}
          className={f === 0 ? "mt-fb-nut" : "mt-fb-fret"}
          x1={fx(f)}
          x2={fx(f)}
          y1={top - 14}
          y2={top + (n - 1) * sg + 14}
        />
      ))}
      {strings.map((_, s) => (
        <line key={s} className="mt-fb-string" x1={left} x2={fx(frets)} y1={sy(s)} y2={sy(s)} style={{ strokeWidth: 1 + (n - 1 - s) * 0.35 }} />
      ))}
      {[...INLAYS, 12, 24]
        .filter((f) => f <= frets)
        .map((f) => (
          <text key={f} className="mt-fb-num" x={fx(f) - fw / 2} y={h - 6} textAnchor="middle">
            {f}
          </text>
        ))}
      {dots}
    </svg>
  );
}

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK = [1, 3, 6, 8, 10];

/** Two octaves of piano keys from C; marked keys show their label, the root in the accent colour. */
export function Piano({
  marks,
  from = 48,
  octaves = 2,
  active,
  inScale,
}: {
  marks: Mark[];
  from?: number;
  octaves?: number;
  active?: number | null;
  /** Only these MIDI notes are marked (e.g. one run of the scale); default every octave */
  inScale?: number[];
}) {
  const T = useT();
  const byPc = new Map(marks.map((m) => [m.pc, m]));
  const ww = 40;
  const wh = 150;
  const bw = 26;
  const bh = 94;
  const whites: number[] = [];
  for (let o = 0; o < octaves; o++) for (const p of WHITE) whites.push(from + o * 12 + p);
  whites.push(from + octaves * 12);
  const marked = (m: number) => (inScale ? inScale.includes(m) : byPc.has(mod(m, 12)));
  const w = whites.length * ww;
  const key = (m: number, x: number, black: boolean) => {
    const mk = marked(m) ? byPc.get(mod(m, 12)) : undefined;
    return (
      <g key={m} className={`mt-key ${black ? "black" : "white"}${mk ? " in" : ""}${mk?.root ? " root" : ""}${active === m ? " on" : ""}`} data-midi={m}>
        <rect x={x} y={0} width={black ? bw : ww} height={black ? bh : wh} rx={black ? 3 : 5} />
        {mk && (
          <text x={x + (black ? bw : ww) / 2} y={(black ? bh : wh) - 12} textAnchor="middle">
            {mk.label}
          </text>
        )}
      </g>
    );
  };
  return (
    <svg className="mt-piano" viewBox={`-1 -1 ${w + 2} ${wh + 2}`} role="img" aria-label={T("Piano keyboard")}>
      {whites.map((m, i) => key(m, i * ww, false))}
      {whites.flatMap((m, i) => {
        const b = m + 1;
        return BLACK.includes(mod(b, 12)) && i < whites.length - 1 ? [key(b, (i + 1) * ww - bw / 2, true)] : [];
      })}
    </svg>
  );
}
