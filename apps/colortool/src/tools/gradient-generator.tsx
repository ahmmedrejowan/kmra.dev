import { useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { Seg, Slider } from "@kmra/ui/components/controls";
import type { ToolProps } from ".";
import {
  col,
  css,
  fit,
  mix,
  toHex,
  type HueMethod,
  type Rgba,
  type Space,
} from "../lib/color";
import { CodeOut, ColorField, downloadCanvas } from "../lib/ui";

type Kind = "linear" | "radial" | "conic";
type Interp = "srgb" | Space;
interface Stop {
  id: number;
  color: Rgba;
  pos: number;
}

const SPOTS: [number, number][] = [
  [0, 0], [50, 0], [100, 0],
  [0, 50], [50, 50], [100, 50],
  [0, 100], [50, 100], [100, 100],
];
const SIZES: [string, number, number][] = [
  ["1920 × 1080", 1920, 1080],
  ["2560 × 1440", 2560, 1440],
  ["1080 × 1080", 1080, 1080],
  ["1080 × 1920", 1080, 1920],
  ["1200 × 630", 1200, 630],
];

let uid = 10;

export default function GradientGenerator({ preset }: ToolProps) {
  const T = useT();
  const [kind, setKind] = useState<Kind>(
    preset?.type === "radial" || preset?.type === "conic" ? preset.type : "linear",
  );
  const [stops, setStops] = useState<Stop[]>([
    { id: 1, color: col("#ff7a59"), pos: 0 },
    { id: 2, color: col("#ffd166"), pos: 50 },
    { id: 3, color: col("#5b8cff"), pos: 100 },
  ]);
  const [sel, setSel] = useState(1);
  const [angle, setAngle] = useState(135);
  const [space, setSpace] = useState<Interp>("oklch");
  const [hue, setHue] = useState<HueMethod>("shorter");
  const [shape, setShape] = useState<"circle" | "ellipse">("circle");
  const [at, setAt] = useState<[number, number]>([50, 50]);
  const [size, setSize] = useState(0);
  const bar = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const sorted = [...stops].sort((a, b) => a.pos - b.pos);
  const current = stops.find((s) => s.id === sel) ?? stops[0]!;
  const polar = space === "oklch" || space === "hsl";

  const method =
    space === "srgb" ? "" : `in ${space}${polar && hue === "longer" ? " longer hue" : ""}`;
  const list = sorted.map((s) => `${hexOf(s.color)} ${round(s.pos)}%`).join(", ");
  const pos = `at ${at[0]}% ${at[1]}%`;
  const head =
    kind === "linear"
      ? [method, `${angle}deg`]
      : kind === "radial"
        ? [method, `${shape} ${pos}`]
        : [method, `from ${angle}deg ${pos}`];
  const value = `${kind}-gradient(${head.filter(Boolean).join(" ")}, ${list})`;
  // Older browsers skip the line they can't read and keep the plain sRGB one
  const plainHead = head.slice(1).join(" ");
  const fallback = `${kind}-gradient(${plainHead}, ${list})`;
  const code =
    space === "srgb"
      ? `background: ${value};`
      : `background: ${fallback};\nbackground: ${value};`;
  const barCss = `linear-gradient(${method ? `${method} ` : ""}90deg, ${list})`;

  function update(id: number, patch: Partial<Stop>) {
    setStops((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  /** Colour of the gradient at t (0–1), mixed the same way the browser does */
  function colorAt(t: number): Rgba {
    const p = t * 100;
    if (p <= sorted[0]!.pos) return sorted[0]!.color;
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]!;
      const b = sorted[i]!;
      if (p <= b.pos) {
        const k = b.pos === a.pos ? 1 : (p - a.pos) / (b.pos - a.pos);
        return fit(mix(a.color, b.color, k, space === "srgb" ? "srgb" : space, hue));
      }
    }
    return sorted[sorted.length - 1]!.color;
  }

  function pctAt(e: { clientX: number }) {
    const r = bar.current!.getBoundingClientRect();
    return Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
  }

  function addAt(p: number) {
    const id = uid++;
    setStops((s) => [...s, { id, color: colorAt(p / 100), pos: Math.round(p) }]);
    setSel(id);
  }

  function remove(id: number) {
    if (stops.length <= 2) return;
    const rest = stops.filter((s) => s.id !== id);
    setStops(rest);
    setSel(rest[0]!.id);
  }

  function drag(e: RPointerEvent<HTMLButtonElement>, id: number) {
    e.stopPropagation();
    setSel(id);
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => update(id, { pos: Math.round(pctAt(ev) * 10) / 10 });
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  async function png() {
    const [, W, H] = SIZES[size]!;
    const c = canvas.current!;
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    const N = 256;
    const fill = (gr: CanvasGradient) => {
      for (let i = 0; i <= N; i++) gr.addColorStop(i / N, css(colorAt(i / N)));
      return gr;
    };
    const cx = (at[0] / 100) * W;
    const cy = (at[1] / 100) * H;
    if (kind === "linear") {
      const a = (angle * Math.PI) / 180;
      const len = Math.abs(W * Math.sin(a)) + Math.abs(H * Math.cos(a));
      const dx = (Math.sin(a) * len) / 2;
      const dy = (-Math.cos(a) * len) / 2;
      g.fillStyle = fill(g.createLinearGradient(W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy));
      g.fillRect(0, 0, W, H);
    } else if (kind === "conic") {
      g.fillStyle = fill(g.createConicGradient(((angle - 90) * Math.PI) / 180, cx, cy));
      g.fillRect(0, 0, W, H);
    } else {
      // farthest-corner, as CSS does by default
      const corners = [[0, 0], [W, 0], [0, H], [W, H]] as const;
      const far = corners.reduce((m, [x, y]) =>
        Math.hypot(x - cx, y - cy) > Math.hypot(m[0] - cx, m[1] - cy) ? [x, y] : m,
      );
      let rx: number;
      let ry: number;
      if (shape === "circle") rx = ry = Math.hypot(far[0] - cx, far[1] - cy);
      else {
        const sx = Math.min(cx, W - cx) || W / 2;
        const sy = Math.min(cy, H - cy) || H / 2;
        const k = Math.hypot((far[0] - cx) / sx, (far[1] - cy) / sy);
        rx = sx * k;
        ry = sy * k;
      }
      g.save();
      g.translate(cx, cy);
      g.scale(1, ry / rx);
      g.fillStyle = fill(g.createRadialGradient(0, 0, 0, 0, 0, rx));
      g.fillRect(-cx, (-cy * rx) / ry, W, (H * rx) / ry);
      g.restore();
    }
    await downloadCanvas(c, `gradient-${W}x${H}.png`);
  }

  const spaces: [Interp, string][] = [
    ["oklch", "OKLCH"],
    ["oklab", "OKLab"],
    ["srgb", "sRGB"],
    ["srgb-linear", T("Linear")],
  ];

  return (
    <div className="ct-card side-first">
      <div className="ct-side">
        <Seg
          label={T("Type")}
          options={[
            ["linear", T("Linear")],
            ["radial", T("Radial")],
            ["conic", T("Conic")],
          ]}
          value={kind}
          onPick={setKind}
        />
        {kind !== "radial" && (
          <div className="ct-angle">
            <Slider
              label={kind === "linear" ? T("Angle") : T("Start angle")}
              value={angle}
              min={0}
              max={360}
              unit="°"
              reset={kind === "linear" ? 180 : 0}
              onChange={setAngle}
            />
            <div className="ct-dial" aria-hidden="true">
              <i style={{ transform: `rotate(${angle}deg)` }} />
            </div>
          </div>
        )}
        {kind === "radial" && (
          <Seg
            label={T("Shape")}
            options={[
              ["circle", T("Circle")],
              ["ellipse", T("Ellipse")],
            ]}
            value={shape}
            onPick={setShape}
          />
        )}
        {kind !== "linear" && (
          <div className="ct-group">
            <span className="ct-glabel">
              <span>{T("Centre")}</span>
            </span>
            <div className="spots" role="group" aria-label={T("Centre")}>
              {SPOTS.map(([x, y]) => (
                <button
                  key={`${x}-${y}`}
                  type="button"
                  aria-label={`${x}% ${y}%`}
                  aria-pressed={at[0] === x && at[1] === y}
                  onClick={() => setAt([x, y])}
                />
              ))}
            </div>
          </div>
        )}
        <Seg label={T("Mix in")} options={spaces} value={space} onPick={setSpace} />
        {polar && (
          <Seg
            label={T("Hue")}
            options={[
              ["shorter", T("Shorter way")],
              ["longer", T("Rainbow")],
            ]}
            value={hue}
            onPick={setHue}
          />
        )}
        <p className="ct-hint">
          {space === "srgb"
            ? T("sRGB is the browser default. Some pairs turn grey in the middle.")
            : T("Mixing in {space} keeps the middle bright. Browsers from 2023 on read it; older ones use the plain line.", {
                space: spaces.find((s) => s[0] === space)![1],
              })}
        </p>
      </div>

      <div className="ct-main">
        <div
          className="ct-grad checker"
          data-css={value}
          style={{ "--g": value } as CSSProperties}
        />

        <div className="ct-stops-wrap">
          <div
            ref={bar}
            className="ct-bar checker"
            style={{ "--g": barCss } as CSSProperties}
            onPointerDown={(e) => addAt(pctAt(e))}
            title={T("Click to add a stop")}
          >
            {stops.map((s) => (
              <button
                key={s.id}
                type="button"
                className="ct-handle"
                data-pos={s.pos}
                aria-pressed={s.id === current.id}
                aria-label={T("Stop {hex} at {pos}%", { hex: hexOf(s.color), pos: round(s.pos) })}
                style={{ left: `${s.pos}%`, "--c": css(s.color) } as CSSProperties}
                onPointerDown={(e) => drag(e, s.id)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  const d = e.shiftKey ? 10 : 1;
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    e.preventDefault();
                    const p = s.pos + (e.key === "ArrowLeft" ? -d : d);
                    update(s.id, { pos: Math.min(100, Math.max(0, p)) });
                  } else if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault();
                    remove(s.id);
                  }
                }}
              />
            ))}
          </div>
          <p className="ct-cap">
            {T("Click the bar to add a stop, drag stops to move them. Arrow keys move the chosen stop.")}
          </p>
        </div>

        <div className="ct-stopedit">
          <ColorField
            label={T("Stop colour")}
            value={current.color}
            onChange={(c) => update(current.id, { color: c })}
          />
          <label className="ct-inline col ct-posfield">
            <span>{T("Position")}</span>
            <input
              className="num"
              type="number"
              min={0}
              max={100}
              step={1}
              value={round(current.pos)}
              onChange={(e) =>
                update(current.id, {
                  pos: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                })
              }
            />
          </label>
          <button
            type="button"
            className="btn sm ct-remove"
            disabled={stops.length <= 2}
            onClick={() => remove(current.id)}
          >
            <Icon name="trash" />
            {T("Remove stop")}
          </button>
        </div>

        <CodeOut code={code} label="CSS" />
        <div className="ct-actions">
          <label className="ct-inline">
            <span>{T("Image size")}</span>
            <select
              className="num"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            >
              {SIZES.map(([l], i) => (
                <option key={l} value={i}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn sm ct-png" onClick={() => void png()}>
            <Icon name="download" />
            {T("Download PNG")}
          </button>
        </div>
        <canvas ref={canvas} hidden />
      </div>
    </div>
  );
}

function hexOf(c: Rgba) {
  return toHex(c);
}
function round(v: number) {
  return Math.round(v * 10) / 10;
}
