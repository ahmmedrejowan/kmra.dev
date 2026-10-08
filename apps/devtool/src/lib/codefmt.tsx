/**
 * The HTML, CSS and JavaScript formatters share one workspace: beautify with Prettier or minify,
 * with the size before and after. Formatting is async (the libraries load on first use), so the
 * latest input wins and older runs are dropped.
 */
import { useEffect, useRef, useState } from "react";
import type { Preset } from "@kmra/registry";
import { useT } from "@kmra/ui/lib/i18n-react";
import { formatBytes } from "@kmra/ui/lib/files";
import {
  BarCheck,
  BarField,
  BarSeg,
  Pane,
  Workspace,
  textBytes,
  useInput,
  type PaneError,
} from "./kit";
import {
  beautify,
  codeError,
  minifyCss,
  minifyHtml,
  minifyJs,
  preload,
  type CodeProblem,
  type Lang,
  type PrettyOptions,
} from "./pretty";

type Mode = "beautify" | "minify";
type Indent = PrettyOptions["indent"];
type Kind = "html" | "css" | "js";

const META: Record<
  Kind,
  {
    slug: string;
    label: string;
    placeholder: string;
    file: string;
    ext: (ts: boolean) => string;
  }
> = {
  html: {
    slug: "html-formatter",
    label: "HTML",
    placeholder: "Paste HTML here",
    file: ".html,.htm,.xhtml,.vue,.svelte,text/html,text/plain",
    ext: () => "html",
  },
  css: {
    slug: "css-formatter",
    label: "CSS",
    placeholder: "Paste CSS here",
    file: ".css,.pcss,text/css,text/plain",
    ext: () => "css",
  },
  js: {
    slug: "js-formatter",
    label: "JavaScript",
    placeholder: "Paste JavaScript or TypeScript here",
    file: ".js,.mjs,.cjs,.jsx,.ts,.tsx,.mts,.cts,text/javascript,application/javascript,text/plain",
    ext: (ts) => (ts ? "ts" : "js"),
  },
};

const SAMPLES: Record<Kind, string> = {
  html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>kmra.dev</title><style>body{font:16px/1.5 system-ui;margin:0}.card{padding:16px;border-radius:12px}</style></head><body><!-- main card --><div class="card"><h1>Hello</h1><p>Format <b>HTML</b> and <i>minify</i> it.</p><ul><li>One</li><li>Two</li></ul><pre>  kept   as   written</pre></div><script>const tools=["html","css","js"];for(const t of tools){console.log(t)}</script></body></html>`,
  css: `/* Card styles */
:root{--accent:#8e4ec6;--radius:12px}
.card{padding:16px 20px;border:1px solid #e4e4e7;border-radius:var(--radius);background:white}
.card > h2 , .card + .card{margin:0 0 8px;font:600 18px/1.3 system-ui, sans-serif}
@media (max-width: 600px){.card{padding:12px;width:calc(100% - 2 * 12px)}}
a:hover{color:var(--accent);background:url( "bg.png" ) no-repeat}`,
  js: `// Fetch-free helpers
const tools=[{name:"json",ready:true},{name:"xml",ready:true},{name:"sql",ready:false}]
function readyTools(list){return list.filter(t=>t.ready).map(t=>t.name.toUpperCase())}
export async function main(){const names=readyTools(tools);for(const n of names){console.log(\`Tool: \${n}\`)}return names.length}`,
};

export function CodeFormatter({
  kind,
  preset,
}: {
  kind: Kind;
  preset?: Preset;
}) {
  const T = useT();
  const meta = META[kind];
  const [input, setInput] = useInput(meta.slug);
  const [mode, setMode] = useState<Mode>((preset?.mode as Mode) ?? "beautify");
  const [indent, setIndent] = useState<Indent>(2);
  const [width, setWidth] = useState("80");
  const [singleQuote, setSingleQuote] = useState(false);
  const [semi, setSemi] = useState(true);
  const [ts, setTs] = useState(preset?.ts === true);
  const [out, setOut] = useState<
    { text: string } | { error: CodeProblem } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const run = useRef(0);

  const lang: Lang = kind === "js" ? (ts ? "ts" : "js") : kind;
  // Terser reads JavaScript only
  const tsMinify = mode === "minify" && lang === "ts";

  useEffect(() => preload(lang, mode === "minify"), [lang, mode]);

  useEffect(() => {
    const id = ++run.current;
    if (!input.trim() || tsMinify) {
      setOut(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    const timer = setTimeout(async () => {
      let next: { text: string } | { error: CodeProblem };
      try {
        const pw = Math.min(400, Math.max(20, Number(width) || 80));
        const text =
          mode === "beautify"
            ? await beautify(input, lang, {
                printWidth: pw,
                indent,
                singleQuote,
                semi,
              })
            : kind === "css"
              ? minifyCss(input)
              : kind === "html"
                ? minifyHtml(input)
                : await minifyJs(input);
        next = { text };
      } catch (e) {
        next = { error: codeError(e) };
      }
      if (id !== run.current) return;
      setOut(next);
      setBusy(false);
    }, 120);
    return () => clearTimeout(timer);
  }, [input, mode, lang, kind, indent, width, singleQuote, semi, tsMinify]);

  const error: PaneError | null = out && "error" in out ? out.error : null;
  const output = out && "text" in out ? out.text : "";
  const before = textBytes(input);
  const after = textBytes(output);
  const saved = before ? Math.round((1 - after / before) * 1000) / 10 : 0;

  return (
    <Workspace
      bar={
        <>
          <BarSeg<Mode>
            label={T("Mode")}
            options={[
              ["beautify", T("Beautify")],
              ["minify", T("Minify")],
            ]}
            value={mode}
            onPick={setMode}
          />
          {kind === "js" && (
            <BarCheck label={T("TypeScript")} on={ts} onChange={setTs} />
          )}
          {mode === "beautify" && (
            <>
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
              <BarField
                label={T("Line width")}
                type="number"
                min={20}
                max={400}
                width={64}
                value={width}
                onChange={setWidth}
              />
              {kind !== "html" && (
                <BarSeg<boolean>
                  label={T("Quotes")}
                  options={[
                    [false, T("Double")],
                    [true, T("Single")],
                  ]}
                  value={singleQuote}
                  onPick={setSingleQuote}
                />
              )}
              {kind === "js" && (
                <BarCheck
                  label={T("Semicolons")}
                  on={semi}
                  onChange={setSemi}
                />
              )}
            </>
          )}
          {!input && (
            <button
              type="button"
              className="btn xs bar-push"
              onClick={() => setInput(SAMPLES[kind])}
            >
              {T("Try a sample")}
            </button>
          )}
        </>
      }
      status={
        tsMinify ? (
          <span>
            {T(
              "Minify works on JavaScript. Turn off TypeScript, or compile the code first.",
            )}
          </span>
        ) : !input.trim() ? (
          <span>
            {mode === "minify"
              ? T(MINIFY_NOTE[kind])
              : T("Paste code to start. Errors show the line and column.")}
          </span>
        ) : busy && !out ? (
          <span>{T("Loading the formatter…")}</span>
        ) : error ? (
          <span className="bad">{T("Couldn't parse this code")}</span>
        ) : (
          <>
            <span className="ok">
              {T(mode === "minify" ? "Minified" : "Formatted")}
            </span>
            <span>
              {formatBytes(before)} → {formatBytes(after)}
              {mode === "minify" && saved > 0
                ? ` · ${T("{n}% smaller", { n: saved })}`
                : ""}
            </span>
            {mode === "minify" && <span>{T(MINIFY_NOTE[kind])}</span>}
          </>
        )
      }
    >
      <Pane
        label={kind === "js" && ts ? "TypeScript" : meta.label}
        value={input}
        onChange={setInput}
        placeholder={T(meta.placeholder)}
        error={error}
        file={meta.file}
      />
      <Pane
        label={T(mode === "minify" ? "Minified" : "Formatted")}
        value={output}
        readOnly
        wrap={mode === "minify"}
        download={`${mode === "minify" ? "code.min" : "code"}.${meta.ext(ts)}`}
      />
    </Workspace>
  );
}

/** What each minifier does, in one line */
const MINIFY_NOTE: Record<Kind, string> = {
  html: "Removes comments and extra spaces. Text in <pre>, <textarea>, <script> and <style> stays as written.",
  css: "Removes comments, spaces and the last semicolon in each block. Comments starting with /*! stay.",
  js: "Shortens local names and drops unused code. Global names and /*! license comments stay.",
};
