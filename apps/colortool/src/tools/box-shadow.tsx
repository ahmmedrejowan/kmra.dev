import { useState, type CSSProperties } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { Seg, Slider, Toggle } from "@kmra/ui/components/controls";
import type { ToolProps } from ".";
import { col, toHex, toRgbString, withAlpha, type Rgba } from "../lib/color";
import { CodeOut, ColorField } from "../lib/ui";

interface Layer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: Rgba;
  inset: boolean;
}

const ink = (a: number) => withAlpha(col("#0f172a"), a);
const L = (x: number, y: number, blur: number, spread: number, a: number, inset = false): Layer => ({
  x,
  y,
  blur,
  spread,
  color: ink(a),
  inset,
});

const PRESETS: Record<string, Layer[]> = {
  Soft: [L(0, 1, 2, 0, 0.06), L(0, 4, 8, -2, 0.08), L(0, 12, 24, -6, 0.1)],
  Lifted: [L(0, 2, 4, 0, 0.06), L(0, 10, 20, -4, 0.12), L(0, 30, 60, -12, 0.25)],
  Sharp: [L(4, 4, 0, 0, 1)],
  Floating: [L(0, 24, 48, -12, 0.25), L(0, 4, 8, -2, 0.05)],
  Inner: [L(0, 2, 6, 0, 0.18, true)],
  Outline: [L(0, 0, 0, 1, 0.12), L(0, 1, 3, 0, 0.1)],
};

const fmt = (l: Layer) =>
  `${l.inset ? "inset " : ""}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${
    l.color.a < 1 ? toRgbString(l.color) : toHex(l.color)
  }`;

export default function BoxShadow(_: ToolProps) {
  const T = useT();
  const [layers, setLayers] = useState<Layer[]>(PRESETS.Soft!);
  const [sel, setSel] = useState(0);
  const [dark, setDark] = useState(false);
  const [radius, setRadius] = useState(16);
  const [preset, setPreset] = useState("Soft");

  const cur = layers[Math.min(sel, layers.length - 1)]!;
  const shadow = layers.map(fmt).join(",\n    ");
  const value = layers.map(fmt).join(", ");
  const code = `box-shadow:\n    ${shadow};`;
  const tw = `shadow-[${layers.map(fmt).join(",").replace(/, /g, ",").replace(/ /g, "_")}]`;

  function set(patch: Partial<Layer>) {
    setPreset("");
    setLayers((ls) => ls.map((l, i) => (i === sel ? { ...l, ...patch } : l)));
  }

  return (
    <div className="ct-card side-first">
      <div className="ct-side">
        <div className="ct-group">
          <span className="ct-glabel">
            <span>{T("Presets")}</span>
          </span>
          <div className="ct-presets" role="group" aria-label={T("Presets")}>
            {Object.entries(PRESETS).map(([name, ls]) => (
              <button
                key={name}
                type="button"
                aria-pressed={preset === name}
                onClick={() => {
                  setLayers(ls);
                  setSel(0);
                  setPreset(name);
                }}
              >
                <i style={{ boxShadow: ls.map(fmt).join(", ") }} />
                <span>{T(name)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ct-group">
          <span className="ct-glabel">
            <span>{T("Layers")}</span>
            <button
              type="button"
              className="btn xs"
              onClick={() => {
                setPreset("");
                setLayers((ls) => [...ls, L(0, 8, 16, 0, 0.12)]);
                setSel(layers.length);
              }}
            >
              <Icon name="plus" />
              {T("Add layer")}
            </button>
          </span>
          <div className="ct-layers" role="group" aria-label={T("Layers")}>
            {layers.map((l, i) => (
              <div key={i} className="ct-layer" aria-current={i === sel}>
                <button type="button" className="ct-layer-pick" onClick={() => setSel(i)}>
                  <i style={{ background: toHex(l.color, false) }} />
                  <span>
                    {T("Layer {n}", { n: i + 1 })}
                    {l.inset ? ` · ${T("inset")}` : ""}
                  </span>
                  <code>
                    {l.x} {l.y} {l.blur} {l.spread}
                  </code>
                </button>
                <button
                  type="button"
                  className="btn xs"
                  aria-label={T("Remove layer {n}", { n: i + 1 })}
                  disabled={layers.length <= 1}
                  onClick={() => {
                    setPreset("");
                    setLayers((ls) => ls.filter((_, j) => j !== i));
                    setSel(0);
                  }}
                >
                  <Icon name="x" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <Slider label={T("Horizontal offset")} value={cur.x} min={-100} max={100} unit="px" reset={0} onChange={(x) => set({ x })} />
        <Slider label={T("Vertical offset")} value={cur.y} min={-100} max={100} unit="px" reset={0} onChange={(y) => set({ y })} />
        <Slider label={T("Blur")} value={cur.blur} min={0} max={200} unit="px" reset={0} onChange={(blur) => set({ blur })} />
        <Slider label={T("Spread")} value={cur.spread} min={-60} max={60} unit="px" reset={0} onChange={(spread) => set({ spread })} />
        <ColorField label={T("Shadow colour")} value={cur.color} onChange={(color) => set({ color })} />
        <Toggle label={T("Inset (inside the box)")} on={cur.inset} onChange={(inset) => set({ inset })} />
      </div>

      <div className="ct-main">
        <div className={`ct-shadow-stage${dark ? " dark" : ""}`}>
          <div
            className="ct-shadow-box"
            data-shadow={value}
            style={{ boxShadow: value, borderRadius: radius } as CSSProperties}
          >
            <strong>{T("Preview card")}</strong>
            <span>{T("Drag the sliders to shape the shadow.")}</span>
          </div>
        </div>
        <div className="ct-row-ctl">
          <Seg
            label={T("Background")}
            options={[
              [false, T("Light")],
              [true, T("Dark")],
            ]}
            value={dark}
            onPick={setDark}
          />
          <Slider label={T("Corner radius")} value={radius} min={0} max={48} unit="px" reset={16} onChange={setRadius} />
        </div>
        <CodeOut code={code} label="CSS" />
        <details className="ct-more">
          <summary>{T("Tailwind class")}</summary>
          <CodeOut code={tw} label="Tailwind" />
        </details>
      </div>
    </div>
  );
}
