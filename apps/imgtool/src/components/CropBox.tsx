import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { Crop } from "../lib/settings";

interface Props {
  url: string;
  alt: string;
  crop: Crop | null;
  /** Pixel aspect ratio (width / height) to keep, or null for free */
  ratio: number | null;
  srcW: number;
  srcH: number;
  onChange: (crop: Crop) => void;
  /** Explicit image size when zoomed */
  imgStyle?: CSSProperties;
}

type Mode = "move" | "nw" | "ne" | "sw" | "se";
const MIN = 0.05;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Draggable, resizable crop rectangle over the original image. Coordinates are fractions of the image. */
export default function CropBox({
  url,
  alt,
  crop,
  ratio,
  srcW,
  srcH,
  onChange,
  imgStyle,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: Mode; x: number; y: number; start: Crop } | null>(
    null,
  );
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  // Ratio in fraction space: (w * srcW) / (h * srcH) = ratio
  const rf = ratio ? (ratio * srcH) / srcW : null;

  function begin(e: PointerEvent, mode: Mode) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, start: c };
  }

  function move(e: PointerEvent) {
    const d = drag.current;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = (e.clientX - d.x) / rect.width;
    const dy = (e.clientY - d.y) / rect.height;
    const s = d.start;
    if (d.mode === "move") {
      onChange({
        ...s,
        x: clamp(s.x + dx, 0, 1 - s.w),
        y: clamp(s.y + dy, 0, 1 - s.h),
      });
      return;
    }
    const left = d.mode === "nw" || d.mode === "sw";
    const top = d.mode === "nw" || d.mode === "ne";
    // The corner opposite the handle stays put.
    const ax = left ? s.x + s.w : s.x;
    const ay = top ? s.y + s.h : s.y;
    const maxW = left ? ax : 1 - ax;
    const maxH = top ? ay : 1 - ay;
    let w = clamp(left ? s.w - dx : s.w + dx, MIN, maxW);
    let h = clamp(top ? s.h - dy : s.h + dy, MIN, maxH);
    if (rf) {
      h = w / rf;
      if (h > maxH) {
        h = maxH;
        w = h * rf;
      }
      if (h < MIN) {
        h = MIN;
        w = Math.min(h * rf, maxW);
      }
    }
    onChange({ x: left ? ax - w : ax, y: top ? ay - h : ay, w, h });
  }

  function end() {
    drag.current = null;
  }

  function onKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onChange({
      ...c,
      x: clamp(c.x + m[0], 0, 1 - c.w),
      y: clamp(c.y + m[1], 0, 1 - c.h),
    });
  }

  const pct = (v: number) => `${v * 100}%`;
  return (
    <div
      className="cropper"
      ref={wrapRef}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <img src={url} alt={alt} draggable={false} style={imgStyle} />
      <div
        className="crop-box"
        style={{
          left: pct(c.x),
          top: pct(c.y),
          width: pct(c.w),
          height: pct(c.h),
        }}
        onPointerDown={(e) => begin(e, "move")}
        tabIndex={0}
        role="slider"
        aria-label="Crop area. Drag to move, use the corners to resize, or arrow keys to nudge."
        aria-valuetext={`${Math.round(c.w * srcW)} × ${Math.round(c.h * srcH)} pixels`}
        onKeyDown={onKey}
      >
        {(["nw", "ne", "sw", "se"] as const).map((m) => (
          <span
            key={m}
            className={`crop-h ${m}`}
            onPointerDown={(e) => begin(e, m)}
            aria-hidden="true"
          />
        ))}
        <span className="crop-size" aria-hidden="true">
          {Math.round(c.w * srcW)} × {Math.round(c.h * srcH)}
        </span>
      </div>
    </div>
  );
}
