import { useT } from "@kmra/ui/lib/i18n-react";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Crop } from "../lib/settings";

interface Props {
  url: string;
  alt: string;
  regions: Crop[];
  ellipse: boolean;
  onChange: (regions: Crop[]) => void;
  imgStyle?: CSSProperties;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * Draw boxes over the image to blur or hide them. Drag on empty space to add a box, drag a box to
 * move it, and use × to remove it. Coordinates are fractions of the image.
 */
export default function RegionBox({
  url,
  alt,
  regions,
  ellipse,
  onChange,
  imgStyle,
}: Props) {
  const T = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<
    | { kind: "new"; x: number; y: number }
    | { kind: "move"; i: number; x: number; y: number; start: Crop }
    | null
  >(null);
  const [draft, setDraftState] = useState<Crop | null>(null);
  // Mirrored in a ref: a quick drag can end before React re-renders with the latest box.
  const draftRef = useRef<Crop | null>(null);
  const setDraft = (d: Crop | null) => {
    draftRef.current = d;
    setDraftState(d);
  };

  function point(e: PointerEvent): [number, number] {
    const r = wrapRef.current!.getBoundingClientRect();
    return [
      clamp((e.clientX - r.left) / r.width, 0, 1),
      clamp((e.clientY - r.top) / r.height, 0, 1),
    ];
  }

  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    wrapRef.current?.setPointerCapture(e.pointerId);
    const [x, y] = point(e);
    drag.current = { kind: "new", x, y };
    setDraft({ x, y, w: 0, h: 0 });
  }

  function grab(e: PointerEvent, i: number) {
    e.preventDefault();
    e.stopPropagation();
    wrapRef.current?.setPointerCapture(e.pointerId);
    const [x, y] = point(e);
    drag.current = { kind: "move", i, x, y, start: regions[i]! };
  }

  function move(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const [x, y] = point(e);
    if (d.kind === "new")
      setDraft({
        x: Math.min(d.x, x),
        y: Math.min(d.y, y),
        w: Math.abs(x - d.x),
        h: Math.abs(y - d.y),
      });
    else {
      const s = d.start;
      const next = regions.slice();
      next[d.i] = {
        ...s,
        x: clamp(s.x + x - d.x, 0, 1 - s.w),
        y: clamp(s.y + y - d.y, 0, 1 - s.h),
      };
      onChange(next);
    }
  }

  function up(e: PointerEvent) {
    const d = drag.current;
    if (d?.kind === "new") move(e);
    drag.current = null;
    const box = draftRef.current;
    if (d?.kind === "new" && box && box.w > 0.01 && box.h > 0.01)
      onChange([...regions, box]);
    setDraft(null);
  }

  const pct = (v: number) => `${v * 100}%`;
  const box = (c: Crop): CSSProperties => ({
    left: pct(c.x),
    top: pct(c.y),
    width: pct(c.w),
    height: pct(c.h),
    borderRadius: ellipse ? "50%" : 4,
  });

  return (
    <div
      className="cropper regions"
      ref={wrapRef}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <img src={url} alt={alt} draggable={false} style={imgStyle} />
      {regions.map((r, i) => (
        <div
          key={i}
          className="region"
          style={box(r)}
          onPointerDown={(e) => grab(e, i)}
        >
          <button
            type="button"
            className="region-x"
            aria-label={T("Remove area {n}", { n: i + 1 })}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onChange(regions.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      {draft && <div className="region draft" style={box(draft)} />}
    </div>
  );
}
