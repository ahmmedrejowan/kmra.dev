/**
 * Line tools: one pipeline of line operations, plus text counts.
 * Order: split → trim → remove empty → remove duplicates → sort/reverse/shuffle → number →
 * prefix/suffix → join.
 */
import { randomInt } from "./random";

export type Order =
  "none" | "az" | "za" | "natural" | "length" | "reverse" | "shuffle";

export interface LineOptions {
  order: Order;
  trim: boolean;
  dropEmpty: boolean;
  dedupe: boolean;
  ignoreCase: boolean;
  number: boolean;
  prefix: string;
  suffix: string;
  /** Split the text into lines at this separator as well (escapes like \t allowed) */
  splitBy: string;
  /** Join the lines with this instead of line breaks */
  joinWith: string;
}

/** "\n", "\t" and "\\" typed into a field mean a line break, a tab and a backslash */
export function unescape(s: string): string {
  return s.replace(/\\([nt\\r])/g, (_, c: string) =>
    c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : "\\",
  );
}

export function processLines(
  text: string,
  o: LineOptions,
  /** Changes when the user asks for a new shuffle */
  shuffleRound = 0,
): { text: string; lines: number; removed: number } {
  if (!text) return { text: "", lines: 0, removed: 0 };
  let lines = text.replace(/\r\n?/g, "\n").split("\n");
  // A final line break isn't an empty line of its own
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  const split = unescape(o.splitBy);
  if (split) lines = lines.flatMap((l) => l.split(split));
  if (o.trim) lines = lines.map((l) => l.trim());
  if (o.dropEmpty) lines = lines.filter((l) => l.trim() !== "");
  let removed = 0;
  if (o.dedupe) {
    const seen = new Set<string>();
    const before = lines.length;
    lines = lines.filter((l) => {
      const k = o.ignoreCase ? l.toLocaleLowerCase() : l;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    removed = before - lines.length;
  }
  const sensitivity = o.ignoreCase ? "base" : "variant";
  const plain = new Intl.Collator(undefined, { sensitivity });
  const natural = new Intl.Collator(undefined, { sensitivity, numeric: true });
  switch (o.order) {
    case "az":
      lines = [...lines].sort(plain.compare);
      break;
    case "za":
      lines = [...lines].sort((a, b) => plain.compare(b, a));
      break;
    case "natural":
      lines = [...lines].sort(natural.compare);
      break;
    case "length":
      lines = [...lines].sort(
        (a, b) => [...a].length - [...b].length || plain.compare(a, b),
      );
      break;
    case "reverse":
      lines = [...lines].reverse();
      break;
    case "shuffle": {
      void shuffleRound;
      lines = [...lines];
      for (let i = lines.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [lines[i], lines[j]] = [lines[j]!, lines[i]!];
      }
      break;
    }
  }
  if (o.number) {
    const w = String(lines.length).length;
    lines = lines.map((l, i) => `${String(i + 1).padStart(w, " ")}. ${l}`);
  }
  const pre = unescape(o.prefix);
  const suf = unescape(o.suffix);
  if (pre || suf) lines = lines.map((l) => pre + l + suf);
  const join = o.joinWith ? unescape(o.joinWith) : "\n";
  return { text: lines.join(join), lines: lines.length, removed };
}

export interface Counts {
  chars: number;
  charsNoSpaces: number;
  words: number;
  lines: number;
  sentences: number;
  paragraphs: number;
  /** Minutes at 200 words a minute */
  readMinutes: number;
}

export function countText(text: string): Counts {
  const chars = [...text].length;
  const charsNoSpaces = [...text.replace(/\s/g, "")].length;
  const words = (text.match(/[\p{L}\p{N}]+(?:['’\-.][\p{L}\p{N}]+)*/gu) ?? [])
    .length;
  const lines = text
    ? text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n").length
    : 0;
  const sentences = text.trim()
    ? (text.match(/[^.!?।\n]*[\p{L}\p{N}][^.!?।\n]*(?:[.!?।]+|\n|$)/gu) ?? [])
        .length
    : 0;
  const paragraphs = text.trim()
    ? text.split(/\n\s*\n/).filter((p) => p.trim()).length
    : 0;
  return {
    chars,
    charsNoSpaces,
    words,
    lines,
    sentences,
    paragraphs,
    readMinutes: words / 200,
  };
}
