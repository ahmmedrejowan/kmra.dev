import { useEffect, useMemo, useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { useT } from "@kmra/ui/lib/i18n-react";
import { formatBytes } from "@kmra/ui/lib/files";
import type { ToolProps } from ".";
import {
  BarCheck,
  BarField,
  BarSeg,
  Pane,
  Workspace,
  textBytes,
} from "../lib/kit";
import {
  FIELDS,
  formatRows,
  makeRows,
  sqlName,
  type FieldKind,
  type Format,
} from "../lib/fake";

const DEFAULT: FieldKind[] = [
  "id",
  "first_name",
  "last_name",
  "email",
  "company",
  "city",
  "date",
];
const EXT: Record<Format, string> = {
  json: "json",
  csv: "csv",
  sql: "sql",
  ts: "ts",
};
function randomSeed() {
  return Array.from(crypto.getRandomValues(new Uint32Array(2)), (x) =>
    x.toString(36),
  ).join("");
}

export default function FakeData({ preset }: ToolProps) {
  const T = useT();
  const [kinds, setKinds] = useState<FieldKind[]>(DEFAULT);
  const [countRaw, setCountRaw] = useState("10");
  const [format, setFormat] = useState<Format>(
    (["json", "csv", "sql", "ts"] as const).find((f) => f === preset?.format) ??
      "json",
  );
  const [table, setTable] = useState("users");
  const [seeded, setSeeded] = useState(false);
  const [seed, setSeed] = useState("kmra");
  const [dates, setDates] = useState<"past" | "future">("past");
  const [minRaw, setMinRaw] = useState("1");
  const [maxRaw, setMaxRaw] = useState("100");
  // Random data is made in the browser only (after hydration)
  const [auto, setAuto] = useState<string | null>(null);
  useEffect(() => setAuto(randomSeed()), []);

  const n = Math.floor(Number(countRaw));
  const count = Number.isFinite(n) ? Math.min(1000, Math.max(1, n)) : 1;
  const min = Number.isFinite(Number(minRaw)) ? Math.round(Number(minRaw)) : 0;
  const max = Number.isFinite(Number(maxRaw)) ? Math.round(Number(maxRaw)) : 0;
  const useSeed = seeded ? seed : auto;

  const text = useMemo(() => {
    if (useSeed === null || !kinds.length) return "";
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const rows = makeRows(kinds, count, useSeed, { dates, min, max, today });
    return formatRows(rows, kinds, format, table);
  }, [kinds, count, useSeed, dates, min, max, format, table]);

  function toggle(k: FieldKind, on: boolean) {
    // Keep the list's order whatever order fields are picked in
    setKinds((ks) =>
      FIELDS.map((f) => f.kind).filter((x) => (x === k ? on : ks.includes(x))),
    );
  }

  return (
    <Workspace
      bar={
        <>
          <BarField
            label={T("Rows")}
            type="number"
            min={1}
            max={1000}
            width={72}
            value={countRaw}
            onChange={setCountRaw}
          />
          <BarSeg<Format>
            label={T("Format")}
            options={[
              ["json", "JSON"],
              ["csv", "CSV"],
              ["sql", "SQL"],
              ["ts", "TypeScript"],
            ]}
            value={format}
            onPick={setFormat}
          />
          {(format === "sql" || format === "ts") && (
            <BarField
              label={T("Table name")}
              value={table}
              onChange={setTable}
              width={110}
            />
          )}
          <BarCheck
            label={T("Repeatable (seed)")}
            on={seeded}
            onChange={setSeeded}
          />
          {seeded ? (
            <BarField
              label={T("Seed")}
              value={seed}
              onChange={setSeed}
              width={100}
            />
          ) : (
            <button
              type="button"
              className="btn xs bar-push"
              onClick={() => setAuto(randomSeed())}
            >
              <Icon name="shuffle" />
              {T("Make new data")}
            </button>
          )}
        </>
      }
      status={
        !kinds.length ? (
          <span>{T("Pick at least one field.")}</span>
        ) : (
          <>
            <span className="ok">
              {count === 1 ? T("1 row") : T("{n} rows", { n: count })},{" "}
              {kinds.length === 1
                ? T("1 field")
                : T("{n} fields", { n: kinds.length })}
            </span>
            <span>{formatBytes(textBytes(text))}</span>
            {format === "sql" && (
              <span>{T("Table {t}", { t: sqlName(table) })}</span>
            )}
            <span>
              {T(
                "Made-up values: emails on example.com, phones in 555-01xx, documentation IP ranges.",
              )}
            </span>
          </>
        )
      }
    >
      <section className="pane">
        <header className="pane-head">
          <span className="pane-label">{T("Fields")}</span>
          <span className="pane-acts">
            <button
              type="button"
              className="btn xs"
              onClick={() => setKinds(FIELDS.map((f) => f.kind))}
            >
              {T("All")}
            </button>
            <button
              type="button"
              className="btn xs"
              onClick={() => setKinds([])}
            >
              {T("None")}
            </button>
          </span>
        </header>
        <div className="dev-list fake-fields">
          {FIELDS.map((f) => {
            const on = kinds.includes(f.kind);
            return (
              <div key={f.kind} className={`fake-field${on ? " on" : ""}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => toggle(f.kind, e.target.checked)}
                  />
                  <span>{T(f.label)}</span>
                  <code>{f.kind}</code>
                </label>
                {on && f.kind === "date" && (
                  <div className="seg sm" role="group" aria-label={T("Dates")}>
                    {(
                      [
                        ["past", T("Past 2 years")],
                        ["future", T("Next 2 years")],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={dates === v}
                        onClick={() => setDates(v)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )}
                {on && f.kind === "number" && (
                  <span className="fake-range">
                    <input
                      className="bar-input"
                      type="number"
                      value={minRaw}
                      onChange={(e) => setMinRaw(e.target.value)}
                      aria-label={T("Smallest number")}
                    />
                    <span>{T("to")}</span>
                    <input
                      className="bar-input"
                      type="number"
                      value={maxRaw}
                      onChange={(e) => setMaxRaw(e.target.value)}
                      aria-label={T("Largest number")}
                    />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <Pane
        label={T("Data")}
        value={text}
        readOnly
        download={`${format === "ts" ? "data" : "test-data"}.${EXT[format]}`}
      />
    </Workspace>
  );
}
