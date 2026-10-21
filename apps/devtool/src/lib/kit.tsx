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
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { CopyBtn } from "@kmra/ui/components/kit";
import { downloadBlob, toolName } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import { useT } from "@kmra/ui/lib/i18n-react";
import { takeText } from "./handoff";
import { takeFiles } from "@kmra/ui/lib/handoff";

/**
 * The file the input came from, so downloads read "<your file>-<tool>-kmra.<ext>". Set by
 * "Open file" and by files handed over from kmra.dev; typed or pasted input has none, and its
 * downloads keep their plain names (formatted.json, query.sql…).
 */
interface Source {
  slug: string;
  name: string | null;
  setName: (name: string | null) => void;
}
const SourceCtx = createContext<Source>({
  slug: "",
  name: null,
  setName: () => {},
});

/** Wraps a tool (DevTool does this) so its panes share the opened file's name */
export function SourceProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [name, setName] = useState<string | null>(null);
  return (
    <SourceCtx.Provider value={{ slug, name, setName }}>
      {children}
    </SourceCtx.Provider>
  );
}

export function useSource(): Source {
  return useContext(SourceCtx);
}

/**
 * Download names: "formatted.json" stays as it is for typed input; for an opened "report.json"
 * it becomes "report-json-formatter.json" (downloadBlob adds the kmra tag).
 */
export function useOutName(): (fixed: string) => string {
  const { slug, name } = useSource();
  return (fixed) => {
    if (!name || !slug) return fixed;
    const ext = /\.([^.]+)$/.exec(fixed)?.[1];
    return `${toolName(name, slug)}${ext ? `.${ext}` : ""}`;
  };
}

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
  keepName = false,
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
  /** Show "Download" with this file name (output panes); an opened file's name replaces it */
  download?: string;
  /** Use `download` exactly (the tool already built it from the file's name) */
  keepName?: boolean;
  /** Extra buttons in the pane header */
  actions?: ReactNode;
  /** Wrap long lines instead of scrolling sideways */
  wrap?: boolean;
  /** Replaces the text area (e.g. a tree or a table view) */
  children?: ReactNode;
}) {
  const T = useT();
  const source = useSource();
  const outName = useOutName();
  const fileRef = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value ? value.split("\n").length : 1;

  function sync(e: UIEvent<HTMLTextAreaElement>) {
    if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      // Pasted text has no file name: downloads go back to the plain names
      source.setName(null);
      onChange?.(text);
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
                  if (!f) return;
                  const text = await f.text();
                  source.setName(f.name);
                  onChange?.(text);
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
                  onClick={() => {
                    source.setName(null);
                    onChange("");
                  }}
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
                  onClick={() =>
                    downloadText(value, keepName ? download : outName(download))
                  }
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
 * Input state for a tool: starts from text handed over by the home page's smart paste box, or
 * from a text file dropped on kmra.dev (kept in this site's storage through /handoff),
 * otherwise from `initial`.
 */
export function useInput(
  slug: string,
  initial = "",
): [string, (v: string) => void] {
  const T = useT();
  const { setName } = useSource();
  const [v, set] = useState(initial);
  useEffect(() => {
    const t = takeText(slug);
    if (t !== null) return set(t);
    void takeFiles().then(async (files) => {
      const f = files[0];
      if (!f) return;
      if (files.length > 1)
        toast(
          T("Only the first file is used: {name}").replace("{name}", f.name),
        );
      if (f.size >= 20_000_000)
        return toast(
          T("{name} is too large to open here.").replace("{name}", f.name),
        );
      set(await f.text());
      setName(f.name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
