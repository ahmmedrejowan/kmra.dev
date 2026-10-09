import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import {
  CalcCard,
  Choice,
  Hero,
  How,
  NumField,
  Row,
  Stats,
  Waiting,
  pre,
  useCheck,
  useFmt,
} from "../lib/ui";

type Per = "hour" | "day" | "week" | "month" | "year";

const PER: [Per, string][] = [
  ["hour", "Hour"],
  ["day", "Day"],
  ["week", "Week"],
  ["month", "Month"],
  ["year", "Year"],
];
const LABEL: Record<Per, string> = {
  hour: "Per hour",
  day: "Per day",
  week: "Per week",
  month: "Per month",
  year: "Per year",
};

export default function Salary({ preset }: ToolProps) {
  const T = useT();
  const f = useFmt();
  const check = useCheck();
  const [per, setPer] = useState<Per>(pre(preset?.per, "hour") as Per);
  const [amount, setAmount] = useState(
    per === "hour"
      ? "25"
      : per === "year"
        ? "52000"
        : per === "month"
          ? "4000"
          : per === "week"
            ? "1000"
            : "200",
  );
  const [hours, setHours] = useState("40");
  const [days, setDays] = useState("5");
  const [weeks, setWeeks] = useState("52");

  const [A, eA] = check(amount, { min: 0 });
  const [h, eh] = check(hours, { positive: true, max: 168 });
  const [d, ed] = check(days, { positive: true, max: 7 });
  const [w, ew] = check(weeks, { positive: true, max: 52.1786 });

  let result = <Waiting>{T("Type an amount to convert it.")}</Waiting>;
  let how = null;
  if (A !== null && h !== null && d !== null && w !== null) {
    const yearly =
      per === "hour"
        ? A * h * w
        : per === "day"
          ? A * d * w
          : per === "week"
            ? A * w
            : per === "month"
              ? A * 12
              : A;
    const all: Record<Per, number> = {
      hour: yearly / (h * w),
      day: yearly / (d * w),
      week: yearly / w,
      month: yearly / 12,
      year: yearly,
    };
    const main: Per = per === "year" ? "month" : "year";
    result = (
      <>
        <Hero
          label={T(LABEL[main])}
          value={f.money(all[main])}
          raw={all[main]}
          sub={T("from {a} {per}", {
            a: f.money(A),
            per: T(LABEL[per]).toLowerCase(),
          })}
        />
        <Stats
          rows={PER.filter(([p]) => p !== main).map(([p]) => ({
            id: p,
            label: T(LABEL[p]),
            value: f.money(all[p]),
            raw: all[p],
            on: p === per,
          }))}
        />
      </>
    );
    how = (
      <p>
        {T(
          "A year here is {w} weeks of {h} hours ({d} days a week): {t} working hours.",
          {
            w: f.n(w, 2),
            h: f.n(h, 2),
            d: f.n(d, 2),
            t: f.n(h * w, 2),
          },
        )}
      </p>
    );
  }

  return (
    <CalcCard result={result} below={how && <How>{how}</How>}>
      <NumField
        name="amount"
        label={T("Amount")}
        value={amount}
        error={eA}
        onChange={setAmount}
      />
      <Choice
        label={T("Paid per")}
        value={per}
        onPick={setPer}
        options={PER.map(([p, l]) => [p, T(l)] as [Per, string])}
      />
      <Row>
        <NumField
          name="hours"
          label={T("Hours a week")}
          value={hours}
          error={eh}
          onChange={setHours}
        />
        <NumField
          name="days"
          label={T("Days a week")}
          value={days}
          error={ed}
          onChange={setDays}
        />
        <NumField
          name="weeks"
          label={T("Weeks a year")}
          value={weeks}
          error={ew}
          onChange={setWeeks}
        />
      </Row>
      <p className="calc-note">
        {T(
          "Before tax. Take off unpaid holiday from the weeks if you're paid by the hour.",
        )}
      </p>
    </CalcCard>
  );
}
