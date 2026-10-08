import { useEffect, useState } from "react";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import { BarSeg, Pane, Workspace, useInput } from "../lib/kit";
import { Rows, type Row } from "../lib/rows";
import {
  dayOfYear,
  iso,
  isoWeek,
  localInput,
  parseTime,
  partsIn,
  relative,
  rfc2822,
  zoneToUtc,
  type Unit,
} from "../lib/time";

const UNIT_NAMES: Record<Unit | "date", string> = {
  s: "seconds",
  ms: "milliseconds",
  us: "microseconds",
  ns: "nanoseconds",
  date: "a date",
};

function zones(): string[] {
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  let all: string[] = [];
  try {
    all = Intl.supportedValuesOf("timeZone");
  } catch {}
  return [...new Set([here, "UTC", ...all])];
}

export default function TimestampTool({ preset }: ToolProps) {
  const T = useT();
  const lang = useLang();
  const loc = lang === "bn" ? "bn-BD" : undefined;
  const [input, setInput] = useInput("timestamp");
  const [force, setForce] = useState<Unit | "auto">(
    (["s", "ms", "us", "ns"] as const).find((u) => u === preset?.unit) ??
      "auto",
  );
  const [tz, setTz] = useState("UTC");
  const [tzList, setTzList] = useState<string[]>(["UTC"]);
  // The clock only runs in the browser (the server can't know "now")
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const list = zones();
    setTzList(list);
    setTz(list[0]!);
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const parsed = parseTime(input, force);
  const ms = parsed ? parsed.ms : input.trim() ? null : now;
  const p = ms === null ? null : partsIn(ms, tz);

  const rows: Row[] =
    ms === null || !p
      ? []
      : [
          {
            id: "local",
            label: T("In {zone}", { zone: tz.replace(/_/g, " ") }),
            value: new Intl.DateTimeFormat(loc, {
              dateStyle: "full",
              timeStyle: "long",
              timeZone: tz,
            }).format(ms),
          },
          {
            id: "utc",
            label: "UTC",
            value: new Intl.DateTimeFormat(loc, {
              dateStyle: "full",
              timeStyle: "long",
              timeZone: "UTC",
            }).format(ms),
          },
          { id: "iso", label: T("ISO 8601 (UTC)"), value: iso(ms, "UTC") },
          ...(tz !== "UTC"
            ? [
                {
                  id: "iso-zone",
                  label: T("ISO 8601 (zone)"),
                  value: iso(ms, tz),
                },
              ]
            : []),
          { id: "rfc", label: "RFC 2822", value: rfc2822(ms, tz) },
          {
            id: "relative",
            label: T("Relative"),
            value: now === null ? "" : relative(ms, now, loc),
          },
          {
            id: "day",
            label: T("Day of the week"),
            value: new Intl.DateTimeFormat(loc, {
              weekday: "long",
              timeZone: tz,
            }).format(ms),
          },
          {
            id: "week",
            label: T("Week"),
            value: (() => {
              const w = isoWeek(p);
              return T("Week {w} of {y}, day {d} of the year", {
                w: w.week,
                y: w.year,
                d: dayOfYear(p),
              });
            })(),
          },
          {
            id: "s",
            label: T("Unix seconds"),
            value: String(Math.floor(ms / 1000)),
          },
          {
            id: "ms",
            label: T("Unix milliseconds"),
            value: String(Math.round(ms)),
          },
        ];

  function setFromWall(v: string) {
    const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?/.exec(v);
    if (!m) return;
    const [y, mo, d, h, mi, s = "0"] = m.slice(1).map(Number) as number[];
    const t = zoneToUtc(
      { y: y!, mo: mo!, d: d!, h: h!, mi: mi!, s: s as number },
      tz,
    );
    setInput(parsed?.unit === "ms" ? String(t) : String(Math.floor(t / 1000)));
  }

  return (
    <Workspace
      bar={
        <>
          <BarSeg<Unit | "auto">
            label={T("Unit")}
            options={[
              ["auto", T("Detect")],
              ["s", T("Seconds")],
              ["ms", T("Milliseconds")],
              ["us", "µs"],
              ["ns", "ns"],
            ]}
            value={force}
            onPick={setForce}
          />
          <label className="bar-item">
            <span className="bar-label">{T("Time zone")}</span>
            <select
              className="bar-input"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
            >
              {tzList.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn xs bar-push"
            onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}
          >
            {T("Use the current time")}
          </button>
        </>
      }
      status={
        !input.trim() ? (
          <span>
            {T("Showing the current time. Paste a timestamp to convert it.")}
          </span>
        ) : parsed ? (
          <span className="ok">
            {parsed.unit === "date"
              ? T("Read as a date")
              : T("Read as {unit}", { unit: T(UNIT_NAMES[parsed.unit]) })}
            {force === "auto" && parsed.unit !== "date"
              ? " · " + T("{n} digits", { n: parsed.digits })
              : ""}
          </span>
        ) : (
          <span className="bad">
            {T("This isn't a timestamp or a date JavaScript can read.")}
          </span>
        )
      }
    >
      <Pane label={T("Timestamp")} value={input} onChange={setInput}>
        <div className="dev-list">
          <div className="dev-form">
            <label className="dev-field">
              <span>{T("Unix timestamp or date")}</span>
              <input
                className="dev-input mono"
                value={input}
                inputMode="text"
                placeholder="1700000000"
                aria-label={T("Timestamp")}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setInput(e.target.value)}
              />
            </label>
            <label className="dev-field">
              <span>
                {T("Or pick a date and time ({zone})", {
                  zone: tz.replace(/_/g, " "),
                })}
              </span>
              <input
                className="dev-input"
                type="datetime-local"
                step={1}
                value={p ? localInput(p) : ""}
                aria-label={T("Date and time")}
                onChange={(e) => setFromWall(e.target.value)}
              />
            </label>
          </div>
          {now !== null && (
            <Rows
              rows={[
                {
                  id: "now-s",
                  label: T("Now, seconds"),
                  value: String(Math.floor(now / 1000)),
                },
                {
                  id: "now-ms",
                  label: T("Now, milliseconds"),
                  value: String(now),
                },
              ]}
            />
          )}
          <p className="dev-note">
            {T(
              "Ten digits are seconds, thirteen milliseconds, sixteen microseconds and nineteen nanoseconds. ISO dates like 2024-05-01T12:00Z work too.",
            )}
          </p>
        </div>
      </Pane>
      <Pane
        label={T("Converted")}
        value={rows.map((r) => `${r.label}: ${r.value}`).join("\n")}
        readOnly
      >
        <div className="dev-list">
          <Rows rows={rows} />
        </div>
      </Pane>
    </Workspace>
  );
}
