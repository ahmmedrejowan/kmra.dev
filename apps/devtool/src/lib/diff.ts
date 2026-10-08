/**
 * Text diff model for the diff checker. The line matching is jsdiff's Myers implementation
 * (`diffArrays` with a comparator, so "ignore whitespace / case" only changes what counts as
 * equal and both sides keep their own text), and changed line pairs get a word or character
 * diff on top. jsdiff is passed in so the page loads it lazily.
 */
import type * as JsDiff from "diff";

export type Granularity = "line" | "word" | "char";

export interface DiffOptions {
  granularity: Granularity;
  ignoreSpace: boolean;
  ignoreCase: boolean;
}

/** A piece of a line: plain, or changed (removed on the left, added on the right) */
export interface Seg {
  text: string;
  hit?: boolean;
}

/** One line of the diff with its line numbers (1-based) */
export interface Op {
  t: "same" | "del" | "add";
  /** Line number on the original side */
  a?: number;
  /** Line number on the changed side */
  b?: number;
  text: string;
  /** Text of the original line when it differs only in ignored ways */
  other?: string;
  segs?: Seg[];
}

export interface DiffResult {
  ops: Op[];
  added: number;
  removed: number;
  /** Index in `ops` of the first line of each change block */
  blocks: number[];
}

/** Lines of a text; a final line break doesn't add an empty line */
export function splitLines(s: string): string[] {
  if (!s) return [];
  const lines = s.replace(/\r\n?/g, "\n").split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function normalizer(o: DiffOptions) {
  return (s: string) => {
    let v = s;
    if (o.ignoreSpace) v = v.replace(/\s+/g, " ").trim();
    if (o.ignoreCase) v = v.toLowerCase();
    return v;
  };
}

export function diffTexts(
  lib: typeof JsDiff,
  a: string,
  b: string,
  o: DiffOptions,
): DiffResult {
  const A = splitLines(a);
  const B = splitLines(b);
  const norm = normalizer(o);
  const NA = A.map(norm);
  const NB = B.map(norm);
  // Compare indices so each side keeps its own text
  const ia = A.map((_, i) => i);
  const ib = B.map((_, i) => -1 - i);
  const key = (x: number) => (x >= 0 ? NA[x]! : NB[-1 - x]!);
  const parts = lib.diffArrays<number>(ia, ib, {
    comparator: (x, y) => key(x) === key(y),
  });

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  for (const p of parts) {
    const n = p.count ?? p.value.length;
    if (p.removed)
      for (let k = 0; k < n; k++, i++)
        ops.push({ t: "del", a: i + 1, text: A[i]! });
    else if (p.added)
      for (let k = 0; k < n; k++, j++)
        ops.push({ t: "add", b: j + 1, text: B[j]! });
    else
      for (let k = 0; k < n; k++, i++, j++)
        ops.push({
          t: "same",
          a: i + 1,
          b: j + 1,
          text: B[j]!,
          other: A[i] !== B[j] ? A[i] : undefined,
        });
  }

  // Changed line pairs (n-th removed line with the n-th added line) get an inline diff
  if (o.granularity !== "line") {
    let k = 0;
    while (k < ops.length) {
      if (ops[k]!.t === "same") {
        k++;
        continue;
      }
      const dels: Op[] = [];
      const adds: Op[] = [];
      while (k < ops.length && ops[k]!.t !== "same") {
        const op = ops[k++]!;
        (op.t === "del" ? dels : adds).push(op);
      }
      const pairs = Math.min(dels.length, adds.length);
      for (let p = 0; p < pairs; p++) inline(lib, dels[p]!, adds[p]!, o);
    }
  }

  let added = 0;
  let removed = 0;
  const blocks: number[] = [];
  ops.forEach((op, n) => {
    if (op.t === "add") added++;
    if (op.t === "del") removed++;
    if (op.t !== "same" && (n === 0 || ops[n - 1]!.t === "same"))
      blocks.push(n);
  });
  return { ops, added, removed, blocks };
}

function inline(lib: typeof JsDiff, del: Op, add: Op, o: DiffOptions) {
  const opts = { ignoreCase: o.ignoreCase };
  const parts =
    o.granularity === "char"
      ? lib.diffChars(del.text, add.text, opts)
      : lib.diffWordsWithSpace(del.text, add.text, opts);
  const left: Seg[] = [];
  const right: Seg[] = [];
  for (const p of parts) {
    if (p.removed) left.push({ text: p.value, hit: true });
    else if (p.added) right.push({ text: p.value, hit: true });
    else {
      left.push({ text: p.value });
      right.push({ text: p.value });
    }
  }
  // Highlighting almost everything says nothing; leave such lines plain
  const share = (s: Seg[], len: number) =>
    s.filter((x) => !x.hit).reduce((n, x) => n + x.text.length, 0) /
    Math.max(1, len);
  if (
    share(left, del.text.length) < 0.25 &&
    share(right, add.text.length) < 0.25
  )
    return;
  del.segs = left;
  add.segs = right;
}

/** Side-by-side rows: unchanged lines face each other, removed lines face added ones */
export interface SideRow {
  left?: Op;
  right?: Op;
  /** Index of the first op of this row (for "next change") */
  at: number;
}

export function sideRows(ops: Op[]): SideRow[] {
  const rows: SideRow[] = [];
  let k = 0;
  while (k < ops.length) {
    const op = ops[k]!;
    if (op.t === "same") {
      rows.push({ left: op, right: op, at: k });
      k++;
      continue;
    }
    const start = k;
    const dels: Op[] = [];
    const adds: Op[] = [];
    while (k < ops.length && ops[k]!.t !== "same") {
      const x = ops[k++]!;
      (x.t === "del" ? dels : adds).push(x);
    }
    for (let n = 0; n < Math.max(dels.length, adds.length); n++)
      rows.push({ left: dels[n], right: adds[n], at: start + n });
  }
  return rows;
}

/**
 * The diff as a unified patch (what `diff -u` and `git diff` print), with three lines of
 * context around each change.
 */
export function unifiedPatch(
  ops: Op[],
  names: [string, string] = ["original", "changed"],
  context = 3,
): string {
  if (!ops.some((o) => o.t !== "same")) return "";
  const out = [`--- ${names[0]}`, `+++ ${names[1]}`];
  let k = 0;
  while (k < ops.length) {
    // Next change
    while (k < ops.length && ops[k]!.t === "same") k++;
    if (k >= ops.length) break;
    const start = Math.max(0, k - context);
    // Extend while the gap to the next change is small enough to share context
    let end = k;
    for (;;) {
      while (end < ops.length && ops[end]!.t !== "same") end++;
      let gap = end;
      while (gap < ops.length && ops[gap]!.t === "same") gap++;
      if (gap < ops.length && gap - end <= context * 2) end = gap;
      else {
        end = Math.min(ops.length, end + context);
        break;
      }
    }
    const hunk = ops.slice(start, end);
    // Line numbers before the hunk on each side
    let aBefore = 0;
    let bBefore = 0;
    for (let n = 0; n < start; n++) {
      if (ops[n]!.t !== "add") aBefore++;
      if (ops[n]!.t !== "del") bBefore++;
    }
    const aLen = hunk.filter((o) => o.t !== "add").length;
    const bLen = hunk.filter((o) => o.t !== "del").length;
    const range = (before: number, len: number) =>
      `${len ? before + 1 : before}${len === 1 ? "" : "," + len}`;
    out.push(`@@ -${range(aBefore, aLen)} +${range(bBefore, bLen)} @@`);
    for (const o of hunk)
      out.push(
        o.t === "same"
          ? " " + (o.other ?? o.text)
          : (o.t === "del" ? "-" : "+") + o.text,
      );
    k = end;
  }
  return out.join("\n") + "\n";
}

/** JSON with every object's keys sorted, two-space indent (throws on invalid JSON) */
export function canonicalJson(text: string): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.keys(v as object)
          .sort()
          .map((k) => [k, sort((v as Record<string, unknown>)[k])]),
      );
    return v;
  };
  return JSON.stringify(sort(JSON.parse(text)), null, 2);
}
