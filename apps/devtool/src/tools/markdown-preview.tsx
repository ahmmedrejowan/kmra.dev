import { useMemo, useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { CopyBtn } from "@kmra/ui/components/kit";
import type { ToolProps } from ".";
import { BarSeg, Pane, Workspace, downloadText, useInput } from "../lib/kit";
import {
  applyMd,
  renderMarkdown,
  standaloneHtml,
  type MdAction,
} from "../lib/markdown";

type View = "preview" | "html";

const SAMPLE = `# Release notes

Everything in **DevTool** runs on your device. Write _Markdown_ on the left and see it here.

## What's new

- [x] Markdown preview with \`tables\`
- [x] Task lists like this one
- [ ] Your next idea

| Tool | Group | Ready |
| --- | --- | :-: |
| JSON formatter | Format | yes |
| Markdown preview | Format | yes |

> Links open in a new tab: [kmra.dev](https://kmra.dev)

\`\`\`js
const greet = (name) => \`Hello, \${name}!\`;
\`\`\`

~~Old way~~ new way.
`;

const ACTIONS: [MdAction, string, string][] = [
  ["heading", "H", "Heading"],
  ["bold", "B", "Bold"],
  ["italic", "I", "Italic"],
  ["link", "", "Link"],
  ["code", "", "Code"],
  ["list", "", "List"],
];

export default function MarkdownPreview(_: ToolProps) {
  const T = useT();
  const [input, setInput] = useInput("markdown-preview");
  const [view, setView] = useState<View>("preview");
  const area = useRef<HTMLTextAreaElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  // Which side the user is scrolling, so the other side follows without bouncing back
  const leader = useRef<"edit" | "view" | null>(null);
  const release = useRef(0);

  const html = useMemo(
    () =>
      input.trim() && typeof window !== "undefined"
        ? renderMarkdown(input)
        : "",
    [input],
  );
  const title =
    /^#{1,6}\s+(.+)$/m
      .exec(input)?.[1]
      ?.replace(/[*_`[\]]/g, "")
      .trim() || T("Markdown document");
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;

  function act(a: MdAction) {
    const t = area.current;
    if (!t) return;
    const r = applyMd(input, t.selectionStart, t.selectionEnd, a, {
      bold: T("bold text"),
      italic: T("italic text"),
      code: T("code"),
      link: T("link text"),
    });
    setInput(r.text);
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(r.start, r.end);
    });
  }

  function follow(
    from: HTMLElement,
    to: HTMLElement | null,
    who: "edit" | "view",
  ) {
    if (!to || (leader.current && leader.current !== who)) return;
    leader.current = who;
    const max = from.scrollHeight - from.clientHeight;
    const ratio = max > 0 ? from.scrollTop / max : 0;
    to.scrollTop = ratio * (to.scrollHeight - to.clientHeight);
    clearTimeout(release.current);
    release.current = window.setTimeout(() => (leader.current = null), 120);
  }

  return (
    <Workspace
      bar={
        <>
          <div
            className="bar-item md-tools"
            role="toolbar"
            aria-label={T("Formatting")}
          >
            {ACTIONS.map(([a, glyph, label]) => (
              <button
                key={a}
                type="button"
                className={`btn xs md-${a}`}
                title={T(label)}
                aria-label={T(label)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => act(a)}
              >
                {a === "link" ? (
                  <Icon name="link" />
                ) : a === "code" ? (
                  <Icon name="code" />
                ) : a === "list" ? (
                  <Icon name="list" />
                ) : (
                  <span aria-hidden="true">{glyph}</span>
                )}
              </button>
            ))}
          </div>
          <BarSeg<View>
            label={T("Show")}
            options={[
              ["preview", T("Preview")],
              ["html", T("HTML")],
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
        input.trim() ? (
          <>
            <span>{T("{n} words", { n: words })}</span>
            <span>
              {T(
                "Tables, task lists and strikethrough work. Scripts in the Markdown never run.",
              )}
            </span>
          </>
        ) : (
          <span>
            {T("Write or paste Markdown. The preview updates as you type.")}
          </span>
        )
      }
    >
      <Pane
        label={T("Markdown")}
        value={input}
        actions={
          <>
            {input && (
              <button
                type="button"
                className="btn xs"
                onClick={() =>
                  downloadText(input, "document.md", "text/markdown")
                }
              >
                <Icon name="download" />
                {T("Download .md")}
              </button>
            )}
          </>
        }
      >
        <div className="code wrap md-edit">
          <textarea
            ref={area}
            value={input}
            placeholder={T("Write Markdown here")}
            spellCheck
            aria-label={T("Markdown")}
            onChange={(e) => setInput(e.target.value)}
            onScroll={(e) => follow(e.currentTarget, preview.current, "edit")}
            onKeyDown={(e) => {
              const mod = e.metaKey || e.ctrlKey;
              if (
                mod &&
                !e.shiftKey &&
                !e.altKey &&
                (e.key === "b" || e.key === "i")
              ) {
                e.preventDefault();
                act(e.key === "b" ? "bold" : "italic");
              }
            }}
          />
        </div>
      </Pane>
      <Pane
        label={T(view === "preview" ? "Preview" : "HTML")}
        value={html}
        actions={
          html ? (
            <>
              <CopyBtn text={html} label={T("Copy HTML")} className="btn xs" />
              <button
                type="button"
                className="btn xs"
                onClick={() =>
                  downloadText(
                    standaloneHtml(html, title),
                    "document.html",
                    "text/html",
                  )
                }
              >
                <Icon name="download" />
                {T("Download .html")}
              </button>
            </>
          ) : undefined
        }
      >
        {view === "preview" ? (
          <div
            ref={preview}
            className="md-preview"
            onScroll={(e) => follow(e.currentTarget, area.current, "view")}
            // Sanitised by DOMPurify in renderMarkdown
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="code wrap">
            <textarea
              value={html}
              readOnly
              spellCheck={false}
              aria-label={T("HTML")}
            />
          </div>
        )}
      </Pane>
    </Workspace>
  );
}
