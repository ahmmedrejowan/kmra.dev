import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { formatBytes } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import type { ToolProps } from ".";
import { BarCheck, BarSeg, Pane, Workspace, type PaneError } from "../lib/kit";
import { takeText } from "../lib/handoff";
import { takeFiles } from "@kmra/ui/lib/handoff";
import { lineCol } from "../lib/encode";
import { jsonError } from "../lib/json";
import {
  CsvError,
  detectDelimiter,
  headerNames,
  jsonToRows,
  parseCsv,
  rowsToJson,
  toCsv,
  type Cell,
  type Delim,
} from "../lib/csv";

type From = "csv" | "json" | "excel";
type Out = "json" | "csv";

interface Book {
  name: string;
  size: number;
  sheets: { name: string; rows: Cell[][] }[];
}

const PREVIEW = 200;
/** Parse a spreadsheet in a worker (see xlsx.worker.ts); null if it can't be read. */
function readBook(
  buf: Uint8Array,
): Promise<{ name: string; rows: unknown[][] }[] | null> {
  return new Promise((resolve) => {
    const w = new Worker(new URL("../lib/xlsx.worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = (
      e: MessageEvent<{
        ok: boolean;
        sheets?: { name: string; rows: unknown[][] }[];
      }>,
    ) => {
      w.terminate();
      resolve(e.data.ok ? e.data.sheets! : null);
    };
    w.onerror = () => {
      w.terminate();
      resolve(null);
    };
    w.postMessage(buf, [buf.buffer]);
  });
}

const EXCEL = /\.(xlsx|xlsm|xlsb|xls|ods|fods)$/i;

const SAMPLE_CSV = `id,name,city,joined,active
1,Ada Lovelace,London,2024-01-15,true
2,"Hopper, Grace",New York,2024-02-03,false
3,Linus,"Helsinki
Finland",2024-03-21,true`;

const SAMPLE_JSON = `[
  { "id": 1, "name": "Ada", "address": { "city": "London", "zip": "N1" }, "tags": ["math", "code"] },
  { "id": 2, "name": "Grace, Admiral", "address": { "city": "New York" }, "active": true }
]`;

const DELIM_NAMES: [Delim, string][] = [
  [",", "Comma"],
  ["\t", "Tab"],
  [";", "Semicolon"],
  ["|", "Pipe"],
];

function guess(text: string): From {
  return /^\s*[[{]/.test(text) ? "json" : "csv";
}

function excelCell(v: unknown): Cell {
  if (v === undefined || v === null) return null;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "string")
    return v;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export default function CsvJson({ preset }: ToolProps) {
  const T = useT();
  const [from, setFrom] = useState<From>(
    (["csv", "json", "excel"] as const).find((f) => f === preset?.from) ??
      "csv",
  );
  const [input, setInputRaw] = useState("");
  const [book, setBook] = useState<Book | null>(null);
  const [sheet, setSheet] = useState<number>(0); // -1 = all sheets
  const [loading, setLoading] = useState(false);
  const [delimIn, setDelimIn] = useState<Delim | "auto">("auto");
  const [delimOut, setDelimOut] = useState<Delim>(",");
  const [header, setHeader] = useState(true);
  const [infer, setInfer] = useState(true);
  const [out, setOut] = useState<Out>("json");
  const fileRef = useRef<HTMLInputElement>(null);

  function setInput(v: string) {
    setInputRaw(v);
    if (v.trim()) {
      setBook(null);
      setFrom(guess(v));
    }
  }

  // Text from the home page's smart paste box, or a file dropped on kmra.dev
  useEffect(() => {
    const t = takeText("csv-json");
    if (t !== null) return setInput(t);
    void takeFiles().then((files) => files[0] && open(files[0]));
  }, []);

  // Files can be dropped anywhere on the page
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const f = e.dataTransfer?.files[0];
      if (!f) return;
      e.preventDefault();
      void open(f);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  });

  async function open(f: File) {
    const buf = new Uint8Array(await f.arrayBuffer());
    // Excel files are zip (xlsx, ods) or OLE (xls) containers
    const zip = buf[0] === 0x50 && buf[1] === 0x4b;
    const ole = buf[0] === 0xd0 && buf[1] === 0xcf;
    if (EXCEL.test(f.name) || zip || ole) {
      setLoading(true);
      try {
        // SheetJS is large and parses untrusted files: it runs in a worker, loaded only now
        const read = await readBook(buf);
        if (!read) throw new Error("unreadable");
        const sheets = read.map((sh) => ({
          name: sh.name,
          rows: sh.rows.map((r) => r.map(excelCell)),
        }));
        setBook({ name: f.name, size: f.size, sheets });
        setSheet(0);
        setInputRaw("");
        setFrom("excel");
      } catch {
        toast(
          T("Couldn't read this spreadsheet. Try saving it as .xlsx or CSV."),
        );
      } finally {
        setLoading(false);
      }
      return;
    }
    setInput(new TextDecoder().decode(buf));
  }

  const result = useMemo(() => {
    if (from === "excel") {
      if (!book) return null;
      const opts = { header, infer };
      const pick = sheet === -1 ? book.sheets : [book.sheets[sheet]!];
      const first = pick[0]!;
      const table = first.rows;
      let text: string;
      if (out === "json")
        text = JSON.stringify(
          sheet === -1
            ? Object.fromEntries(
                book.sheets.map((s) => [s.name, rowsToJson(s.rows, opts)]),
              )
            : rowsToJson(first.rows, opts),
          null,
          2,
        );
      else text = toCsv(table, delimOut);
      return {
        ok: true as const,
        text,
        head: header && table[0] ? headerNames(table[0]) : null,
        rows: header ? table.slice(1) : table,
        delim: null,
        uneven: 0,
      };
    }
    if (!input.trim()) return null;
    if (from === "csv") {
      const delim = delimIn === "auto" ? detectDelimiter(input) : delimIn;
      try {
        const rows = parseCsv(input, delim);
        const json = rowsToJson(rows, { header, infer });
        const width = rows[0]?.length ?? 0;
        return {
          ok: true as const,
          text: JSON.stringify(json, null, 2),
          head: header && rows[0] ? headerNames(rows[0]) : null,
          rows: header ? rows.slice(1) : rows,
          delim,
          uneven: rows.filter((r) => r.length !== width).length,
        };
      } catch (e) {
        if (!(e instanceof CsvError)) throw e;
        return {
          ok: false as const,
          error: { message: T(e.message), ...lineCol(input, e.index) },
        };
      }
    }
    try {
      const v = JSON.parse(input) as unknown;
      if (v === null || typeof v !== "object")
        return {
          ok: false as const,
          error: { message: T("Use an array of objects, or one object.") },
        };
      const { head, rows } = jsonToRows(v);
      return {
        ok: true as const,
        text: toCsv(header ? [head, ...rows] : rows, delimOut),
        head,
        rows,
        delim: null,
        uneven: 0,
      };
    } catch (e) {
      const err = jsonError(input, e);
      return {
        ok: false as const,
        error: { ...err, message: T(err.message) },
      };
    }
  }, [from, input, book, sheet, delimIn, delimOut, header, infer, out]);

  const error: PaneError | null = result && !result.ok ? result.error : null;
  const output = result?.ok ? result.text : "";
  const outKind: Out = from === "csv" ? "json" : from === "json" ? "csv" : out;
  const base =
    from === "excel" && book
      ? book.name.replace(/\.[^.]+$/, "") +
        (sheet === -1 ? "" : `-${book.sheets[sheet]!.name}`)
      : "data";
  const dataRows = result?.ok ? result.rows.length : 0;
  const cols = result?.ok
    ? Math.max(result.head?.length ?? 0, ...result.rows.map((r) => r.length))
    : 0;

  function swap() {
    if (!result?.ok || from === "excel") return;
    setInputRaw(result.text);
    setFrom(from === "csv" ? "json" : "csv");
  }

  return (
    <Workspace
      cols={3}
      bar={
        <>
          <BarSeg<From>
            label={T("From")}
            options={[
              ["csv", "CSV"],
              ["json", "JSON"],
              ["excel", "Excel"],
            ]}
            value={from}
            onPick={(f) => {
              setFrom(f);
              if (f === "excel" && !book) fileRef.current?.click();
            }}
          />
          {from === "csv" && (
            <BarSeg<Delim | "auto">
              label={T("Delimiter")}
              options={[
                ["auto", T("Detect")],
                ...DELIM_NAMES.map(([d, n]) => [d, T(n)] as [Delim, string]),
              ]}
              value={delimIn}
              onPick={setDelimIn}
            />
          )}
          {from === "excel" && book && (
            <>
              <label className="bar-item">
                <span className="bar-label">{T("Sheet")}</span>
                <select
                  className="bar-input"
                  value={sheet}
                  onChange={(e) => setSheet(Number(e.target.value))}
                >
                  {book.sheets.map((s, i) => (
                    <option key={s.name} value={i}>
                      {s.name}
                    </option>
                  ))}
                  {book.sheets.length > 1 && out === "json" && (
                    <option value={-1}>{T("All sheets")}</option>
                  )}
                </select>
              </label>
              <BarSeg<Out>
                label={T("Output")}
                options={[
                  ["json", "JSON"],
                  ["csv", "CSV"],
                ]}
                value={out}
                onPick={(o) => {
                  setOut(o);
                  if (o === "csv" && sheet === -1) setSheet(0);
                }}
              />
            </>
          )}
          {outKind === "csv" && (
            <BarSeg<Delim>
              label={T("CSV delimiter")}
              options={DELIM_NAMES.map(([d, n]) => [d, T(n)])}
              value={delimOut}
              onPick={setDelimOut}
            />
          )}
          <BarCheck label={T("Header row")} on={header} onChange={setHeader} />
          {outKind === "json" && (
            <BarCheck
              label={T("Detect numbers and true/false")}
              on={infer}
              onChange={setInfer}
            />
          )}
          {result?.ok && from !== "excel" && (
            <button type="button" className="btn xs" onClick={swap}>
              <Icon name="convert" />
              {T("Swap")}
            </button>
          )}
          {!input && !book && from !== "excel" && (
            <button
              type="button"
              className="btn xs bar-push"
              onClick={() =>
                setInput(from === "json" ? SAMPLE_JSON : SAMPLE_CSV)
              }
            >
              {T("Try a sample")}
            </button>
          )}
        </>
      }
      status={
        loading ? (
          <span>{T("Reading the spreadsheet…")}</span>
        ) : !result ? (
          <span>
            {from === "excel"
              ? T("Open or drop an .xlsx, .xls or .ods file.")
              : from === "json"
                ? T("Paste a JSON array of objects to get CSV.")
                : T("Paste CSV or open a file. The delimiter is detected.")}
          </span>
        ) : result.ok ? (
          <>
            <span className="ok">
              {T("{r} rows, {c} columns", { r: dataRows, c: cols })}
            </span>
            {result.delim && (
              <span>
                {T("Delimiter: {d}", {
                  d: T(DELIM_NAMES.find(([d]) => d === result.delim)![1]),
                })}
              </span>
            )}
            {result.uneven > 0 && (
              <span className="bad">
                {T("{n} rows have a different number of fields", {
                  n: result.uneven,
                })}
              </span>
            )}
            {dataRows > PREVIEW && (
              <span>
                {T("Preview shows the first {n} rows", { n: PREVIEW })}
              </span>
            )}
          </>
        ) : (
          <span className="bad">
            {from === "csv" ? T("Not valid CSV") : T("Invalid JSON")}
          </span>
        )
      }
    >
      <Pane
        label={
          from === "json" ? "JSON" : from === "excel" ? T("Spreadsheet") : "CSV"
        }
        value={input}
        onChange={setInput}
        error={error}
        placeholder={
          from === "json"
            ? T("Paste JSON here")
            : T("Paste CSV here, or open a CSV or Excel file")
        }
        actions={
          <>
            <button
              type="button"
              className="btn xs"
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload" />
              {T("Open file")}
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".csv,.tsv,.txt,.json,.xlsx,.xlsm,.xlsb,.xls,.ods,text/csv,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void open(f);
              }}
            />
          </>
        }
      >
        {from === "excel" ? (
          <div className="enc-file">
            <Icon name="table" />
            {book ? (
              <>
                <strong>{book.name}</strong>
                <span className="muted">
                  {formatBytes(book.size)} ·{" "}
                  {T("{n} sheets", { n: book.sheets.length })}
                </span>
                <button
                  type="button"
                  className="btn xs"
                  onClick={() => {
                    setBook(null);
                    setFrom("csv");
                  }}
                >
                  {T("Remove file")}
                </button>
              </>
            ) : (
              <>
                <strong>
                  {loading
                    ? T("Reading the spreadsheet…")
                    : T("Open an Excel or OpenDocument file")}
                </strong>
                <span className="muted">
                  {T(
                    "The file is read in your browser and stays on your device.",
                  )}
                </span>
                <button
                  type="button"
                  className="btn acc sm"
                  disabled={loading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Icon name="upload" />
                  {T("Open file")}
                </button>
              </>
            )}
          </div>
        ) : undefined}
      </Pane>
      <Pane
        label={outKind === "json" ? "JSON" : "CSV"}
        value={output}
        readOnly
        download={`${base}.${outKind}`}
      />
      <Pane label={T("Table preview")} value="" readOnly>
        <div className="dev-table-wrap">
          {result?.ok && (result.rows.length || result.head) ? (
            <table className="dev-table">
              {result.head && (
                <thead>
                  <tr>
                    <th className="n">#</th>
                    {result.head.map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {result.rows.slice(0, PREVIEW).map((r, i) => (
                  <tr key={i}>
                    <td className="n">{i + 1}</td>
                    {Array.from({ length: cols }, (_, j) => {
                      const c = r[j];
                      return (
                        <td
                          key={j}
                          className={
                            c === null || c === undefined
                              ? "nil"
                              : typeof c === "number"
                                ? "num"
                                : undefined
                          }
                        >
                          {c === null || c === undefined ? "" : String(c)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="dev-rows-empty">{T("The table appears here.")}</div>
          )}
        </div>
      </Pane>
    </Workspace>
  );
}
