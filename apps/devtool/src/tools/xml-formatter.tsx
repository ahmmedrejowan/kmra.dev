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
import { looksLikeSvg } from "../lib/encode";
import { formatXml, minifyXml, parseXml, xmlStats } from "../lib/xml";

type Mode = "format" | "minify" | "validate";
type Indent = 2 | 4 | "tab";
type View = "text" | "tree";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?><!-- A small feed --><rss version="2.0"><channel><title>kmra.dev</title><link>https://kmra.dev</link><item><title>XML formatter</title><description><![CDATA[Format <b>XML</b>, SVG and RSS.]]></description><category/></item><item><title>Base64</title><enclosure url="https://kmra.dev/a.png" type="image/png"></enclosure></item></channel></rss>`;

export default function XmlFormatter({ preset }: ToolProps) {
  const T = useT();
  const [input, setInput] = useInput("xml-formatter");
  const [mode, setMode] = useState<Mode>((preset?.mode as Mode) ?? "format");
  const [indent, setIndent] = useState<Indent>(2);
  const [collapse, setCollapse] = useState(false);
  const [comments, setComments] = useState(true);
  const [view, setView] = useState<View>("text");

  const result = useMemo(() => {
    if (!input.trim() || typeof DOMParser === "undefined") return null;
    const parsed = parseXml(input);
    if ("error" in parsed) return { ok: false as const, error: parsed.error };
    const text =
      mode === "minify"
        ? minifyXml(input, { collapseEmpty: collapse, comments })
        : formatXml(input, {
            indent: indent === "tab" ? "\t" : " ".repeat(indent),
            collapseEmpty: collapse,
            comments,
          });
    return {
      ok: true as const,
      doc: parsed.doc,
      text,
      info: xmlStats(parsed.doc),
    };
  }, [input, mode, indent, collapse, comments]);

  const error: PaneError | null =
    result && !result.ok
      ? { ...result.error, message: T(result.error.message, result.error.vars) }
      : null;
  const output = result?.ok ? result.text : "";
  const ext = looksLikeSvg(input) ? "svg" : "xml";

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
          {mode !== "validate" && (
            <>
              <BarCheck
                label={T("Collapse empty tags")}
                on={collapse}
                onChange={setCollapse}
              />
              <BarCheck
                label={T("Keep comments")}
                on={comments}
                onChange={setComments}
              />
            </>
          )}
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
            {T(
              "Paste XML, SVG or RSS to start. Errors show the line and column.",
            )}
          </span>
        ) : result.ok ? (
          <>
            <span className="ok">{T("Well-formed XML")}</span>
            <span>
              {T("Root <{r}>", { r: result.info.root })},{" "}
              {T("{n} elements", { n: result.info.elements })},{" "}
              {T("depth {n}", { n: result.info.depth })}
            </span>
            {mode !== "validate" && (
              <span>
                {formatBytes(textBytes(input))} →{" "}
                {formatBytes(textBytes(output))}
              </span>
            )}
          </>
        ) : (
          <span className="bad">{T("Not well-formed")}</span>
        )
      }
    >
      <Pane
        label={T("XML")}
        value={input}
        onChange={setInput}
        placeholder={T("Paste XML here")}
        error={error}
        file=".xml,.svg,.rss,.atom,.xsd,.xsl,.xslt,.plist,.config,.csproj,application/xml,text/xml,image/svg+xml,text/plain"
      />
      {mode === "validate" && result?.ok && view === "text" ? (
        <Pane label={T("Result")} value={output} readOnly>
          <div className="dev-valid">
            <strong>{T("Well-formed XML")}</strong>
            <span className="muted">
              {T("Root <{r}>", { r: result.info.root })},{" "}
              {T("{n} elements", { n: result.info.elements })}
            </span>
          </div>
        </Pane>
      ) : (
        <Pane
          label={T(mode === "minify" ? "Minified" : "Formatted")}
          value={output}
          readOnly
          download={`formatted.${ext}`}
        >
          {view === "tree" && result?.ok ? (
            <div className="json-tree xml-tree">
              {result.doc.documentElement && (
                <XNode node={result.doc.documentElement} depth={0} />
              )}
            </div>
          ) : undefined}
        </Pane>
      )}
    </Workspace>
  );
}

/** Collapsible element tree: tags with their attributes, text and comments as leaves */
function XNode({ node, depth }: { node: Node; depth: number }): ReactNode {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const kids = Array.from(el.childNodes).filter(
      (c) => c.nodeType !== Node.TEXT_NODE || c.textContent?.trim(),
    );
    const head = (
      <>
        <span className="jt-key">&lt;{el.nodeName}</span>
        {Array.from(el.attributes).map((a) => (
          <span key={a.name}>
            {" "}
            <span className="xt-attr">{a.name}</span>=
            <span className="jt-string">"{a.value}"</span>
          </span>
        ))}
        <span className="jt-key">{kids.length ? ">" : " />"}</span>
      </>
    );
    // One text child: show it inline
    if (kids.length === 1 && kids[0]!.nodeType !== Node.ELEMENT_NODE) {
      return (
        <div className="jt-leaf">
          {head}
          <span className="xt-text">{kids[0]!.textContent?.trim()}</span>
        </div>
      );
    }
    if (!kids.length) return <div className="jt-leaf">{head}</div>;
    return (
      <details className="jt" open={depth < 2}>
        <summary>
          {head} <span className="jt-meta">{kids.length}</span>
        </summary>
        <div className="jt-kids">
          {kids.map((c, i) => (
            <XNode key={i} node={c} depth={depth + 1} />
          ))}
        </div>
      </details>
    );
  }
  if (node.nodeType === Node.COMMENT_NODE)
    return (
      <div className="jt-leaf jt-meta">&lt;!--{node.textContent}--&gt;</div>
    );
  if (node.nodeType === Node.CDATA_SECTION_NODE)
    return (
      <div className="jt-leaf">
        <span className="jt-meta">CDATA </span>
        <span className="xt-text">{node.textContent}</span>
      </div>
    );
  if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE)
    return (
      <div className="jt-leaf jt-meta">
        &lt;?{node.nodeName} {node.textContent}?&gt;
      </div>
    );
  return (
    <div className="jt-leaf">
      <span className="xt-text">{node.textContent?.trim()}</span>
    </div>
  );
}
