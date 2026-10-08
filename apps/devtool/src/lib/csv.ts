/**
 * CSV and tables: an RFC 4180 parser (quoted fields, "" escapes, line breaks inside quotes,
 * CRLF), delimiter detection, rows ↔ JSON with optional type inference, and JSON → CSV with
 * nested objects flattened into dotted keys. Messages are English; the tool translates them.
 */

export type Cell = string | number | boolean | null;

export class CsvError extends Error {
  index: number;
  constructor(message: string, index: number) {
    super(message);
    this.index = index;
  }
}

export const DELIMS = [",", "\t", ";", "|"] as const;
export type Delim = (typeof DELIMS)[number];

/** Picks the delimiter that splits the first lines into the most, and most even, columns */
export function detectDelimiter(text: string): Delim {
  const lines: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length && lines.length < 20; i++) {
    const c = text[i]!;
    if (c === '"') {
      q = !q;
      continue;
    }
    if (q) continue;
    if (c === "\n" || c === "\r") {
      if (cur) lines.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur) lines.push(cur);
  let best: Delim = ",";
  let score = 0;
  for (const d of DELIMS) {
    const counts = lines.map((l) => l.split(d).length - 1);
    if (!counts.length || counts[0] === 0) continue;
    const same = counts.filter((n) => n === counts[0]).length / counts.length;
    const s = counts[0]! * same;
    if (s > score) {
      score = s;
      best = d;
    }
  }
  return best;
}

/** Parses CSV text into rows of strings */
export function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  const n = text.length;
  // A byte order mark from Excel exports isn't part of the first header
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  let quotedAt = -1;
  while (i < n) {
    const c = text[i]!;
    if (quotedAt >= 0) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quotedAt = -1;
        i++;
        // Only a delimiter or a line break may follow a closing quote
        const nx = text[i];
        if (nx !== undefined && nx !== delim && nx !== "\n" && nx !== "\r")
          throw new CsvError(
            "A closing quote must be followed by a delimiter or a line break.",
            i,
          );
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field === "") {
      quotedAt = i;
      i++;
      continue;
    }
    if (c === delim) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += c;
    i++;
  }
  if (quotedAt >= 0)
    throw new CsvError("A quoted field isn't closed.", quotedAt);
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines carry no data
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

const NUM = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

/** "42" → 42, "true" → true, "null" → null; anything else stays text (so "007" keeps its zeros) */
export function inferCell(v: Cell): Cell {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (NUM.test(t)) {
    const x = Number(t);
    if (Number.isFinite(x) && (Number.isSafeInteger(x) || !/^-?\d+$/.test(t)))
      return x;
    return v;
  }
  if (t === "true" || t === "TRUE") return true;
  if (t === "false" || t === "FALSE") return false;
  if (t === "null" || t === "NULL") return null;
  return v;
}

/** Header names, with blanks and repeats made unique */
export function headerNames(row: Cell[]): string[] {
  const seen = new Map<string, number>();
  return row.map((h, i) => {
    let name = h === null || h === "" ? `column${i + 1}` : String(h).trim();
    const k = seen.get(name) ?? 0;
    seen.set(name, k + 1);
    if (k) name = `${name}_${k + 1}`;
    return name;
  });
}

/** Rows → JSON value: objects keyed by the header row, or arrays of cells */
export function rowsToJson(
  rows: Cell[][],
  opts: { header: boolean; infer: boolean },
): unknown[] {
  const cell = (v: Cell | undefined) =>
    v === undefined ? null : opts.infer ? inferCell(v) : v;
  if (!opts.header) return rows.map((r) => r.map(cell));
  const [head, ...body] = rows;
  if (!head) return [];
  const names = headerNames(head);
  return body.map((r) => {
    const o: Record<string, Cell> = {};
    const width = Math.max(names.length, r.length);
    for (let i = 0; i < width; i++) {
      const k = names[i] ?? `column${i + 1}`;
      o[k] = cell(r[i] ?? (opts.infer ? undefined : ""));
    }
    return o;
  });
}

function flatten(v: unknown, prefix: string, out: Record<string, Cell>) {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const entries = Object.entries(v);
    if (!entries.length && prefix) out[prefix] = "{}";
    for (const [k, x] of entries)
      flatten(x, prefix ? `${prefix}.${k}` : k, out);
  } else if (Array.isArray(v)) out[prefix || "value"] = JSON.stringify(v);
  else out[prefix || "value"] = (v ?? null) as Cell;
}

/** JSON → a table: header row + rows. Nested objects become dotted keys, arrays JSON text. */
export function jsonToRows(value: unknown): { head: string[]; rows: Cell[][] } {
  const list = Array.isArray(value) ? value : [value];
  // An array of arrays is already a table
  if (list.length && list.every(Array.isArray)) {
    const rows = (list as unknown[][]).map((r) =>
      r.map((x) =>
        x !== null && typeof x === "object" ? JSON.stringify(x) : (x as Cell),
      ),
    );
    const w = Math.max(0, ...rows.map((r) => r.length));
    return {
      head: Array.from({ length: w }, (_, i) => `column${i + 1}`),
      rows,
    };
  }
  const flat = list.map((x) => {
    const o: Record<string, Cell> = {};
    flatten(x, "", o);
    return o;
  });
  const head: string[] = [];
  const seen = new Set<string>();
  for (const o of flat)
    for (const k of Object.keys(o))
      if (!seen.has(k)) {
        seen.add(k);
        head.push(k);
      }
  return {
    head,
    rows: flat.map((o) => head.map((k) => (k in o ? o[k]! : null))),
  };
}

function quote(v: Cell, delim: string): string {
  if (v === null) return "";
  const s = String(v);
  return s.includes(delim) || /["\r\n]/.test(s) || /^\s|\s$/.test(s)
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function toCsv(rows: Cell[][], delim: string, eol = "\n"): string {
  return rows.map((r) => r.map((c) => quote(c, delim)).join(delim)).join(eol);
}
