import { useState } from "react";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import { Toggle } from "@kmra/ui/components/controls";
import type { ToolProps } from ".";
import {
  CalcCard,
  Choice,
  Field,
  Hero,
  How,
  NumField,
  Row,
  Stats,
  Waiting,
  pre,
  useCheck,
  useFmt,
  usePlural,
} from "../lib/ui";
import {
  addTo,
  dayNum,
  fromDayNum,
  iso,
  longDate,
  parseDate,
  today,
  workingDays,
  ymdDiff,
} from "../lib/dates";

type Mode = "between" | "add";
type Unit = "days" | "weeks" | "months" | "years";

export default function DateDifference({ preset }: ToolProps) {
  const T = useT();
  const f = useFmt();
  const P = usePlural();
  const lang = useLang();
  const check = useCheck();
  const [mode, setMode] = useState<Mode>(pre(preset?.mode, "between") as Mode);
  const [from, setFrom] = useState(() => iso(today()));
  const [to, setTo] = useState(() => {
    const t = today();
    return iso({ y: t.y, m: 12, d: 31 });
  });
  const [incl, setIncl] = useState(false);
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("90");
  const [unit, setUnit] = useState<Unit>("days");

  const a = parseDate(from);
  const b = parseDate(to);
  const [n, en] = check(amount, { min: 0, integer: true, max: 100000 });

  let result = <Waiting>{T("Pick two dates.")}</Waiting>;
  let how = null;

  if (mode === "between" && a && b) {
    const swap = dayNum(b) < dayNum(a);
    const [s, e] = swap ? [b, a] : [a, b];
    const start = dayNum(s);
    const end = dayNum(e) + (incl ? 1 : 0);
    const days = end - start;
    const ymd = ymdDiff(s, fromDayNum(end));
    const work = workingDays(start, end);
    result = (
      <>
        <Hero
          label={
            swap
              ? T("Days between (the end is before the start)")
              : T("Days between")
          }
          value={P(days, "{n} day", "{n} days")}
          raw={days}
        />
        <Stats
          rows={[
            {
              id: "weeks",
              label: T("Weeks"),
              value:
                days % 7
                  ? T("{a} and {b}", {
                      a: P(Math.floor(days / 7), "{n} week", "{n} weeks"),
                      b: P(days % 7, "{n} day", "{n} days"),
                    })
                  : P(days / 7, "{n} week", "{n} weeks"),
              raw: days / 7,
            },
            {
              id: "ymd",
              label: T("Years, months and days"),
              value: [
                ymd.years ? P(ymd.years, "{n} year", "{n} years") : "",
                ymd.months ? P(ymd.months, "{n} month", "{n} months") : "",
                P(ymd.days, "{n} day", "{n} days"),
              ]
                .filter(Boolean)
                .join(", "),
            },
            {
              id: "work",
              label: T("Working days (Monday to Friday)"),
              value: f.int(work),
              raw: work,
              note: T("Public holidays aren't taken off."),
            },
            {
              id: "hours",
              label: T("Hours"),
              value: f.int(days * 24),
              raw: days * 24,
            },
          ]}
        />
      </>
    );
    how = (
      <p>
        {T("From {a} to {b}", { a: longDate(s, lang), b: longDate(e, lang) })}
        {incl ? `, ${T("counting the end date")}` : ""}.
      </p>
    );
  }

  if (mode === "add") {
    if (!a) result = <Waiting>{T("Pick a date.")}</Waiting>;
    else if (n === null)
      result = <Waiting>{en ?? T("Type how many to add.")}</Waiting>;
    else {
      const k = n * sign;
      const r =
        unit === "days"
          ? addTo(a, { days: k })
          : unit === "weeks"
            ? addTo(a, { days: k * 7 })
            : unit === "months"
              ? addTo(a, { months: k })
              : addTo(a, { years: k });
      const diff = dayNum(r) - dayNum(a);
      result = (
        <>
          <Hero
            label={T("The date is")}
            value={longDate(r, lang)}
            raw={iso(r)}
          />
          <Stats
            rows={[
              { id: "iso", label: T("As a date"), value: f.d(iso(r)) },
              {
                id: "days",
                label: T("Days from the start date"),
                value: f.int(diff),
                raw: diff,
              },
            ]}
          />
        </>
      );
      how = (
        <p>
          {longDate(a, lang)} {sign > 0 ? "+" : "−"} {f.int(n)} {T(unit)} ={" "}
          <b>{longDate(r, lang)}</b>
          {(unit === "months" || unit === "years") &&
            `. ${T("If the day doesn't exist in that month, the month's last day is used.")}`}
        </p>
      );
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
            ["between", T("Days between dates")],
            ["add", T("Add or subtract")],
          ]}
        />
      }
      result={result}
      below={how && <How>{how}</How>}
    >
      <Field
        label={mode === "between" ? T("Start date") : T("Date")}
        htmlFor="calc-from"
      >
        <input
          id="calc-from"
          name="from"
          type="date"
          className="calc-control"
          value={from}
          max="9999-12-31"
          onChange={(e) => setFrom(e.target.value)}
        />
      </Field>
      {mode === "between" ? (
        <>
          <Field label={T("End date")} htmlFor="calc-to">
            <input
              id="calc-to"
              name="to"
              type="date"
              className="calc-control"
              value={to}
              max="9999-12-31"
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Toggle
            label={T("Count the end date too")}
            on={incl}
            onChange={setIncl}
          />
        </>
      ) : (
        <>
          <Choice
            label={T("Add or subtract")}
            value={sign}
            onPick={setSign}
            options={[
              [1, T("Add")],
              [-1, T("Subtract")],
            ]}
          />
          <Row>
            <NumField
              name="amount"
              label={T("How many")}
              value={amount}
              error={en}
              onChange={setAmount}
            />
            <Field label={T("Unit")} htmlFor="calc-unit">
              <select
                id="calc-unit"
                name="unit"
                className="calc-control"
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
              >
                {(["days", "weeks", "months", "years"] as Unit[]).map((u) => (
                  <option key={u} value={u}>
                    {T(u)}
                  </option>
                ))}
              </select>
            </Field>
          </Row>
        </>
      )}
    </CalcCard>
  );
}
