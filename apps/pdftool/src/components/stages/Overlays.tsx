import { useMemo } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { NumberOpts, PageRef, WatermarkOpts } from "../../lib/ops";
import { Sheet } from "../Thumb";
import type { Doc } from "./common";

/* ---------- Page numbers: drawn live where they land ---------- */

/** The same text pageNumbers() writes */
function numberText(o: NumberOpts, i: number, count: number) {
  if (o.skipFirst && i === 0) return null;
  const counted = o.skipFirst ? count - 1 : count;
  const n = o.start + (o.skipFirst ? i - 1 : i);
  const total = o.start + counted - 1;
  return o.format === "n"
    ? `${n}`
    : o.format === "page-n"
      ? `Page ${n}`
      : o.format === "n-of"
        ? `${n} / ${total}`
        : `Page ${n} of ${total}`;
}

function NumberMark({
  o,
  text,
  vw,
  vh,
}: {
  o: NumberOpts;
  text: string;
  vw: number;
  vh: number;
}) {
  const th = o.size * 0.72;
  const col = o.pos[1];
  const x = col === "l" ? o.margin : col === "r" ? vw - o.margin : vw / 2;
  const y = o.pos[0] === "t" ? o.margin + th / 2 : vh - o.margin - th / 2;
  return (
    <svg className="sheet-over" viewBox={`0 0 ${vw} ${vh}`} aria-hidden="true">
      <text
        className="num-mark"
        x={x}
        y={y}
        fontSize={o.size}
        fontFamily="Helvetica, Arial, sans-serif"
        fill="#333"
        textAnchor={col === "l" ? "start" : col === "r" ? "end" : "middle"}
        dominantBaseline="central"
      >
        {text}
      </text>
    </svg>
  );
}

export function NumbersView({
  doc,
  refs,
  o,
}: {
  doc: Doc;
  refs: readonly PageRef[];
  o: NumberOpts;
}) {
  const T = useT();
  const shown = refs.slice(0, 2);
  return (
    <div className="overlay-view">
      {shown.map((p, i) => {
        const text = numberText(o, i, refs.length);
        return (
          <figure key={p.id} className={i === 0 ? "big" : "small"}>
            <Sheet
              fileKey={doc.key}
              doc={doc.pdf}
              index={p.index}
              rotate={p.rotate}
              width={i === 0 ? 480 : 240}
              alt={T("Page {n}", { n: p.index + 1 })}
            >
              {({ vw, vh }) =>
                text && <NumberMark o={o} text={text} vw={vw} vh={vh} />
              }
            </Sheet>
            <figcaption>
              {T("Page {n}", { n: p.index + 1 })}
              {!text && <>, {T("no number (cover)")}</>}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/* ---------- Watermark: drawn live on the first page ---------- */

const WM_FONT =
  "600 160px system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif";

/** Width / height of the watermark's text picture, as textPng() draws it */
function textRatio(text: string) {
  const x = document.createElement("canvas").getContext("2d");
  if (!x) return text.length * 0.6;
  x.font = WM_FONT;
  const lines = text.split("\n");
  const w = Math.max(...lines.map((l) => x.measureText(l).width)) + 4;
  return w / (200 * lines.length);
}

function WatermarkMark({
  o,
  vw,
  vh,
}: {
  o: WatermarkOpts;
  vw: number;
  vh: number;
}) {
  const ratio = useMemo(() => textRatio(o.text), [o.text]);
  const h = (Math.min(vw, vh) * o.size) / 100;
  const w = h * ratio;
  const spots: [number, number][] = [];
  if (o.tile) {
    // Same grid as watermark() in ops.ts, measured from the bottom-left corner
    const stepX = w * 1.6;
    const stepY = h * 4;
    for (let y = -vh; y < vh * 2; y += stepY)
      for (let x = -vw; x < vw * 2; x += stepX) spots.push([x, vh - y]);
  } else spots.push([vw / 2, vh / 2]);
  return (
    <svg className="sheet-over" viewBox={`0 0 ${vw} ${vh}`} aria-hidden="true">
      <g
        fill={o.color}
        opacity={o.opacity / 100}
        fontSize={h / 1.25}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {spots.map(([x, y], i) => (
          <text key={i} x={x} y={y} transform={`rotate(${-o.angle} ${x} ${y})`}>
            {o.text}
          </text>
        ))}
      </g>
    </svg>
  );
}

export function WatermarkView({
  doc,
  first,
  o,
}: {
  doc: Doc;
  first: PageRef | undefined;
  o: WatermarkOpts;
}) {
  const T = useT();
  if (!first) return null;
  return (
    <div className="overlay-view">
      <figure className="big">
        <Sheet
          fileKey={doc.key}
          doc={doc.pdf}
          index={first.index}
          rotate={first.rotate}
          width={480}
          alt={T("Page {n}", { n: first.index + 1 })}
        >
          {({ vw, vh }) =>
            o.text.trim() && <WatermarkMark o={o} vw={vw} vh={vh} />
          }
        </Sheet>
        <figcaption>{T("Every page gets the same watermark.")}</figcaption>
      </figure>
    </div>
  );
}
