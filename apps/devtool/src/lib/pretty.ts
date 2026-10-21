/**
 * Beautify and minify for the HTML, CSS and JavaScript formatters. Prettier and terser are big,
 * so each language loads only the parts it needs, the first time it needs them.
 */
import type { Options, Plugin } from "prettier";

export type Lang = "html" | "css" | "js" | "ts";

export interface PrettyOptions {
  printWidth: number;
  indent: 2 | 4 | "tab";
  singleQuote: boolean;
  semi: boolean;
}

async function plugins(lang: Lang): Promise<Plugin[]> {
  const mods: Promise<unknown>[] =
    lang === "css"
      ? [import("prettier/plugins/postcss")]
      : lang === "ts"
        ? [
            import("prettier/plugins/typescript"),
            import("prettier/plugins/estree"),
          ]
        : lang === "js"
          ? [
              import("prettier/plugins/babel"),
              import("prettier/plugins/estree"),
            ]
          : // HTML formats the CSS and JavaScript inside <style> and <script> too
            [
              import("prettier/plugins/html"),
              import("prettier/plugins/postcss"),
              import("prettier/plugins/babel"),
              import("prettier/plugins/estree"),
            ];
  return (await Promise.all(mods)) as Plugin[];
}

const PARSER: Record<Lang, string> = {
  html: "html",
  css: "css",
  js: "babel",
  ts: "typescript",
};

export async function beautify(
  code: string,
  lang: Lang,
  o: PrettyOptions,
): Promise<string> {
  const [{ format }, list] = await Promise.all([
    import("prettier/standalone"),
    plugins(lang),
  ]);
  const opts: Options = {
    parser: PARSER[lang],
    plugins: list,
    printWidth: o.printWidth,
    tabWidth: o.indent === "tab" ? 2 : o.indent,
    useTabs: o.indent === "tab",
    singleQuote: o.singleQuote,
    semi: o.semi,
  };
  return format(code, opts);
}

/** Start loading a language's code before the first keystroke */
export function preload(lang: Lang, minify: boolean) {
  void import("prettier/standalone");
  void plugins(lang);
  if (minify && lang === "js") void import("terser");
}

export interface CodeProblem {
  message: string;
  line?: number;
  col?: number;
}

/** Prettier and terser errors as a line, column and short message */
export function codeError(e: unknown): CodeProblem {
  const err = e as {
    message?: string;
    loc?: { start?: { line?: number; column?: number } };
    line?: number;
    col?: number;
  };
  let msg = String(err?.message ?? e).split("\n")[0]!;
  msg = msg
    .replace(/^\w*SyntaxError:\s*/, "")
    .replace(/\s*\(\d+:\d+\)\s*$/, "")
    .trim();
  if (err?.loc?.start?.line)
    return {
      message: msg,
      line: err.loc.start.line,
      col: err.loc.start.column,
    };
  // terser: 1-based line, 0-based column
  if (typeof err?.line === "number")
    return { message: msg, line: err.line, col: (err.col ?? 0) + 1 };
  return { message: msg };
}

/** JavaScript minified with terser: compress, then shorten local names */
export async function minifyJs(code: string): Promise<string> {
  const { minify } = await import("terser");
  const isModule = /^\s*(import|export)\b/m.test(code);
  const r = await minify(code, {
    module: isModule,
    compress: { passes: 2 },
    mangle: true,
    format: { comments: /^!|@license|@preserve/ },
  });
  return r.code ?? "";
}

/**
 * CSS minifier that only removes what can't matter: comments (except /*! … *\/), whitespace
 * runs, spaces around { } ; , and selector combinators, and the last ; in a block. Strings,
 * url(…) and calc(…) spacing are left as written.
 */
export function minifyCss(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  let paren = 0;
  let space = false;
  // Characters that never need a space next to them (outside brackets)
  const tight = (c: string | undefined) =>
    c !== undefined && (/[{};,]/.test(c) || (paren === 0 && /[>~+]/.test(c)));
  const emit = (s: string) => {
    const last = out[out.length - 1];
    if (
      space &&
      out &&
      !tight(last) &&
      !tight(s[0]) &&
      !(last === ":" && paren === 0 && inDecl())
    )
      out += " ";
    space = false;
    out += s;
  };
  // Inside a declaration (property: value), where the space after ":" can go
  const inDecl = () => {
    const k = Math.max(
      out.lastIndexOf("{"),
      out.lastIndexOf(";"),
      out.lastIndexOf("}"),
    );
    return (
      /^[\s]*-{0,2}[\w-]+:/.test(out.slice(k + 1)) &&
      !/^\s*@/.test(out.slice(k + 1))
    );
  };
  while (i < n) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      space = true;
      i++;
    } else if (c === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2);
      const end = e < 0 ? n : e + 2;
      if (src[i + 2] === "!") emit(src.slice(i, end));
      else space = true;
      i = end;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      emit(src.slice(i, j + 1));
      i = j + 1;
    } else if (
      /^url\(/i.test(src.slice(i, i + 4)) &&
      !/^url\(\s*["']/i.test(src.slice(i, i + 12))
    ) {
      const e = src.indexOf(")", i);
      const end = e < 0 ? n : e + 1;
      emit(
        src
          .slice(i, end)
          .replace(/^url\(\s*/i, "url(")
          .replace(/\s*\)$/, ")"),
      );
      i = end;
    } else if (c === "}") {
      if (out.endsWith(";")) out = out.slice(0, -1);
      space = false;
      out += "}";
      i++;
    } else {
      if (c === "(") paren++;
      if (c === ")") paren = Math.max(0, paren - 1);
      let j = i + 1;
      if (!/[{};,()>~+:]/.test(c))
        while (j < n && !/[\s{};,()>~+:"'/]/.test(src[j]!)) j++;
      emit(src.slice(i, j));
      i = j;
    }
  }
  return out.trim();
}

const BLOCK =
  "address|article|aside|base|blockquote|body|br|caption|col|colgroup|dd|details|dialog|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|head|header|hgroup|hr|html|legend|li|link|main|meta|nav|noscript|ol|optgroup|option|p|pre|section|summary|table|tbody|td|template|tfoot|th|thead|title|tr|ul|!doctype|script|style";
const BLOCK_RE = new RegExp(`^</?(${BLOCK})\\b`, "i");

/**
 * Conservative HTML minifier: drops comments (keeps conditional comments), collapses whitespace
 * to one space, and removes it entirely only next to block-level tags. Everything inside
 * <pre>, <textarea>, <script> and <style> is kept exactly as written.
 */
export function minifyHtml(src: string): string {
  const parts: string[] = [];
  const re =
    /(<(pre|textarea|script|style)\b[^>]*>[\s\S]*?<\/\2\s*>)|(<!--[\s\S]*?--!?>)|(<[^>]+>)|([^<]+)/gi;
  let m: RegExpExecArray | null;
  const tokens: { kind: "raw" | "tag" | "text" | "comment"; s: string }[] = [];
  while ((m = re.exec(src))) {
    if (m[1]) tokens.push({ kind: "raw", s: m[1] });
    else if (m[3]) tokens.push({ kind: "comment", s: m[3] });
    else if (m[4]) tokens.push({ kind: "tag", s: m[4] });
    else tokens.push({ kind: "text", s: m[5]! });
  }
  const blocky = (t?: { kind: string; s: string }) =>
    !t || (t.kind !== "text" && (t.kind === "comment" || BLOCK_RE.test(t.s)));
  const kept = tokens.filter(
    (t) => t.kind !== "comment" || /^<!--\[if|^<!--\s*\[endif|^<!--!/.test(t.s),
  );
  for (let k = 0; k < kept.length; k++) {
    const t = kept[k]!;
    if (t.kind === "text") {
      let s = t.s.replace(/\s+/g, " ");
      if (blocky(kept[k - 1])) s = s.replace(/^ /, "");
      if (blocky(kept[k + 1])) s = s.replace(/ $/, "");
      if (s) parts.push(s);
    } else if (t.kind === "tag") {
      // Tidy the whitespace inside the tag, outside quoted values
      parts.push(
        t.s
          .replace(
            /("[^"]*"|'[^']*')|\s+/g,
            (_x, q: string | undefined) => q ?? " ",
          )
          .replace(/\s+(\/?>)$/, "$1"),
      );
    } else parts.push(t.s);
  }
  return parts.join("").trim();
}
