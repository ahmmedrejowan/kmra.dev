import { useEffect, useMemo, useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import { BarCheck, BarField, BarSeg, Pane, Workspace } from "../lib/kit";
import { Rows, type Row } from "../lib/rows";
import { inspectId, ulid, uuidV4, uuidV7 } from "../lib/random";

type Kind = "v4" | "v7" | "ulid";

const MAX = 1000;

function make(kind: Kind, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++)
    out.push(kind === "v4" ? uuidV4() : kind === "v7" ? uuidV7() : ulid());
  return out;
}

function clampCount(raw: string): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.min(MAX, Math.max(1, n)) : 1;
}

const VERSION_NAMES: Record<number, string> = {
  1: "Time and MAC address",
  2: "DCE security",
  3: "Name-based, MD5",
  4: "Random",
  5: "Name-based, SHA-1",
  6: "Reordered time",
  7: "Unix time and random",
  8: "Custom",
};

export default function UuidTool({ preset }: ToolProps) {
  const T = useT();
  const lang = useLang();
  const initial = (["v4", "v7", "ulid"] as const).find(
    (k) => k === preset?.version,
  );
  const [kind, setKind] = useState<Kind>(initial ?? "v4");
  const [countRaw, setCountRaw] = useState("10");
  const [upper, setUpper] = useState(false);
  const [noDashes, setNoDashes] = useState(false);
  const [braces, setBraces] = useState(false);
  const [round, setRound] = useState(0);
  const [inspect, setInspect] = useState("");
  const count = clampCount(countRaw);

  // IDs are random, so they're made in the browser only (after hydration)
  useEffect(() => setRound(1), []);
  const raw = useMemo(
    () => (round ? make(kind, count) : []),
    [kind, count, round],
  );
  const ids = useMemo(
    () =>
      raw.map((id) => {
        if (kind === "ulid") return id;
        let s = noDashes ? id.replace(/-/g, "") : id;
        if (upper) s = s.toUpperCase();
        return braces ? `{${s}}` : s;
      }),
    [raw, kind, upper, noDashes, braces],
  );
  const rows: Row[] = ids.map((v, i) => ({ id: String(i), value: v }));
  const all = ids.join("\n");

  const info = inspect.trim() ? inspectId(inspect) : null;
  const fmtTime = (ms: number) => {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.toISOString()} · ${d.toLocaleString(lang === "bn" ? "bn-BD" : undefined)}`;
  };
  const details: Row[] = info
    ? [
        {
          id: "type",
          label: T("Type"),
          value:
            info.kind === "ulid"
              ? "ULID"
              : info.special === "nil"
                ? T("Nil UUID (all zeros)")
                : info.special === "max"
                  ? T("Max UUID (all ones)")
                  : `UUID v${info.version}`,
          noCopy: true,
        },
        ...(info.version
          ? [
              {
                id: "version",
                label: T("Version"),
                value: `${info.version} · ${T(VERSION_NAMES[info.version] ?? "Unknown")}`,
                noCopy: true,
              },
            ]
          : []),
        ...(info.variant
          ? [
              {
                id: "variant",
                label: T("Variant"),
                value: info.variant,
                noCopy: true,
              },
            ]
          : []),
        { id: "canonical", label: T("Standard form"), value: info.canonical },
        ...(info.time !== undefined
          ? [
              { id: "time", label: T("Created"), value: fmtTime(info.time) },
              { id: "ms", label: T("Unix ms"), value: String(info.time) },
            ]
          : []),
      ]
    : [];

  return (
    <Workspace
      bar={
        <>
          <BarSeg<Kind>
            label={T("Type")}
            options={[
              ["v4", "UUID v4"],
              ["v7", "UUID v7"],
              ["ulid", "ULID"],
            ]}
            value={kind}
            onPick={setKind}
          />
          <BarField
            label={T("How many")}
            type="number"
            min={1}
            max={MAX}
            value={countRaw}
            onChange={setCountRaw}
          />
          {kind !== "ulid" && (
            <>
              <BarCheck label={T("Uppercase")} on={upper} onChange={setUpper} />
              <BarCheck
                label={T("No dashes")}
                on={noDashes}
                onChange={setNoDashes}
              />
              <BarCheck label={T("Braces")} on={braces} onChange={setBraces} />
            </>
          )}
          <button
            type="button"
            className="btn xs bar-push"
            onClick={() => setRound((r) => r + 1)}
          >
            <Icon name="shuffle" />
            {T("Make new ones")}
          </button>
        </>
      }
      status={
        <>
          <span>
            {T(ids.length === 1 ? "{n} ID" : "{n} IDs", { n: ids.length })}
          </span>
          <span>
            {kind === "v4"
              ? T("v4 is fully random.")
              : kind === "v7"
                ? T("v7 starts with the time, so new IDs sort after old ones.")
                : T("ULIDs start with the time and sort in order.")}
          </span>
        </>
      }
    >
      <Pane
        label={kind === "ulid" ? "ULID" : "UUID"}
        value={all}
        readOnly
        download={kind === "ulid" ? "ulids.txt" : "uuids.txt"}
      >
        <div className="dev-list">
          <Rows rows={rows} numbered />
        </div>
      </Pane>
      <Pane label={T("Inspect an ID")} value={inspect} onChange={setInspect}>
        <div className="dev-list">
          <div className="dev-form">
            <input
              className="dev-input mono"
              value={inspect}
              placeholder={T("Paste a UUID or ULID")}
              aria-label={T("Inspect an ID")}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setInspect(e.target.value)}
            />
          </div>
          {inspect.trim() && !info ? (
            <p className="dev-note bad" role="alert">
              {T("This isn't a UUID or a ULID.")}
            </p>
          ) : info ? (
            <Rows rows={details} />
          ) : (
            <p className="dev-note">
              {T(
                "See the version and variant of any UUID, and the time inside v7 UUIDs and ULIDs.",
              )}
            </p>
          )}
        </div>
      </Pane>
    </Workspace>
  );
}
