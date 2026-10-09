import { useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import {
  CalcCard,
  Choice,
  Field,
  Hero,
  How,
  NumField,
  Stats,
  Waiting,
  pre,
  useCheck,
  useFmt,
  usePlural,
} from "../lib/ui";
import { hms, parseClock, parseDuration, parts } from "../lib/time";

type Mode = "add" | "between";
interface Line {
  id: number;
  sign: 1 | -1;
  text: string;
}

export default function TimeCalculator({ preset }: ToolProps) {
  const T = useT();
  const f = useFmt();
  const P = usePlural();
  const check = useCheck();
  const [mode, setMode] = useState<Mode>(pre(preset?.mode, "add") as Mode);
  const next = useRef(3);
  const [lines, setLines] = useState<Line[]>([
    { id: 1, sign: 1, text: "2:45" },
    { id: 2, sign: 1, text: "1:30" },
  ]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:30");
  const [brk, setBrk] = useState("0");

  const set = (id: number, l: Partial<Line>) =>
    setLines(lines.map((x) => (x.id === id ? { ...x, ...l } : x)));

  let result = <Waiting>{T("Type a time, like 2:45 or 1h 30m.")}</Waiting>;
  let how = null;

  /** "4 hours 15 minutes" */
  const words = (sec: number) => {
    const p = parts(sec);
    const bits = [
      p.d ? P(p.d, "{n} day", "{n} days") : "",
      p.h ? P(p.h, "{n} hour", "{n} hours") : "",
      p.m ? P(p.m, "{n} minute", "{n} minutes") : "",
      p.s ? P(p.s, "{n} second", "{n} seconds") : "",
    ].filter(Boolean);
    return bits.length ? bits.join(" ") : P(0, "{n} minute", "{n} minutes");
  };

  const [k, brkErr] = check(brk, { min: 0, integer: true });
  const errors: Record<number, string | null> = {};
  if (mode === "add") {
    let total = 0;
    let ok = true;
    let any = false;
    for (const l of lines) {
      const v = parseDuration(l.text);
      if (v === null) continue;
      if (Number.isNaN(v)) {
        errors[l.id] = T("Write it like 2:45, 2h 45m or 90m.");
        ok = false;
        continue;
      }
      any = true;
      total += l.sign * v;
    }
    if (ok && any) {
      result = (
        <>
          <Hero
            label={T("Total")}
            value={f.d(hms(total))}
            raw={total}
            sub={(total < 0 ? "−" : "") + words(total)}
          />
          <Stats
            rows={[
              {
                id: "hours",
                label: T("In hours"),
                value: f.n(total / 3600, 4),
                raw: total / 3600,
              },
              {
                id: "minutes",
                label: T("In minutes"),
                value: f.n(total / 60, 2),
                raw: total / 60,
              },
              ...(Math.abs(total) >= 86400
                ? [
                    {
                      id: "days",
                      label: T("In days and hours"),
                      value: words(total),
                    },
                  ]
                : []),
            ]}
          />
        </>
      );
      how = (
        <p>
          {lines
            .filter((l) => parseDuration(l.text) !== null)
            .map(
              (l, i) =>
                `${i === 0 ? (l.sign < 0 ? "−" : "") : l.sign < 0 ? " − " : " + "}${f.d(hms(parseDuration(l.text)!))}`,
            )
            .join("")}{" "}
          = <b>{f.d(hms(total))}</b>
        </p>
      );
    }
  } else {
    const a = parseClock(start);
    const b = parseClock(end);
    if (a === null || b === null)
      result = <Waiting>{T("Pick a start and an end time.")}</Waiting>;
    else if (!brkErr) {
      const overnight = b < a;
      const mins = (overnight ? b + 1440 : b) - a - (k ?? 0);
      if (mins < 0)
        result = (
          <Waiting>{T("The break is longer than the time between.")}</Waiting>
        );
      else {
        result = (
          <>
            <Hero
              label={
                overnight
                  ? T("Time between (past midnight)")
                  : T("Time between")
              }
              value={f.d(hms(mins * 60))}
              raw={mins}
              sub={words(mins * 60)}
            />
            <Stats
              rows={[
                {
                  id: "hours",
                  label: T("In hours"),
                  value: f.n(mins / 60, 4),
                  raw: mins / 60,
                },
                {
                  id: "minutes",
                  label: T("In minutes"),
                  value: f.int(mins),
                  raw: mins,
                },
              ]}
            />
          </>
        );
        how = (
          <p>
            {f.d(end)}
            {overnight ? ` (${T("next day")})` : ""} − {f.d(start)}
            {k ? ` − ${P(k, "{n} minute", "{n} minutes")}` : ""} ={" "}
            <b>{f.d(hms(mins * 60))}</b>
          </p>
        );
      }
    }
  }

  return (
    <CalcCard
      bar={
        <Choice
          label={T("What to do")}
          hideLabel
          value={mode}
          onPick={setMode}
          options={[
            ["add", T("Add and subtract times")],
            ["between", T("Time between two times")],
          ]}
        />
      }
      result={result}
      below={how && <How>{how}</How>}
    >
      {mode === "add" ? (
        <>
          <ol className="calc-list" aria-label={T("Times")}>
            {lines.map((l, i) => (
              <li key={l.id}>
                <div className="calc-line">
                  <div
                    className="seg"
                    role="group"
                    aria-label={T("Add or subtract")}
                  >
                    <button
                      type="button"
                      aria-pressed={l.sign === 1}
                      aria-label={T("Add")}
                      onClick={() => set(l.id, { sign: 1 })}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      aria-pressed={l.sign === -1}
                      aria-label={T("Subtract")}
                      onClick={() => set(l.id, { sign: -1 })}
                    >
                      −
                    </button>
                  </div>
                  <span className={`calc-input${errors[l.id] ? " bad" : ""}`}>
                    <input
                      name={`t${i}`}
                      value={l.text}
                      inputMode="text"
                      autoComplete="off"
                      placeholder="1:30"
                      aria-label={T("Time {n}", { n: f.d(i + 1) })}
                      aria-invalid={!!errors[l.id]}
                      onChange={(e) => set(l.id, { text: e.target.value })}
                    />
                  </span>
                  <button
                    type="button"
                    className="calc-iconbtn"
                    aria-label={T("Remove")}
                    title={T("Remove")}
                    disabled={lines.length <= 1}
                    onClick={() => setLines(lines.filter((x) => x.id !== l.id))}
                  >
                    <Icon name="x" />
                  </button>
                </div>
                {errors[l.id] && (
                  <span className="calc-msg">{errors[l.id]}</span>
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="btn sm calc-add"
            onClick={() =>
              setLines([...lines, { id: next.current++, sign: 1, text: "" }])
            }
          >
            <Icon name="plus" />
            {T("Add a time")}
          </button>
          <p className="calc-note">
            {T("Write times as 2:45, 1:30:15, 2h 45m, 90m or 1.5 (hours).")}
          </p>
        </>
      ) : (
        <>
          <Field label={T("Start time")} htmlFor="calc-start">
            <input
              id="calc-start"
              name="start"
              type="time"
              className="calc-control"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field
            label={T("End time")}
            htmlFor="calc-end"
            hint={T(
              "An end time earlier than the start counts as the next day.",
            )}
          >
            <input
              id="calc-end"
              name="end"
              type="time"
              className="calc-control"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
          <NumField
            name="break"
            label={T("Break")}
            unit={T("minutes")}
            value={brk}
            error={brkErr}
            onChange={setBrk}
          />
        </>
      )}
    </CalcCard>
  );
}
