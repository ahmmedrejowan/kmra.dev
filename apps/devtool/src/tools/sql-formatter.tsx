import { useEffect, useMemo, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { formatBytes } from "@kmra/ui/lib/files";
import type { ToolProps } from ".";
import {
  BarSeg,
  Pane,
  Workspace,
  textBytes,
  useInput,
  type PaneError,
} from "../lib/kit";
import {
  DIALECTS,
  countQueries,
  minifySql,
  sqlError,
  type Dialect,
} from "../lib/sql";

type Mode = "format" | "minify";
type Case = "upper" | "lower" | "preserve";
type Indent = 2 | 4 | "tab";
type Lib = typeof import("sql-formatter");

const SAMPLE = `select u.id, u.name, count(o.id) as orders, sum(o.total) as spent from users u left join orders o on o.user_id = u.id and o.status <> 'cancelled' where u.created_at >= now() - interval '30 days' and u.country in ('BD', 'IN') group by u.id, u.name having count(o.id) > 2 order by spent desc limit 20; update users set last_seen = now() where id = 42;`;

export default function SqlFormatter({ preset }: ToolProps) {
  const T = useT();
  const [input, setInput] = useInput("sql-formatter");
  const [mode, setMode] = useState<Mode>((preset?.mode as Mode) ?? "format");
  const [dialect, setDialect] = useState<Dialect>(
    (preset?.dialect as Dialect) ?? "sql",
  );
  const [kcase, setKcase] = useState<Case>("upper");
  const [indent, setIndent] = useState<Indent>(2);
  const [gap, setGap] = useState(1);
  const [lib, setLib] = useState<Lib | null>(null);

  // The formatter loads with this tool only
  useEffect(() => {
    let live = true;
    void import("sql-formatter").then((m) => live && setLib(m));
    return () => {
      live = false;
    };
  }, []);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    const min = minifySql(input);
    if (mode === "minify")
      return { ok: true as const, text: min, queries: countQueries(min) };
    if (!lib) return null;
    try {
      const text = lib.format(input, {
        language: dialect,
        keywordCase: kcase,
        dataTypeCase: kcase,
        functionCase: kcase,
        tabWidth: indent === "tab" ? 2 : indent,
        useTabs: indent === "tab",
        linesBetweenQueries: gap,
      });
      return {
        ok: true as const,
        text: text + "\n",
        queries: countQueries(min),
      };
    } catch (e) {
      return { ok: false as const, error: sqlError(e) };
    }
  }, [input, lib, mode, dialect, kcase, indent, gap]);

  const error: PaneError | null =
    result && !result.ok
      ? { ...result.error, message: T(result.error.message) }
      : null;
  const output = result?.ok ? result.text : "";
  const before = textBytes(input);
  const after = textBytes(output);

  return (
    <Workspace
      bar={
        <>
          <BarSeg<Mode>
            label={T("Mode")}
            options={[
              ["format", T("Format")],
              ["minify", T("Minify")],
            ]}
            value={mode}
            onPick={setMode}
          />
          {mode === "format" && (
            <>
              <label className="bar-item">
                <span className="bar-label">{T("Dialect")}</span>
                <select
                  className="bar-input"
                  value={dialect}
                  onChange={(e) => setDialect(e.target.value as Dialect)}
                >
                  {DIALECTS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {T(l)}
                    </option>
                  ))}
                </select>
              </label>
              <BarSeg<Case>
                label={T("Keywords")}
                options={[
                  ["upper", T("Upper case")],
                  ["lower", T("Lower case")],
                  ["preserve", T("As typed")],
                ]}
                value={kcase}
                onPick={setKcase}
              />
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
              <BarSeg<number>
                label={T("Lines between queries")}
                options={[
                  [0, "0"],
                  [1, "1"],
                  [2, "2"],
                ]}
                value={gap}
                onPick={setGap}
              />
            </>
          )}
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
        !input.trim() ? (
          <span>
            {T(
              "Paste a query to start. Formatting follows the dialect you pick.",
            )}
          </span>
        ) : !result ? (
          <span>{T("Loading the formatter…")}</span>
        ) : result.ok ? (
          <>
            <span className="ok">
              {T(result.queries === 1 ? "1 query" : "{n} queries", {
                n: result.queries,
              })}
            </span>
            <span>
              {formatBytes(before)} → {formatBytes(after)}
              {mode === "minify" && before > after
                ? ` · ${T("{n}% smaller", { n: Math.round((1 - after / before) * 100) })}`
                : ""}
            </span>
          </>
        ) : (
          <span className="bad">{T("Couldn't read this query")}</span>
        )
      }
    >
      <Pane
        label={T("SQL")}
        value={input}
        onChange={setInput}
        placeholder={T("Paste SQL here")}
        error={error}
        file=".sql,text/plain"
      />
      <Pane
        label={T(mode === "minify" ? "Minified" : "Formatted")}
        value={output}
        readOnly
        wrap={mode === "minify"}
        download={mode === "minify" ? "query.min.sql" : "query.sql"}
      />
    </Workspace>
  );
}
