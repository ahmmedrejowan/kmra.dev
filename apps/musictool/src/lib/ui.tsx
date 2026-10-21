/**
 * MusicTool's layout and small controls. Every tool is one card: the instrument (meter, beat
 * display, diagram) is the stage on the left and big; settings sit beside it on the right, and
 * everything stacks on phones with the stage first.
 *
 *   <Card stage={<Meter …/>} side={<><Field …/>…</>} below={…} />
 */
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import { bnDigits } from "@kmra/ui/lib/i18n";
import { FLATS, SHARPS, mod } from "./theory";
import "../music.css";

export function Card({
  stage,
  side,
  below,
  bar,
  className = "",
}: {
  stage: ReactNode;
  side?: ReactNode;
  below?: ReactNode;
  /** A strip above the card body (mode switches) */
  bar?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-card ${className}`}>
      {bar && <div className="mt-bar">{bar}</div>}
      <div className={`mt-body${side ? "" : " solo"}`}>
        <div className="mt-stage">{stage}</div>
        {side && <div className="mt-side">{side}</div>}
      </div>
      {below && <div className="mt-below">{below}</div>}
    </div>
  );
}

/** Numbers in the page's digits */
export function useNum() {
  const lang = useLang();
  return useMemo(
    () => (v: number | string, digits?: number) => {
      const s =
        typeof v === "number" && digits !== undefined
          ? v.toFixed(digits)
          : String(v);
      return lang === "bn" ? bnDigits(s) : s;
    },
    [lang],
  );
}

/** A labelled control */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  wide,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`mt-field${wide ? " wide" : ""}`}>
      {htmlFor ? (
        <label className="mt-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="mt-label">{label}</span>
      )}
      {children}
      {hint && <span className="mt-hint">{hint}</span>}
    </div>
  );
}

/** A select with a visible label */
export function Select<V extends string | number>({
  label,
  value,
  options,
  onChange,
  name,
  hint,
}: {
  label: string;
  value: V;
  options: [V, string][];
  onChange: (v: V) => void;
  name?: string;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <select
        id={id}
        name={name}
        className="mt-control"
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const hit = options.find(([v]) => String(v) === raw);
          if (hit) onChange(hit[0]);
        }}
      >
        {options.map(([v, l]) => (
          <option key={String(v)} value={String(v)}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Segmented buttons (radio-like), with the label above */
export function Choice<V extends string | number | boolean>({
  label,
  options,
  value,
  onPick,
  className = "",
}: {
  label: string;
  options: [V, ReactNode][];
  value: V;
  onPick: (v: V) => void;
  className?: string;
}) {
  return (
    <div className="mt-field">
      <span className="mt-label">{label}</span>
      <div
        className={`seg mt-seg ${className}`}
        role="group"
        aria-label={label}
      >
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

/** Pill buttons that wrap (time signatures, roots) */
export function Pills<V extends string | number>({
  label,
  options,
  value,
  onPick,
  hideLabel,
}: {
  label: string;
  options: [V, ReactNode][];
  value: V | null;
  onPick: (v: V) => void;
  hideLabel?: boolean;
}) {
  return (
    <div className="mt-field">
      {!hideLabel && <span className="mt-label">{label}</span>}
      <div className="chips mt-pills" role="group" aria-label={label}>
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

/**
 * A number typed or stepped: commits on blur/Enter so typing "1" on the way to "120" doesn't
 * jump the value; arrow keys step (Shift × 10).
 */
export function NumInput({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  name,
  decimals = 0,
  hideLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  name?: string;
  decimals?: number;
  hideLabel?: boolean;
}) {
  const id = useId();
  const show = (v: number) => String(Number(v.toFixed(decimals)));
  const [text, setText] = useState(show(value));
  useEffect(() => setText(show(value)), [value]);
  const commit = (raw: string) => {
    const v = Number(
      raw
        .replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)))
        .replace(",", "."),
    );
    if (!Number.isFinite(v) || raw.trim() === "") return setText(show(value));
    const c = Math.min(max, Math.max(min, v));
    onChange(Number(c.toFixed(decimals)));
    setText(show(c));
  };
  return (
    <div className="mt-field">
      <label className={hideLabel ? "sr-only" : "mt-label"} htmlFor={id}>
        {label}
      </label>
      <span className="mt-input">
        <input
          id={id}
          name={name}
          type="text"
          inputMode={decimals ? "decimal" : "numeric"}
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            const k = e.shiftKey ? 10 : 1;
            const next = Math.min(
              max,
              Math.max(min, value + (e.key === "ArrowUp" ? step : -step) * k),
            );
            onChange(Number(next.toFixed(decimals)));
          }}
        />
        {unit && <span className="mt-affix">{unit}</span>}
      </span>
    </div>
  );
}

/** A range slider with its value shown */
export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
  name,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  display?: string;
  name?: string;
}) {
  const id = useId();
  return (
    <div className="mt-field">
      <span className="mt-label mt-label-row">
        <label htmlFor={id}>{label}</label>
        {display !== undefined && <output htmlFor={id}>{display}</output>}
      </span>
      <input
        id={id}
        name={name}
        type="range"
        className="mt-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/** Note + octave picker (chromatic names) */
export function NotePicker({
  label,
  midi,
  onChange,
  minOctave = 0,
  maxOctave = 8,
  flats = false,
}: {
  label: string;
  midi: number;
  onChange: (midi: number) => void;
  minOctave?: number;
  maxOctave?: number;
  flats?: boolean;
}) {
  const T = useT();
  const num = useNum();
  const names = flats ? FLATS : SHARPS;
  const pcv = mod(midi, 12);
  const oct = Math.floor(midi / 12) - 1;
  const id = useId();
  return (
    <div className="mt-field">
      <span className="mt-label" id={id}>
        {label}
      </span>
      <div className="mt-notepick" role="group" aria-labelledby={id}>
        <select
          className="mt-control"
          aria-label={T("Note")}
          value={pcv}
          onChange={(e) => onChange((oct + 1) * 12 + Number(e.target.value))}
        >
          {names.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
        <select
          className="mt-control"
          aria-label={T("Octave")}
          value={oct}
          onChange={(e) => onChange((Number(e.target.value) + 1) * 12 + pcv)}
        >
          {Array.from(
            { length: maxOctave - minOctave + 1 },
            (_, i) => minOctave + i,
          ).map((o) => (
            <option key={o} value={o}>
              {T("Octave {n}", { n: num(o) })}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Keyboard hints: <Keys items={[["Space", "Start or stop"]]} /> */
export function Keys({ items }: { items: [string[], string][] }) {
  const T = useT();
  return (
    <p className="mt-keys">
      <span className="sr-only">{T("Keyboard shortcuts")}: </span>
      {items.map(([keys, what]) => (
        <span key={what}>
          {keys.map((k) => (
            <kbd key={k}>{k}</kbd>
          ))}{" "}
          {what}
        </span>
      ))}
    </p>
  );
}

/** A preset value of the right type, or the fallback */
export function pre(v: unknown, fallback: number): number;
export function pre(v: unknown, fallback: string): string;
export function pre(v: unknown, fallback: boolean): boolean;
export function pre(v: unknown, fallback: string | number | boolean) {
  return typeof v === typeof fallback ? v : fallback;
}

/** Small per-viewer settings (storage can be blocked: then nothing is remembered) */
export function load<V>(key: string, fallback: V): V {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as V) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // private mode: fine, it just isn't remembered
  }
}

/** True when a key event should be left alone (typing, or a focused control handles it) */
export function busyTarget(e: KeyboardEvent, alsoButtons = false): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  if (t.isContentEditable) return true;
  if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement)
    return true;
  if (t instanceof HTMLInputElement)
    return t.type !== "checkbox" && t.type !== "radio";
  if (
    alsoButtons &&
    (t instanceof HTMLButtonElement || t instanceof HTMLAnchorElement)
  )
    return true;
  return e.metaKey || e.ctrlKey || e.altKey;
}
