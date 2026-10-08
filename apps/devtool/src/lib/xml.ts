/**
 * XML formatting without a DOM round trip: a small tokenizer keeps comments, CDATA, processing
 * instructions, the doctype and entity references exactly as written, and only changes the
 * whitespace between tags. Validation uses the browser's own XML parser (DOMParser).
 */

export type XmlToken =
  | { t: "open"; name: string; raw: string; self: boolean }
  | { t: "close"; name: string; raw: string }
  | { t: "text"; raw: string }
  | { t: "comment"; raw: string }
  | { t: "cdata"; raw: string }
  | { t: "pi"; raw: string }
  | { t: "doctype"; raw: string };

/** Split XML into tokens. Never throws: anything odd becomes text, validation reports it. */
export function tokenize(src: string): XmlToken[] {
  const out: XmlToken[] = [];
  let i = 0;
  const n = src.length;
  const until = (end: string, from: number) => {
    const j = src.indexOf(end, from);
    return j < 0 ? n : j + end.length;
  };
  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt < 0) {
      out.push({ t: "text", raw: src.slice(i) });
      break;
    }
    if (lt > i) out.push({ t: "text", raw: src.slice(i, lt) });
    i = lt;
    if (src.startsWith("<!--", i)) {
      const e = until("-->", i + 4);
      out.push({ t: "comment", raw: src.slice(i, e) });
      i = e;
    } else if (src.startsWith("<![CDATA[", i)) {
      const e = until("]]>", i + 9);
      out.push({ t: "cdata", raw: src.slice(i, e) });
      i = e;
    } else if (src.startsWith("<?", i)) {
      const e = until("?>", i + 2);
      out.push({ t: "pi", raw: src.slice(i, e) });
      i = e;
    } else if (/^<!doctype/i.test(src.slice(i, i + 9))) {
      // The doctype can carry an internal subset in [ … ]
      let j = i + 9;
      let depth = 0;
      while (j < n) {
        const c = src[j];
        if (c === "[") depth++;
        else if (c === "]") depth--;
        else if (c === ">" && depth <= 0) break;
        j++;
      }
      out.push({ t: "doctype", raw: src.slice(i, j + 1) });
      i = j + 1;
    } else if (src[i + 1] === "/") {
      const e = until(">", i);
      const raw = src.slice(i, e);
      out.push({ t: "close", name: raw.slice(2, -1).trim(), raw });
      i = e;
    } else if (/[\w:_-]/.test(src[i + 1] ?? "")) {
      // Start tag: scan to ">" outside quoted attribute values
      let j = i + 1;
      let q = "";
      while (j < n) {
        const c = src[j];
        if (q) {
          if (c === q) q = "";
        } else if (c === '"' || c === "'") q = c;
        else if (c === ">") break;
        j++;
      }
      const raw = src.slice(i, j + 1);
      const name = /^<([^\s/>]+)/.exec(raw)?.[1] ?? "";
      out.push({ t: "open", name, raw, self: /\/\s*>$/.test(raw) });
      i = j + 1;
    } else {
      out.push({ t: "text", raw: "<" });
      i++;
    }
  }
  return out;
}

/** A start tag with its attributes on one line, separated by single spaces */
function tidyTag(raw: string, self: boolean): string {
  const inner = raw.replace(/^</, "").replace(/\/?\s*>$/, "");
  const parts: string[] = [];
  const re = /\s*([^\s=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"']+))?/gy;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(inner)) && m[0]) {
    parts.push(m[2] !== undefined ? `${m[1]}=${m[2]}` : m[1]!);
    last = re.lastIndex;
  }
  if (last < inner.trimEnd().length) return raw; // couldn't read it; leave it alone
  return `<${parts.join(" ")}${self ? "/>" : ">"}`;
}

export interface XmlOptions {
  indent: string;
  /** Write <a></a> as <a/> */
  collapseEmpty: boolean;
  comments: boolean;
}

/** Pretty-print: one element per line, short text-only elements kept on one line */
export function formatXml(src: string, o: XmlOptions): string {
  const toks = tokenize(src);
  const lines: string[] = [];
  let depth = 0;
  const pad = () => o.indent.repeat(Math.max(0, depth));
  const preserve: boolean[] = [];

  for (let k = 0; k < toks.length; k++) {
    const tk = toks[k]!;
    const keep = preserve[preserve.length - 1] ?? false;
    switch (tk.t) {
      case "open": {
        const tag = tidyTag(tk.raw, tk.self);
        if (tk.self) {
          lines.push(pad() + tag);
          break;
        }
        // <a>text</a> or <a></a> stays on one line
        const nx = toks[k + 1];
        const nx2 = toks[k + 2];
        if (nx?.t === "close" && nx.name === tk.name) {
          lines.push(
            pad() +
              (o.collapseEmpty
                ? tag.replace(/>$/, "/>")
                : `${tag}</${tk.name}>`),
          );
          k += 1;
          break;
        }
        if (
          (nx?.t === "text" || nx?.t === "cdata") &&
          nx2?.t === "close" &&
          nx2.name === tk.name &&
          (nx.t === "cdata" ||
            !nx.raw.includes("\n") ||
            /xml:space\s*=\s*["']preserve/.test(tk.raw))
        ) {
          const body =
            nx.t === "text" && !/xml:space/.test(tk.raw)
              ? nx.raw.trim()
              : nx.raw;
          if (!body && o.collapseEmpty)
            lines.push(pad() + tag.replace(/>$/, "/>"));
          else lines.push(`${pad()}${tag}${body}</${tk.name}>`);
          k += 2;
          break;
        }
        lines.push(pad() + tag);
        depth++;
        preserve.push(keep || /xml:space\s*=\s*["']preserve/.test(tk.raw));
        break;
      }
      case "close":
        depth--;
        preserve.pop();
        lines.push(`${pad()}</${tk.name}>`);
        break;
      case "text": {
        if (keep) {
          if (tk.raw) lines.push(tk.raw);
          break;
        }
        const t = tk.raw.trim();
        if (!t) break;
        // Keep the text's own lines, re-indented
        for (const l of t.split("\n"))
          if (l.trim()) lines.push(pad() + l.trim());
        break;
      }
      case "comment":
        if (!o.comments) break;
        lines.push(pad() + tk.raw);
        break;
      default:
        lines.push(pad() + tk.raw);
    }
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}

/** Remove whitespace between tags (and comments if asked); text content stays as written */
export function minifyXml(
  src: string,
  o: Pick<XmlOptions, "collapseEmpty" | "comments">,
): string {
  const toks = tokenize(src);
  let out = "";
  for (let k = 0; k < toks.length; k++) {
    const tk = toks[k]!;
    if (tk.t === "text") {
      out += tk.raw.trim() ? tk.raw : "";
    } else if (tk.t === "comment") {
      if (o.comments) out += tk.raw;
    } else if (tk.t === "open") {
      const tag = tidyTag(tk.raw, tk.self);
      const nx = toks[k + 1];
      if (
        !tk.self &&
        o.collapseEmpty &&
        nx?.t === "close" &&
        nx.name === tk.name
      ) {
        out += tag.replace(/>$/, "/>");
        k++;
      } else out += tag;
    } else if (tk.t === "close") out += `</${tk.name}>`;
    else out += tk.raw;
  }
  return out;
}

export interface XmlProblem {
  message: string;
  /** Values for {placeholders} in the message */
  vars?: Record<string, string>;
  line?: number;
  col?: number;
}

let errorNs: string | null | undefined;

/** Parse with the browser's XML parser; returns the document or the first error */
export function parseXml(
  src: string,
): { doc: Document } | { error: XmlProblem } {
  const p = new DOMParser();
  if (errorNs === undefined) {
    // Browsers put <parsererror> in different namespaces; learn it from a broken document
    const bad = p.parseFromString("<", "application/xml");
    errorNs = bad.getElementsByTagName("parsererror")[0]?.namespaceURI ?? null;
  }
  const doc = p.parseFromString(src, "application/xml");
  const errEl = (
    errorNs
      ? doc.getElementsByTagNameNS(errorNs, "parsererror")
      : doc.getElementsByTagName("parsererror")
  )[0];
  if (!errEl) return { doc };
  return { error: readError(errEl.textContent ?? "") };
}

/** Chrome/Safari (libxml2) and Firefox word their errors differently */
function readError(text: string): XmlProblem {
  let line: number | undefined;
  let col: number | undefined;
  let msg = text;
  const chrome = /error on line (\d+) at column (\d+):\s*([^\n]+)/i.exec(text);
  const ff = /Line Number (\d+), Column (\d+)/i.exec(text);
  if (chrome) {
    line = +chrome[1]!;
    col = +chrome[2]!;
    msg = chrome[3]!;
  } else if (ff) {
    line = +ff[1]!;
    col = +ff[2]!;
    msg = (/XML Parsing Error:\s*([^\n]+)/i.exec(text)?.[1] ?? text).trim();
  }
  msg = msg.replace(/Below is a rendering of the page.*$/s, "").trim();
  return { ...plain(msg), line, col };
}

/** The parser's usual messages in plain words (English; the tool translates them) */
function plain(m: string): { message: string; vars?: Record<string, string> } {
  const say = (message: string, vars?: Record<string, string>) => ({
    message,
    vars,
  });
  const close = /Unexpected closing tag: (\S+) != (\S+)/i.exec(m);
  if (close)
    return say("The closing tag </{a}> doesn't match the open tag <{b}>.", {
      a: close[1]!,
      b: close[2]!,
    });
  if (/tag mismatch|mismatched tag/i.test(m))
    return say("A closing tag doesn't match the tag it closes.");
  if (/no root element|Document is empty/i.test(m))
    return say("There's no XML here yet.");
  if (
    /outside the root element|Extra content at the end|junk after document element/i.test(
      m,
    )
  )
    return say(
      "There's content outside the root element. XML has exactly one root element.",
    );
  if (/end of stream|Premature end|unclosed token/i.test(m))
    return say("The XML ends too early. A tag isn't closed.");
  if (/entity/i.test(m))
    return say(
      "A bare & isn't allowed. Write &amp; instead, or close the entity with a semicolon.",
    );
  if (/redefined|duplicate attribute/i.test(m))
    return say("An attribute appears twice on the same tag.");
  if (/AttValue|attributes construct/i.test(m))
    return say('An attribute value needs quotes, like name="value".');
  if (/qualified name|invalid element name/i.test(m))
    return say(
      "A tag name is invalid. Tag names start with a letter or underscore.",
    );
  if (/Couldn't find end of Start Tag/i.test(m))
    return say("A tag isn't closed with >.");
  if (/prefix .*(not defined|unbound)|unbound prefix/i.test(m))
    return say("A namespace prefix is used without being declared.");
  const tok = /Unexpected token: (.*)$/i.exec(m);
  if (tok)
    return say("This isn't expected here: {t}", { t: tok[1]!.trim() || "␠" });
  return say(m);
}
/** Elements and depth, for the status line */
export function xmlStats(doc: Document) {
  let elements = 0;
  let depth = 0;
  const walk = (el: Element, d: number) => {
    elements++;
    depth = Math.max(depth, d);
    for (const c of Array.from(el.children)) walk(c, d + 1);
  };
  if (doc.documentElement) walk(doc.documentElement, 1);
  return { elements, depth, root: doc.documentElement?.nodeName ?? "" };
}
