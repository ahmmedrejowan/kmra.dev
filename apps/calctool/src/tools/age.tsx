import { useState } from "react";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import {
  CalcCard,
  Field,
  Hero,
  How,
  Stats,
  Waiting,
  useFmt,
  usePlural,
} from "../lib/ui";
import {
  cmp,
  dayNum,
  iso,
  longDate,
  nextBirthday,
  parseDate,
  today,
  ymdDiff,
} from "../lib/dates";

export default function Age(_: ToolProps) {
  const T = useT();
  const f = useFmt();
  const lang = useLang();
  const P = usePlural();
  const [birth, setBirth] = useState("1990-06-15");
  const [on, setOn] = useState(() => iso(today()));

  const b = parseDate(birth);
  const o = parseDate(on);

  let result = <Waiting>{T("Pick a date of birth.")}</Waiting>;
  let how = null;
  if (b && o) {
    if (cmp(b, o) > 0) {
      result = (
        <Waiting>
          {T(
            "The date of birth is after the 'on' date. Pick an earlier birth date.",
          )}
        </Waiting>
      );
    } else {
      const a = ymdDiff(b, o);
      const days = dayNum(o) - dayNum(b);
      const totalMonths = a.years * 12 + a.months;
      const nb = nextBirthday(b, o);
      const until = dayNum(nb) - dayNum(o);
      const turns = nb.y - b.y;
      result = (
        <>
          <Hero
            label={T("Age")}
            value={P(a.years, "{n} year", "{n} years")}
            raw={`${a.years}y ${a.months}m ${a.days}d`}
            copy={T("{a}, {b} and {c}", {
              a: P(a.years, "{n} year", "{n} years"),
              b: P(a.months, "{n} month", "{n} months"),
              c: P(a.days, "{n} day", "{n} days"),
            })}
            sub={T("{a} and {b}", {
              a: P(a.months, "{n} month", "{n} months"),
              b: P(a.days, "{n} day", "{n} days"),
            })}
          />
          <Stats
            rows={[
              {
                id: "next",
                label: T("Next birthday"),
                value:
                  until === 0
                    ? T("Today. Happy birthday!")
                    : P(until, "In {n} day", "In {n} days"),
                raw: until,
                note: T("Turns {n} on {date}", {
                  n: f.d(turns),
                  date: longDate(nb, lang),
                }),
              },
              {
                id: "months",
                label: T("Total months"),
                value: f.int(totalMonths),
                raw: totalMonths,
              },
              {
                id: "weeks",
                label: T("Total weeks"),
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
                id: "days",
                label: T("Total days"),
                value: f.int(days),
                raw: days,
              },
            ]}
          />
        </>
      );
      how = (
        <>
          <p>{T("Born on {date}.", { date: longDate(b, lang) })}</p>
          <p>
            {T(
              "Whole years and months are counted first, then the days left over. Leap years are included, and a 29 February birthday falls on 1 March in other years.",
            )}
          </p>
        </>
      );
    }
  }

  return (
    <CalcCard result={result} below={how && <How>{how}</How>}>
      <Field label={T("Date of birth")} htmlFor="calc-birth">
        <input
          id="calc-birth"
          name="birth"
          type="date"
          className="calc-control"
          value={birth}
          max="9999-12-31"
          onChange={(e) => setBirth(e.target.value)}
        />
      </Field>
      <Field
        label={T("Age on")}
        htmlFor="calc-on"
        hint={
          on !== iso(today()) ? (
            <button
              type="button"
              className="btn xs"
              onClick={() => setOn(iso(today()))}
            >
              {T("Back to today")}
            </button>
          ) : (
            T("Today. Change it to see the age on another day.")
          )
        }
      >
        <input
          id="calc-on"
          name="on"
          type="date"
          className="calc-control"
          value={on}
          max="9999-12-31"
          onChange={(e) => setOn(e.target.value)}
        />
      </Field>
    </CalcCard>
  );
}
