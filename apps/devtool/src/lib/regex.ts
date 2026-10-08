/**
 * Regex tester helpers: the worker's message types, a small tokenizer that explains a pattern
 * part by part (English keys; the page translates them), ready patterns and a cheat sheet.
 */

export interface RegexJob {
  id: number;
  pattern: string;
  flags: string;
  text: string;
  /** Replacement string, or null when not replacing */
  replace: string | null;
}

export interface RxGroup {
  n: number;
  value: string | undefined;
  /** Start and end, with the d flag */
  span?: [number, number];
}

export interface RxMatch {
  index: number;
  end: number;
  text: string;
  groups: RxGroup[];
  named: { name: string; value: string | undefined }[];
}

export type RegexResult =
  | {
      id: number;
      ok: true;
      matches: RxMatch[];
      /** Stopped at the match limit */
      capped: boolean;
      replaced: string | null;
      ms: number;
    }
  | { id: number; ok: false; error: string };

export const FLAGS: { f: string; name: string }[] = [
  { f: "g", name: "Global: find every match, not just the first" },
  { f: "i", name: "Ignore case" },
  { f: "m", name: "Multiline: ^ and $ match at each line" },
  { f: "s", name: "Dot matches line breaks too" },
  { f: "u", name: "Unicode: code points and \\p{…} classes" },
  { f: "y", name: "Sticky: match only where the last match ended" },
  { f: "d", name: "Indices: report where each group starts and ends" },
  { f: "v", name: "Unicode sets: like u, with set operations in [ ]" },
];

export interface ReadyPattern {
  name: string;
  pattern: string;
  flags: string;
}

export const READY: ReadyPattern[] = [
  {
    name: "Email",
    pattern: String.raw`[\w.+-]+@[\w-]+(?:\.[\w-]+)+`,
    flags: "g",
  },
  { name: "URL", pattern: String.raw`https?:\/\/[^\s/?#]+[^\s]*`, flags: "gi" },
  {
    name: "IPv4",
    pattern: String.raw`\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b`,
    flags: "g",
  },
  {
    name: "Date (YYYY-MM-DD)",
    pattern: String.raw`(?<year>\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\d|3[01])`,
    flags: "g",
  },
  {
    name: "Hex color",
    pattern: String.raw`#(?:[0-9a-fA-F]{3}){1,2}\b`,
    flags: "g",
  },
];

export const SAMPLE_TEXT = `Write to ada@example.com or grace.hopper@example.org.
Docs live at https://example.com/docs?page=2 and http://example.org.
Servers: 192.0.2.10, 198.51.100.7 and 999.1.1.1 (not an address).
Released 2026-03-14, patched 2026-10-08.
Colours: #8e4ec6, #fff and #12345 (too short).`;

export const CHEATSHEET: [string, string][] = [
  [".", "Any character except a line break"],
  [String.raw`\d`, "A digit, 0 to 9"],
  [String.raw`\w`, "A letter, digit or underscore"],
  [String.raw`\s`, "Whitespace"],
  [String.raw`\D \W \S`, "Not a digit, word character or whitespace"],
  ["[abc]", "One of a, b or c"],
  ["[^abc]", "Any character except a, b or c"],
  ["[a-z]", "A character from a to z"],
  ["^ $", "Start and end of the text (or line with m)"],
  [String.raw`\b`, "A word boundary"],
  ["*", "Zero or more times"],
  ["+", "One or more times"],
  ["?", "Optional"],
  ["{2,5}", "Between 2 and 5 times"],
  ["*? +?", "As few times as possible"],
  ["(…)", "Capture a group"],
  ["(?<name>…)", "A named group"],
  ["(?:…)", "Group without capturing"],
  ["a|b", "a or b"],
  ["(?=…) (?!…)", "Followed by, not followed by"],
  ["(?<=…) (?<!…)", "Preceded by, not preceded by"],
  [String.raw`\1 \k<name>`, "The same text a group matched"],
  ["$1 $<name>", "A group in the replacement"],
  ["$& $$", "The whole match, a dollar sign (replacement)"],
];

/** One explained part of the pattern. `key` and `q` are English; `vars` fill their {placeholders}. */
export interface Part {
  code: string;
  key: string;
  vars?: Record<string, string | number>;
  /** Quantifier wording, e.g. "one or more times" */
  q?: { key: string; vars?: Record<string, string | number>; lazy?: boolean };
  depth: number;
  literal?: boolean;
}

const ESCAPES: Record<string, string> = {
  d: "A digit (0–9)",
  D: "Any character that isn't a digit",
  w: "A word character (letter, digit or underscore)",
  W: "Any character that isn't a word character",
  s: "Whitespace (space, tab, line break)",
  S: "Any character that isn't whitespace",
  b: "A word boundary",
  B: "Not a word boundary",
  n: "A line break",
  r: "A carriage return",
  t: "A tab",
  f: "A form feed",
  v: "A vertical tab",
  "0": "A null character",
};

/** Read an escape at s[i] === "\\"; returns its length and meaning */
function escape(
  s: string,
  i: number,
): { len: number; key: string; vars?: Part["vars"]; char?: string } {
  const c = s[i + 1];
  if (c === undefined)
    return { len: 1, key: "A backslash at the end (incomplete)" };
  if (ESCAPES[c] && c !== "0") return { len: 2, key: ESCAPES[c]! };
  if (c === "0" && !/[0-9]/.test(s[i + 2] ?? ""))
    return { len: 2, key: ESCAPES["0"]! };
  if (/[1-9]/.test(c)) {
    const n = /^\d+/.exec(s.slice(i + 1))![0];
    return {
      len: 1 + n.length,
      key: "The same text that group {n} matched",
      vars: { n },
    };
  }
  if (c === "k" && s[i + 2] === "<") {
    const end = s.indexOf(">", i + 3);
    if (end > 0)
      return {
        len: end - i + 1,
        key: "The same text that the group “{name}” matched",
        vars: { name: s.slice(i + 3, end) },
      };
  }
  if ((c === "p" || c === "P") && s[i + 2] === "{") {
    const end = s.indexOf("}", i + 3);
    if (end > 0)
      return {
        len: end - i + 1,
        key:
          c === "p"
            ? "A character with the Unicode property {p}"
            : "A character without the Unicode property {p}",
        vars: { p: s.slice(i + 3, end) },
      };
  }
  if (c === "x" && /^[0-9a-f]{2}/i.test(s.slice(i + 2, i + 4))) {
    const h = s.slice(i + 2, i + 4);
    return {
      len: 4,
      key: "The character {c} (code {h})",
      vars: {
        c: String.fromCharCode(parseInt(h, 16)),
        h: "U+" + h.toUpperCase().padStart(4, "0"),
      },
      char: String.fromCharCode(parseInt(h, 16)),
    };
  }
  if (c === "u") {
    const m = /^u\{([0-9a-f]{1,6})\}|^u([0-9a-f]{4})/i.exec(s.slice(i + 1));
    if (m) {
      const h = (m[1] ?? m[2])!;
      const ch = String.fromCodePoint(parseInt(h, 16));
      return {
        len: 1 + m[0].length,
        key: "The character {c} (code {h})",
        vars: { c: ch, h: "U+" + h.toUpperCase().padStart(4, "0") },
        char: ch,
      };
    }
  }
  if (c === "c" && /[a-z]/i.test(s[i + 2] ?? ""))
    return {
      len: 3,
      key: "The control character Ctrl+{c}",
      vars: { c: s[i + 2]!.toUpperCase() },
    };
  // An escaped symbol stands for itself
  return { len: 2, key: "", char: c };
}

/** Describe a character class body (between [ and ]) as a short list */
function describeClass(body: string): string {
  const out: string[] = [];
  let i = 0;
  const read = (): { text: string; len: number } => {
    if (body[i] === "\\") {
      // Shorthands like \d stay as written; escaped symbols show as themselves
      const e = escape(body, i);
      return { text: e.char ?? body.slice(i, i + e.len), len: e.len };
    }
    return { text: body[i]!, len: 1 };
  };
  while (i < body.length) {
    const a = read();
    if (body[i + a.len] === "-" && i + a.len + 1 < body.length) {
      const save = i;
      i += a.len + 1;
      const b = read();
      out.push(`${a.text}–${b.text}`);
      i += b.len;
      if (save === i) break;
    } else {
      out.push(a.text === " " ? "␣" : a.text);
      i += a.len;
    }
  }
  return out.join(", ");
}

/** Find the ] that closes the class opened at s[i] === "[" (classes nest only with v) */
function classEnd(s: string, i: number, sets: boolean): number {
  let depth = 1;
  for (let k = i + 1; k < s.length; k++) {
    if (s[k] === "\\") k++;
    else if (s[k] === "[" && sets) depth++;
    else if (s[k] === "]" && --depth === 0) return k;
  }
  return -1;
}

const QUANT = /^(?:[*+?]|\{(\d+)(,(\d*))?\})(\?)?/;

function quant(m: RegExpExecArray): Part["q"] {
  const lazy = !!m[4];
  let q: NonNullable<Part["q"]>;
  if (m[0].startsWith("*")) q = { key: "zero or more times" };
  else if (m[0].startsWith("+")) q = { key: "one or more times" };
  else if (m[0].startsWith("?")) q = { key: "optional (zero or one time)" };
  else if (m[2] === undefined)
    q = { key: "exactly {n} times", vars: { n: m[1]! } };
  else if (!m[3]) q = { key: "{n} or more times", vars: { n: m[1]! } };
  else q = { key: "{n} to {m} times", vars: { n: m[1]!, m: m[3] } };
  return { ...q, lazy };
}

/**
 * Split a pattern into explained parts, in order. It reads tokens one by one; it doesn't work
 * out what the pattern as a whole matches.
 */
export function explain(pattern: string, flags: string): Part[] {
  const parts: Part[] = [];
  const sets = flags.includes("v");
  let depth = 0;
  let group = 0;
  let i = 0;
  const push = (p: Omit<Part, "depth">) => parts.push({ ...p, depth });
  const literal = (code: string, ch: string) => {
    const last = parts[parts.length - 1];
    if (last?.literal && !last.q && last.depth === depth) {
      last.code += code;
      last.vars = { t: String(last.vars!.t) + ch };
    } else
      push({ code, key: "The text “{t}”", vars: { t: ch }, literal: true });
  };

  while (i < pattern.length) {
    const c = pattern[i]!;
    // A quantifier applies to the part before it
    const qm = QUANT.exec(pattern.slice(i));
    if (qm && (c !== "{" || parts.length)) {
      let last = parts[parts.length - 1];
      if (
        last &&
        !last.q &&
        !last.key.startsWith("Start of") &&
        last.key !== "Or"
      ) {
        // In a run of text, only the last character repeats
        if (last.literal && String(last.vars!.t).length > 1) {
          const t = [...String(last.vars!.t)];
          const ch = t.pop()!;
          last.vars = { t: t.join("") };
          last.code = last.code.slice(
            0,
            last.code.length - (last.code.endsWith(ch) ? ch.length : 0),
          );
          push({
            code: ch,
            key: "The text “{t}”",
            vars: { t: ch },
            literal: true,
          });
          last = parts[parts.length - 1]!;
        }
        last.code += qm[0];
        last.q = quant(qm);
        i += qm[0].length;
        continue;
      }
      if (c !== "{") {
        push({
          code: qm[0],
          key: "A quantifier with nothing before it (invalid)",
        });
        i += qm[0].length;
        continue;
      }
    }
    if (c === "\\") {
      const e = escape(pattern, i);
      const code = pattern.slice(i, i + e.len);
      if (!e.key) literal(code, e.char!);
      else push({ code, key: e.key, vars: e.vars });
      i += e.len;
      continue;
    }
    if (c === "[") {
      const end = classEnd(pattern, i, sets);
      if (end < 0) {
        push({
          code: pattern.slice(i),
          key: "A character class that isn't closed",
        });
        break;
      }
      const neg = pattern[i + 1] === "^";
      const body = pattern.slice(i + (neg ? 2 : 1), end);
      push({
        code: pattern.slice(i, end + 1),
        key: !body
          ? neg
            ? "Any character"
            : "Nothing (an empty class never matches)"
          : neg
            ? "Any character except: {list}"
            : "One character from: {list}",
        vars: { list: describeClass(body) },
      });
      i = end + 1;
      continue;
    }
    if (c === "(") {
      const rest = pattern.slice(i);
      let m: RegExpExecArray | null;
      if (rest.startsWith("(?:")) {
        push({ code: "(?:", key: "Start of a group (not captured)" });
        i += 3;
      } else if (rest.startsWith("(?=")) {
        push({ code: "(?=", key: "Start of a lookahead: followed by" });
        i += 3;
      } else if (rest.startsWith("(?!")) {
        push({
          code: "(?!",
          key: "Start of a negative lookahead: not followed by",
        });
        i += 3;
      } else if (rest.startsWith("(?<=")) {
        push({ code: "(?<=", key: "Start of a lookbehind: preceded by" });
        i += 4;
      } else if (rest.startsWith("(?<!")) {
        push({
          code: "(?<!",
          key: "Start of a negative lookbehind: not preceded by",
        });
        i += 4;
      } else if ((m = /^\(\?<([A-Za-z_$][\w$]*)>/.exec(rest))) {
        group++;
        push({
          code: m[0],
          key: "Start of group {n}, named “{name}”",
          vars: { n: group, name: m[1]! },
        });
        i += m[0].length;
      } else if ((m = /^\(\?([a-z]*)(?:-([a-z]+))?:/.exec(rest))) {
        push({
          code: m[0],
          key: "Start of a group with flags changed ({f})",
          vars: { f: m[0].slice(2, -1) },
        });
        i += m[0].length;
      } else {
        group++;
        push({
          code: "(",
          key: "Start of group {n} (captured)",
          vars: { n: group },
        });
        i += 1;
      }
      depth++;
      continue;
    }
    if (c === ")") {
      depth = Math.max(0, depth - 1);
      push({ code: ")", key: "End of the group" });
      i++;
      continue;
    }
    if (c === "|") {
      push({ code: "|", key: "Or" });
      i++;
      continue;
    }
    if (c === "^") {
      push({
        code: "^",
        key: flags.includes("m") ? "Start of a line" : "Start of the text",
      });
      i++;
      continue;
    }
    if (c === "$") {
      push({
        code: "$",
        key: flags.includes("m") ? "End of a line" : "End of the text",
      });
      i++;
      continue;
    }
    if (c === ".") {
      push({
        code: ".",
        key: flags.includes("s")
          ? "Any character, line breaks included"
          : "Any character except a line break",
      });
      i++;
      continue;
    }
    const ch = String.fromCodePoint(pattern.codePointAt(i)!);
    literal(ch, ch);
    i += ch.length;
  }
  return parts;
}

/** Escape text for an HTML-free highlight split: [plain, match, plain, match, …] */
export function splitByMatches(
  text: string,
  matches: { index: number; end: number }[],
): { text: string; m?: number }[] {
  const out: { text: string; m?: number }[] = [];
  let at = 0;
  matches.forEach((m, n) => {
    if (m.index < at) return;
    if (m.index > at) out.push({ text: text.slice(at, m.index) });
    out.push({ text: text.slice(m.index, m.end), m: n });
    at = m.end;
  });
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
