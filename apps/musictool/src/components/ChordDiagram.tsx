import { useT } from "@kmra/ui/lib/i18n-react";
import type { Voicing } from "../lib/voicing";
import { fretCode } from "../lib/voicing";

/**
 * A chord box: strings run top to bottom, frets left to right as on a chord chart; X and O above
 * the nut for muted and open strings, finger numbers in the dots, a bar for a barre.
 */
export function ChordDiagram({
  v,
  strings,
  labels,
  title,
}: {
  v: Voicing;
  /** Names under each string (the note it plays) */
  strings: number;
  labels?: string[];
  title: string;
}) {
  const T = useT();
  const frets = 5;
  const w = 56 + (strings - 1) * 40;
  const left = 28;
  const top = 46;
  const gap = 40;
  const fretH = 44;
  const x = (s: number) => left + s * gap;
  const y = (f: number) => top + f * fretH;
  const pos = (f: number) => f - v.base + 1; // row 1 … frets
  const h = top + frets * fretH + (labels ? 40 : 14);
  return (
    <svg
      className="mt-chord-svg"
      viewBox={`0 0 ${w + 24} ${h}`}
      role="img"
      aria-label={`${title}: ${v.frets.map((f) => (f < 0 ? "x" : f)).join(" ")}`}
      data-frets={fretCode(v.frets)}
    >
      {v.base > 1 ? (
        <text
          className="mt-chord-base"
          x={x(strings - 1) + 16}
          y={y(0) + fretH * 0.62}
        >
          {T("{n}fr", { n: v.base })}
        </text>
      ) : null}
      {/* nut or top fret */}
      <line
        className={v.base === 1 ? "mt-chord-nut" : "mt-chord-fret"}
        x1={x(0)}
        x2={x(strings - 1)}
        y1={y(0)}
        y2={y(0)}
      />
      {Array.from({ length: frets }, (_, i) => (
        <line
          key={i}
          className="mt-chord-fret"
          x1={x(0)}
          x2={x(strings - 1)}
          y1={y(i + 1)}
          y2={y(i + 1)}
        />
      ))}
      {Array.from({ length: strings }, (_, s) => (
        <line
          key={s}
          className="mt-chord-string"
          x1={x(s)}
          x2={x(s)}
          y1={y(0)}
          y2={y(frets)}
        />
      ))}
      {v.frets.map((f, s) =>
        f <= 0 ? (
          <text
            key={s}
            className={`mt-chord-top ${f < 0 ? "x" : "o"}`}
            x={x(s)}
            y={top - 14}
            textAnchor="middle"
          >
            {f < 0 ? "×" : "○"}
          </text>
        ) : null,
      )}
      {v.barre && (
        <rect
          className="mt-chord-barre"
          x={x(v.barre.from) - 15}
          y={y(pos(v.barre.fret) - 1) + fretH / 2 - 15}
          width={x(v.barre.to) - x(v.barre.from) + 30}
          height={30}
          rx={15}
        />
      )}
      {v.frets.map((f, s) =>
        f > 0 &&
        !(
          v.barre &&
          f === v.barre.fret &&
          s >= v.barre.from &&
          s <= v.barre.to &&
          s !== v.barre.from
        ) ? (
          <g key={s} className="mt-chord-dot">
            <circle cx={x(s)} cy={y(pos(f) - 1) + fretH / 2} r={15} />
            {v.fingers[s] ? (
              <text
                x={x(s)}
                y={y(pos(f) - 1) + fretH / 2 + 5.5}
                textAnchor="middle"
              >
                {v.fingers[s]}
              </text>
            ) : null}
          </g>
        ) : null,
      )}
      {labels?.map((l, s) => (
        <text
          key={s}
          className="mt-chord-name"
          x={x(s)}
          y={y(frets) + 28}
          textAnchor="middle"
        >
          {l}
        </text>
      ))}
    </svg>
  );
}
