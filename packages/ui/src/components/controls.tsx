import type { ReactNode } from "react";

/** Small form controls shared by the tools: sliders, segmented buttons, colour swatches, toggles. */

export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  onChange,
  reset,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  /** Double-click the slider to return to this value */
  reset?: number;
}) {
  return (
    <div className="ctl">
      <label>
        {label}
        <span>
          {value > 0 && min < 0 ? "+" : ""}
          {Math.round(value * 10) / 10}
          {unit}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        onDoubleClick={() => reset !== undefined && onChange(reset)}
        aria-label={label}
      />
    </div>
  );
}

export function Seg<T extends string | number | boolean>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: [T, string][];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="ctl">
      <span className="lbl">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map(([v, l]) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={v === value}
            onClick={() => onPick(v)}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

const SWATCHES = [
  "#ffffff",
  "#000000",
  "#e5484d",
  "#f5a524",
  "#30a46c",
  "#0057ff",
  "#8e4ec6",
  "#f0f0f0",
];

export function Colors({
  label,
  value,
  onPick,
  list = SWATCHES,
  extra,
}: {
  label: string;
  value: string;
  onPick: (v: string) => void;
  list?: string[];
  extra?: ReactNode;
}) {
  return (
    <div className="ctl">
      <span className="lbl">{label}</span>
      <div className="swatches">
        {extra}
        {list.map((c) => (
          <button
            key={c}
            type="button"
            className="sw"
            style={{ background: c }}
            aria-label={c}
            aria-pressed={value.toLowerCase() === c}
            onClick={() => onPick(c)}
          />
        ))}
        <label className="sw pick" title="Pick any colour">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
            onChange={(e) => onPick(e.target.value)}
            aria-label={`${label}: pick any colour`}
          />
        </label>
      </div>
    </div>
  );
}

export function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
