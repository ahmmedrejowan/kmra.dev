/**
 * SQL helpers for the SQL formatter: the dialect list, a whitespace and comment minifier that
 * leaves strings and quoted names alone, and parse errors as a line and column.
 */

export const DIALECTS = [
  ["sql", "Standard SQL"],
  ["postgresql", "PostgreSQL"],
  ["mysql", "MySQL"],
  ["mariadb", "MariaDB"],
  ["sqlite", "SQLite"],
  ["transactsql", "T-SQL (SQL Server)"],
  ["bigquery", "BigQuery"],
  ["snowflake", "Snowflake"],
  ["plsql", "Oracle PL/SQL"],
] as const;

export type Dialect = (typeof DIALECTS)[number][0];

/**
 * One line of SQL: comments dropped, whitespace collapsed, spaces around commas and brackets
 * removed. Text inside quotes (strings, "names", `names`, [names], $$ bodies $$) is untouched.
 */
export function minifySql(src: string): string {
  let out = "";
  let space = false;
  let i = 0;
  const n = src.length;
  const tight = (c: string | undefined) =>
    c !== undefined && /[,()=;<>]/.test(c);
  const emit = (s: string) => {
    if (space && out && !tight(out[out.length - 1]) && !tight(s[0])) out += " ";
    space = false;
    out += s;
  };
  while (i < n) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      space = true;
      i++;
    } else if (c === "-" && src[i + 1] === "-") {
      const e = src.indexOf("\n", i);
      i = e < 0 ? n : e;
      space = true;
    } else if (
      c === "#" &&
      /^#\s/.test(src.slice(i, i + 2)) &&
      /(^|\n)\s*$/.test(src.slice(0, i))
    ) {
      // MySQL line comments only at the start of a line, so #temp tables survive
      const e = src.indexOf("\n", i);
      i = e < 0 ? n : e;
      space = true;
    } else if (c === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2);
      // Keep optimizer hints (/*+ … */) and MySQL version comments (/*! … */)
      const keep = src[i + 2] === "+" || src[i + 2] === "!";
      const end = e < 0 ? n : e + 2;
      if (keep) emit(src.slice(i, end));
      else space = true;
      i = end;
    } else if (c === "'" || c === '"' || c === "`") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\" && c !== '"') j += 2;
        else if (src[j] === c) {
          if (src[j + 1] === c) j += 2;
          else break;
        } else j++;
      }
      emit(src.slice(i, j + 1));
      i = j + 1;
    } else if (c === "[" && /^\[[^\]\n]*\]/.test(src.slice(i))) {
      const e = src.indexOf("]", i);
      emit(src.slice(i, e + 1));
      i = e + 1;
    } else if (c === "$" && /^\$\w*\$/.test(src.slice(i))) {
      const tag = /^\$\w*\$/.exec(src.slice(i))![0];
      const e = src.indexOf(tag, i + tag.length);
      const end = e < 0 ? n : e + tag.length;
      emit(src.slice(i, end));
      i = end;
    } else {
      let j = i + 1;
      if (!tight(c)) while (j < n && !/[\s'"`$\[,()=;<>-]/.test(src[j]!)) j++;
      // "-" alone (minus) is its own token; "--" was handled above
      emit(src.slice(i, j));
      i = j;
    }
  }
  return out.trim();
}

/** sql-formatter's parse errors carry "line L column C" */
export function sqlError(e: unknown): {
  message: string;
  line?: number;
  col?: number;
} {
  const raw = e instanceof Error ? e.message : String(e);
  const m = /line (\d+) column (\d+)/i.exec(raw);
  return {
    message: /Parse error/i.test(raw)
      ? "Something here doesn't fit this dialect. Check the marked line, or pick another dialect."
      : raw.split("\n")[0]!,
    line: m ? +m[1]! : undefined,
    col: m ? +m[2]! : undefined,
  };
}

/** Number of statements, roughly (semicolons outside strings, plus a last one without) */
export function countQueries(min: string): number {
  let n = 0;
  let q = "";
  for (let i = 0; i < min.length; i++) {
    const c = min[i]!;
    if (q) {
      if (c === q) q = "";
    } else if (c === "'" || c === '"' || c === "`") q = c;
    else if (c === ";") n++;
  }
  return n + (/;\s*$/.test(min) || !min.trim() ? 0 : 1);
}
