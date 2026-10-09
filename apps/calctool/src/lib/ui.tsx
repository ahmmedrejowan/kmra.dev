/**
 * The calculators' layout: one card, inputs on the left and the answer on the right (big, the
 * hero of the page), then "how it's worked out" and any table underneath. Results update as you
 * type; there's no submit button.
 *
 *   <CalcCard bar={<Seg …/>} result={<Hero label="Monthly payment" value={…} raw={x} />}
 *             below={<How>…</How>}>
 *     <NumField label="Amount" value={a} onChange={setA} />
 *   </CalcCard>
 */
import { useId, useMemo, useState, type ReactNode } from "react";
import { CopyBtn, copyText } from "@kmra/ui/components/kit";
import { Icon } from "@kmra/ui/components/Icon";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import { formatters, parseNum, type Fmt } from "./num";
import "../calc.css";

/** sessionStorage key: a sum typed on the home page, opened in the full calculator */
export const HANDOFF_KEY = "kmra-calc-expr";

export function useFmt(): Fmt {
  const lang = useLang();
  return useMemo(() => formatters(lang), [lang]);
}

export function CalcCard({
  bar,
  children,
  result,
  below,
  className = "",
}: {
  /** Mode switch above the card body */
  bar?: ReactNode;
  /** Inputs (left) */
  children: ReactNode;
  /** The answer (right) */
  result: ReactNode;
  /** Explanation and tables (full width, under both) */
  below?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`calc-card ${className}`}>
      {bar && <div className="calc-bar">{bar}</div>}
      <div className="calc-body">
        <div className="calc-in">{children}</div>
        <div className="calc-out" aria-live="polite">
          {result}
        </div>
      </div>
      {below && <div className="calc-below">{below}</div>}
    </div>
  );
}

/** Segmented choice (a radio group of buttons) */
export function Choice<V extends string | number | boolean>({
  label,
  options,
  value,
  onPick,
  hideLabel = false,
}: {
  label: string;
  options: [V, string][];
  value: V;
  onPick: (v: V) => void;
  hideLabel?: boolean;
}) {
  return (
    <div className="calc-field">
      {!hideLabel && <span className="calc-label">{label}</span>}
      <div className="seg calc-seg" role="group" aria-label={label}>
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

/** Small preset buttons ("10%", "16:9") */
export function Chips<V extends string | number>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: [V, string][];
  value?: V | null;
  onPick: (v: V) => void;
}) {
  return (
    <div className="chips calc-chips" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={value === v}
          onClick={() => onPick(v)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/**
 * A number field: typed as text (so "1,250.50" and Bangla digits work), with an optional unit,
 * a hint and an inline message. Arrow up/down step the value.
 */
export function NumField({
  label,
  value,
  onChange,
  unit,
  prefix,
  hint,
  error,
  step = 1,
  placeholder,
  name,
  wide = false,
  inputMode = "decimal",
}: {
  inputMode?: "decimal" | "text" | "numeric";
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  unit?: ReactNode;
  prefix?: ReactNode;
  hint?: ReactNode;
  /** Friendly message shown under the field (also marks it invalid) */
  error?: string | null;
  step?: number;
  placeholder?: string;
  /** Test and form hook */
  name?: string;
  wide?: boolean;
}) {
  const id = useId();
  const msg = `${id}-msg`;
  return (
    <div className={`calc-field${wide ? " wide" : ""}`}>
      <label className="calc-label" htmlFor={id}>
        {label}
      </label>
      <span className={`calc-input${error ? " bad" : ""}`}>
        {prefix && <span className="calc-affix">{prefix}</span>}
        <input
          id={id}
          name={name}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error || hint ? msg : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            if (inputMode === "text") return;
            const v = parseNum(value) ?? 0;
            if (Number.isNaN(v)) return;
            e.preventDefault();
            const k = e.shiftKey ? 10 : 1;
            const next = v + (e.key === "ArrowUp" ? step : -step) * k;
            onChange(String(Number(next.toPrecision(12))));
          }}
        />
        {unit && <span className="calc-affix">{unit}</span>}
      </span>
      {error ? (
        <span className="calc-msg" id={msg}>
          {error}
        </span>
      ) : hint ? (
        <span className="calc-hint" id={msg}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Any other labelled control (date, time, select) in the same style */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  wide = false,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`calc-field${wide ? " wide" : ""}`}>
      {htmlFor ? (
        <label className="calc-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="calc-label">{label}</span>
      )}
      {children}
      {error ? (
        <span className="calc-msg">{error}</span>
      ) : hint ? (
        <span className="calc-hint">{hint}</span>
      ) : null}
    </div>
  );
}

/** Two or three fields side by side */
export function Row({ children }: { children: ReactNode }) {
  return <div className="calc-row">{children}</div>;
}

/** The answer: label, big value, a line under it and a copy button. */
export function Hero({
  label,
  value,
  raw,
  sub,
  copy,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  /** The unrounded number (data-value, for tests and scripts) */
  raw?: number | string;
  sub?: ReactNode;
  /** Text to copy (defaults to the value when it's a string) */
  copy?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const text = copy ?? (typeof value === "string" ? value : undefined);
  return (
    <div className={`calc-hero${tone ? ` ${tone}` : ""}`}>
      <div className="calc-hero-label">{label}</div>
      <output
        className="calc-hero-value"
        data-value={raw === undefined ? undefined : String(raw)}
      >
        {value}
      </output>
      {sub && <div className="calc-hero-sub">{sub}</div>}
      {text && <CopyBtn text={text} className="btn xs calc-copy" />}
    </div>
  );
}

export interface Stat {
  id: string;
  label: ReactNode;
  value: string;
  raw?: number;
  /** Emphasise (e.g. the unit the reader asked for) */
  on?: boolean;
  note?: ReactNode;
}

/** Secondary answers as label / value rows, each with a copy button */
export function Stats({ rows }: { rows: Stat[] }) {
  return (
    <dl className="calc-stats">
      {rows.map((r) => (
        <div key={r.id} data-id={r.id} className={r.on ? "on" : undefined}>
          <dt>
            {r.label}
            {r.note && <small>{r.note}</small>}
          </dt>
          <dd data-value={r.raw === undefined ? undefined : String(r.raw)}>
            {r.value}
          </dd>
          <CopyIcon
            text={r.value}
            what={typeof r.label === "string" ? r.label : ""}
          />
        </div>
      ))}
    </dl>
  );
}

/** An icon-only copy button with a proper name for screen readers */
export function CopyIcon({ text, what }: { text: string; what?: string }) {
  const T = useT();
  const name = what ? T("Copy {what}", { what }) : T("Copy");
  return (
    <button
      type="button"
      className="calc-copyicon"
      aria-label={name}
      title={name}
      onClick={() =>
        void copyText(
          text,
          T("Copied"),
          T("Couldn't copy. Select the text and copy it yourself."),
        )
      }
    >
      <Icon name="copy" />
    </button>
  );
}

/** Shown in place of the answer until the inputs make sense */
export function Waiting({ children }: { children: ReactNode }) {
  return <p className="calc-wait">{children}</p>;
}

/** "How it's worked out": the formula with the reader's numbers */
export function How({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const T = useT();
  return (
    <section className="calc-how">
      <h3>{title ?? T("How it's worked out")}</h3>
      <div className="calc-how-body">{children}</div>
    </section>
  );
}

/** A results table that scrolls sideways on small screens */
export function Table({
  head,
  rows,
  caption,
  foot,
  max,
}: {
  head: ReactNode[];
  rows: ReactNode[][];
  caption?: string;
  foot?: ReactNode[];
  /** Show this many rows at first, with "Show all" for the rest */
  max?: number;
}) {
  const T = useT();
  const [all, setAll] = useState(false);
  const shown = max && !all ? rows.slice(0, max) : rows;
  return (
    <div className="calc-table-wrap">
      <table className="calc-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {c}
                  </th>
                ) : (
                  <td key={j}>{c}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr>
              {foot.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {c}
                  </th>
                ) : (
                  <td key={j}>{c}</td>
                ),
              )}
            </tr>
          </tfoot>
        )}
      </table>
      {max && rows.length > max && (
        <button
          type="button"
          className="btn sm calc-more"
          onClick={() => setAll(!all)}
        >
          {all ? T("Show fewer") : T("Show all {n} rows", { n: rows.length })}
        </button>
      )}
    </div>
  );
}

/**
 * Check a typed number. Returns [value, message]: value is null while the field is empty or
 * wrong; message is a friendly English key (translated by the caller) or null.
 */
export function check(
  raw: string,
  opts: {
    min?: number;
    max?: number;
    /** Must be above 0 */
    positive?: boolean;
    integer?: boolean;
    /** Message when empty (null = just wait quietly) */
    empty?: string | null;
  } = {},
): [number | null, string | null] {
  const v = parseNum(raw);
  if (v === null) return [null, opts.empty ?? null];
  if (Number.isNaN(v)) return [null, "Type a number, like 1250.50."];
  if (opts.positive && v <= 0) return [null, "Type a number above 0."];
  if (opts.min !== undefined && v < opts.min)
    return [null, opts.min === 0 ? "Type 0 or more." : "Type {min} or more."];
  if (opts.max !== undefined && v > opts.max)
    return [null, "Type {max} or less."];
  if (opts.integer && !Number.isInteger(v))
    return [null, "Type a whole number."];
  return [v, null];
}

/** check() with the message translated */
export function useCheck() {
  const T = useT();
  const f = useFmt();
  return (raw: string, opts: Parameters<typeof check>[1] = {}) => {
    const [v, m] = check(raw, opts);
    return [
      v,
      m
        ? T(m, {
            min: opts.min === undefined ? "" : f.n(opts.min, 4),
            max: opts.max === undefined ? "" : f.n(opts.max, 4),
          })
        : null,
    ] as const;
  };
}

/** "1 day" / "3 days" in the page language: `n` is filled in with the page's digits */
export function usePlural() {
  const T = useT();
  const f = useFmt();
  return (n: number, one: string, many: string) =>
    T(n === 1 ? one : many, { n: f.int(n) });
}

/** A preset value of the right type, or the fallback */
export function pre<T extends string | number | boolean>(
  v: unknown,
  fallback: T,
): T {
  return typeof v === typeof fallback ? (v as T) : fallback;
}

/** Read and write a small per-viewer setting (try/catch: storage can be blocked) */
export function store<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
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
