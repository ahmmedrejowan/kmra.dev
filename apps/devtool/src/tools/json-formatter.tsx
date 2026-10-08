import { useMemo, useState, type ReactNode } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { formatBytes } from "@kmra/ui/lib/files";
import type { ToolProps } from ".";
import {
  BarCheck,
  BarSeg,
  Pane,
  Workspace,
  textBytes,
  useInput,
  type PaneError,
} from "../lib/kit";
import { jsonError } from "../lib/json";

type Mode = "format" | "minify" | "validate";
type Indent = 2 | 4 | "tab";
type View = "text" | "tree";

const SAMPLE = `{"name":"kmra","tools":["json","base64","jwt"],"version":2,"live":true,"owner":{"site":"kmra.dev","since":2026}}`;

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  return v;
}

function stats(v: unknown) {
  let keys = 0;
  let depth = 0;
  const walk = (x: unknown, d: number) => {
    depth = Math.max(depth, d);
    if (Array.isArray(x)) x.forEach((y) => walk(y, d + 1));
    else if (x && typeof x === "object")
      for (const [, y] of Object.entries(x)) {
        keys++;
        walk(y, d + 1);
      }
  };
  walk(v, 0);
  return { keys, depth };
}

export default function JsonFormatter({ preset }: ToolProps) {
  const T = useT();
  const [input, setInput] = useInput("json-formatter");
  const [mode, setMode] = useState<Mode>((preset?.mode as Mode) ?? "format");
  const [indent, setIndent] = useState<Indent>(2);
  const [sorted, setSorted] = useState(false);
  const [view, setView] = useState<View>("text");

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      let v = JSON.parse(input) as unknown;
      if (sorted) v = sortKeys(v);
      const text =
        mode === "minify"
          ? JSON.stringify(v)
          : JSON.stringify(v, null, indent === "tab" ? "\t" : indent);
      return { ok: true as const, value: v, text };
    } catch (e) {
      return { ok: false as const, error: jsonError(input, e) };
    }
  }, [input, mode, indent, sorted]);

  const error: PaneError | null =
    result && !result.ok
      ? { ...result.error, message: T(result.error.message) }
      : null;
  const output = result?.ok ? result.text : "";
  const info = result?.ok ? stats(result.value) : null;

  return (
    <Workspace
      bar={
        <>
          <BarSeg<Mode>
            label={T("Mode")}
            options={[
              ["format", T("Format")],
              ["minify", T("Minify")],
              ["validate", T("Validate")],
            ]}
            value={mode}
            onPick={setMode}
          />
          {mode === "format" && (
            <BarSeg<Indent>
              label={T("Indent")}
              options={[
                [2, T("2 spaces")],
                [4, T("4 spaces")],
                ["tab", T("Tabs")],
              ]}
              value={indent}
              onPick={setIndent}
            />
          )}
          <BarCheck label={T("Sort keys")} on={sorted} onChange={setSorted} />
          <BarSeg<View>
            label={T("Show")}
            options={[
              ["text", T("Text")],
              ["tree", T("Tree")],
            ]}
            value={view}
            onPick={setView}
          />
          {!input && (
            <button
              type="button"
              className="btn xs bar-push"
              onClick={() => setInput(SAMPLE)}
            >
              {T("Try a sample")}
            </button>
          )}
        </>
      }
      status={
        !result ? (
          <span>
            {T("Paste JSON to start. Errors show the line and column.")}
          </span>
        ) : result.ok ? (
          <>
            <span className="ok">{T("Valid JSON")}</span>
            <span>
              {T("{n} keys", { n: info!.keys })},{" "}
              {T("depth {n}", { n: info!.depth })}
            </span>
            <span>
              {formatBytes(textBytes(input))} → {formatBytes(textBytes(output))}
            </span>
          </>
        ) : (
          <span className="bad">{T("Invalid JSON")}</span>
        )
      }
    >
      <Pane
        label={T("JSON")}
        value={input}
        onChange={setInput}
        placeholder={T("Paste JSON here")}
        error={error}
        file=".json,application/json,text/plain"
      />
      {mode === "validate" && result?.ok && view === "text" ? (
        <Pane label={T("Result")} value={output} readOnly>
          <div className="dev-valid">
            <strong>{T("Valid JSON")}</strong>
            <span className="muted">
              {T("{n} keys", { n: info!.keys })},{" "}
              {T("depth {n}", { n: info!.depth })}
            </span>
          </div>
        </Pane>
      ) : (
        <Pane
          label={T(mode === "minify" ? "Minified" : "Formatted")}
          value={output}
          readOnly
          download="formatted.json"
        >
          {view === "tree" && result?.ok ? (
            <div className="json-tree">
              <Node value={result.value} name={null} open />
            </div>
          ) : undefined}
        </Pane>
      )}
    </Workspace>
  );
}

/** Collapsible tree: objects and arrays open with a click, leaves show typed values */
function Node({
  name,
  value,
  open = false,
}: {
  name: string | number | null;
  value: unknown;
  open?: boolean;
}): ReactNode {
  const label =
    name === null ? null : <span className="jt-key">{String(name)}</span>;
  if (value && typeof value === "object") {
    const entries = Array.isArray(value)
      ? value.map((v, i) => [i, v] as const)
      : Object.entries(value);
    const brackets = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
    return (
      <details className="jt" open={open}>
        <summary>
          {label}
          {label && ": "}
          <span className="jt-meta">
            {brackets[0]}
            {entries.length}
            {brackets[1]}
          </span>
        </summary>
        <div className="jt-kids">
          {entries.map(([k, v]) => (
            <Node key={String(k)} name={k} value={v} />
          ))}
        </div>
      </details>
    );
  }
  const type = value === null ? "null" : typeof value;
  return (
    <div className="jt-leaf">
      {label}
      {label && ": "}
      <span className={`jt-${type}`}>
        {type === "string" ? JSON.stringify(value) : String(value)}
      </span>
    </div>
  );
}
