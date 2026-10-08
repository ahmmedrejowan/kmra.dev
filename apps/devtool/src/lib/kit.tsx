/**
 * The developer tools' workspace: a slim options bar on top, input and output panes side by
 * side, and a status line. No sidebar and no stage: the text is the work.
 *
 *   <Workspace bar={<BarSeg …/>} status={…}>
 *     <Pane label="JSON" value={input} onChange={setInput} file />
 *     <Pane label="Result" value={output} readOnly download="data.json" />
 *   </Workspace>
 */
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { CopyBtn } from "@kmra/ui/components/kit";
import { downloadBlob } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import { useT } from "@kmra/ui/lib/i18n-react";
import { takeText } from "./handoff";

export function Workspace({
  bar,
  status,
  children,
  cols = 2,
}: {
  bar?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
  /** Panes side by side on wide screens (1, 2 or 3) */
  cols?: 1 | 2 | 3;
}) {
  return (
    <div className="devcard">
      {bar && <div className="dev-bar">{bar}</div>}
      <div className={`dev-panes c${cols}`}>{children}</div>
      {status && (
        <div className="dev-status" aria-live="polite">
          {status}
        </div>
      )}
    </div>
  );
}

/** Problem in the input, shown under the pane and marked in the gutter */
export interface PaneError {
  message: string;
  line?: number;
  col?: number;
}

export function Pane({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder,
  error,
  file,
  download,
  actions,
  wrap = false,
  children,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  error?: PaneError | null;
  /** Show "Open file" (text files); pass an accept string to narrow it */
  file?: boolean | string;
  /** Show "Download" with this file name (output panes) */
  download?: string;
  /** Extra buttons in the pane header */
  actions?: ReactNode;
  /** Wrap long lines instead of scrolling sideways */
  wrap?: boolean;
  /** Replaces the text area (e.g. a tree or a table view) */
  children?: ReactNode;
}) {
  const T = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value ? value.split("\n").length : 1;

  function sync(e: UIEvent<HTMLTextAreaElement>) {
    if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
  }

  async function paste() {
    try {
      onChange?.(await navigator.clipboard.readText());
    } catch {
      toast(T("Couldn't read the clipboard. Paste with Ctrl+V or ⌘V."));
    }
  }

  return (
    <section className={`pane${error ? " has-error" : ""}`}>
      <header className="pane-head">
        <span className="pane-label">{label}</span>
        <span className="pane-acts">
          {actions}
          {!readOnly && file && (
            <>
              <button
                type="button"
                className="btn xs"
                onClick={() => fileRef.current?.click()}
              >
                <Icon name="upload" />
                {T("Open file")}
              </button>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept={typeof file === "string" ? file : undefined}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) onChange?.(await f.text());
                }}
              />
            </>
          )}
          {!readOnly && onChange && (
            <>
              <button type="button" className="btn xs" onClick={paste}>
                {T("Paste")}
              </button>
              {value && (
                <button
                  type="button"
                  className="btn xs"
                  onClick={() => onChange("")}
                >
                  {T("Clear")}
                </button>
              )}
            </>
          )}
          {readOnly && value && (
            <>
              <CopyBtn text={value} className="btn xs" />
              {download && (
                <button
                  type="button"
                  className="btn xs"
                  onClick={() => downloadText(value, download)}
                >
                  <Icon name="download" />
                  {T("Download")}
                </button>
              )}
            </>
          )}
        </span>
      </header>
      {children ?? (
        <div className={`code${wrap ? " wrap" : ""}`}>
          <div className="gutter" ref={gutter} aria-hidden="true">
            {Array.from({ length: lines }, (_, i) => (
              <span key={i} className={error?.line === i + 1 ? "bad" : ""}>
                {i + 1}
              </span>
            ))}
          </div>
          <textarea
            ref={area}
            value={value}
            readOnly={readOnly}
            placeholder={placeholder}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label={label}
            onScroll={sync}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={(e) => {
              // Tab inserts two spaces instead of leaving the field
              if (e.key !== "Tab" || readOnly || e.shiftKey) return;
              e.preventDefault();
              const t = e.currentTarget;
              const { selectionStart: a, selectionEnd: b } = t;
              const v = t.value.slice(0, a) + "  " + t.value.slice(b);
              onChange?.(v);
              requestAnimationFrame(() => {
                t.selectionStart = t.selectionEnd = a + 2;
              });
            }}
          />
        </div>
      )}
      {error && (
        <p className="pane-error" role="alert">
          {error.line
            ? T("Line {l}, column {c}: ", { l: error.line, c: error.col ?? 1 })
            : ""}
          {error.message}
        </p>
      )}
    </section>
  );
}

/** Options bar: a labelled segmented control */
export function BarSeg<V extends string | number | boolean>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: [V, string][];
  value: V;
  onPick: (v: V) => void;
}) {
  return (
    <div className="bar-item">
      <span className="bar-label">{label}</span>
      <div className="seg sm" role="group" aria-label={label}>
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

/** Options bar: a checkbox */
export function BarCheck({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="bar-item bar-check">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/** Options bar: a small number or text field */
export function BarField({
  label,
  value,
  onChange,
  type = "text",
  width = 72,
  min,
  max,
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number";
  width?: number;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <label className="bar-item">
      <span className="bar-label">{label}</span>
      <input
        className="bar-input"
        style={{ width }}
        type={type}
        min={min}
        max={max}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/**
 * Input state for a tool: starts from text handed over by the home page's smart paste box,
 * otherwise from `initial`.
 */
export function useInput(
  slug: string,
  initial = "",
): [string, (v: string) => void] {
  const [v, set] = useState(initial);
  useEffect(() => {
    const t = takeText(slug);
    if (t !== null) set(t);
  }, [slug]);
  return [v, set];
}

export function downloadText(text: string, name: string, type = "text/plain") {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), name);
}

/** "1.2 KB"-style size of a UTF-8 string */
export function textBytes(s: string): number {
  return new TextEncoder().encode(s).length;
}
