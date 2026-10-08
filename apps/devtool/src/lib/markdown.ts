/**
 * Markdown to safe HTML for the preview: marked (GitHub-flavoured: tables, task lists,
 * strikethrough) and then DOMPurify, so pasted Markdown can never run scripts or event handlers.
 */
import { Marked } from "marked";
import DOMPurify from "dompurify";

const md = new Marked({ gfm: true, breaks: false, async: false });

let hooked = false;

export function renderMarkdown(src: string): string {
  if (!hooked) {
    // Links open in a new tab and can't reach back into this page
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A" && node.getAttribute("href")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
    hooked = true;
  }
  const html = md.parse(src) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "iframe", "object", "embed"],
    FORBID_ATTR: ["style"],
    ADD_ATTR: ["target"],
  });
}

/** A Markdown edit on the selection: wrap it, or prefix its lines */
export type MdAction = "bold" | "italic" | "link" | "code" | "list" | "heading";

export function applyMd(
  text: string,
  start: number,
  end: number,
  action: MdAction,
  words: Record<"bold" | "italic" | "code" | "link", string>,
): { text: string; start: number; end: number } {
  const sel = text.slice(start, end);
  const wrap = (a: string, b: string, fallback: string) => {
    const body = sel || fallback;
    // Already wrapped: unwrap
    if (
      sel &&
      text.slice(start - a.length, start) === a &&
      text.slice(end, end + b.length) === b
    )
      return {
        text:
          text.slice(0, start - a.length) + sel + text.slice(end + b.length),
        start: start - a.length,
        end: end - a.length,
      };
    return {
      text: text.slice(0, start) + a + body + b + text.slice(end),
      start: start + a.length,
      end: start + a.length + body.length,
    };
  };
  switch (action) {
    case "bold":
      return wrap("**", "**", words.bold);
    case "italic":
      return wrap("_", "_", words.italic);
    case "code":
      return sel.includes("\n")
        ? wrap("```\n", "\n```", "")
        : wrap("`", "`", words.code);
    case "link": {
      const label = sel || words.link;
      const ins = `[${label}](https://)`;
      const urlAt = start + label.length + 3;
      return {
        text: text.slice(0, start) + ins + text.slice(end),
        start: urlAt,
        end: urlAt + 8,
      };
    }
    case "list":
    case "heading": {
      // Whole lines from the start of the first selected line
      const ls = text.lastIndexOf("\n", start - 1) + 1;
      const le = end > start && text[end - 1] === "\n" ? end - 1 : end;
      const block = text.slice(ls, le);
      const prefix = action === "list" ? "- " : "## ";
      const re = action === "list" ? /^(\s*)[-*+] / : /^#{1,6} /;
      const lines = block.split("\n");
      const all = lines.every((l) => re.test(l) || !l.trim());
      const next = lines
        .map((l) =>
          !l.trim() && lines.length > 1
            ? l
            : all
              ? l.replace(re, action === "list" ? "$1" : "")
              : action === "heading"
                ? prefix + l.replace(/^#{1,6} /, "")
                : prefix + l,
        )
        .join("\n");
      return {
        text: text.slice(0, ls) + next + text.slice(le),
        start: ls,
        end: ls + next.length,
      };
    }
  }
}

/** A standalone HTML file: the rendered Markdown with a small readable stylesheet */
export function standaloneHtml(body: string, title: string): string {
  const esc = title.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc}</title>
<style>
:root { color-scheme: light dark; --fg: #18181b; --bg: #fff; --muted: #71717a; --line: #e4e4e7; --code: #f4f4f5; --link: #7c3aed; }
@media (prefers-color-scheme: dark) { :root { --fg: #e4e4e7; --bg: #18181b; --muted: #a1a1aa; --line: #3f3f46; --code: #27272a; --link: #c4a5f5; } }
body { margin: 0 auto; max-width: 760px; padding: 32px 20px; font: 16px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--fg); background: var(--bg); }
h1, h2, h3, h4 { line-height: 1.25; margin: 1.6em 0 0.6em; }
h1, h2 { padding-bottom: 0.3em; border-bottom: 1px solid var(--line); }
a { color: var(--link); }
img { max-width: 100%; }
code, pre { font: 0.9em/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--code); border-radius: 6px; }
code { padding: 0.15em 0.35em; }
pre { padding: 14px 16px; overflow: auto; }
pre code { padding: 0; background: none; }
blockquote { margin: 0; padding: 0 1em; color: var(--muted); border-left: 4px solid var(--line); }
table { border-collapse: collapse; display: block; overflow: auto; }
th, td { padding: 6px 13px; border: 1px solid var(--line); }
th { background: var(--code); }
hr { border: 0; border-top: 1px solid var(--line); }
li:has(> input[type="checkbox"]) { list-style: none; }
li > input[type="checkbox"] { margin: 0 0.4em 0 -1.3em; }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}
