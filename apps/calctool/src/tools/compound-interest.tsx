import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import {
  CalcCard,
  Field,
  Hero,
  How,
  NumField,
  Row,
  Stats,
  Table,
  Waiting,
  pre,
  useCheck,
  useFmt,
} from "../lib/ui";
import { grow } from "../lib/money";

const FREQ: [number, string][] = [
  [1, "Yearly"],
  [2, "Every 6 months"],
  [4, "Quarterly"],
  [12, "Monthly"],
  [365, "Daily"],
];

export default function CompoundInterest({ preset }: ToolProps) {
  const T = useT();
  const f = useFmt();
  const check = useCheck();
  const [start, setStart] = useState(String(pre(preset?.start, 10000)));
  const [monthly, setMonthly] = useState(String(pre(preset?.monthly, 100)));
  const [rate, setRate] = useState(String(pre(preset?.rate, 5)));
  const [years, setYears] = useState(String(pre(preset?.years, 10)));
  const [freq, setFreq] = useState<number>(pre(preset?.per, 12));

  const [S, eS] = check(start, { min: 0 });
  const [M, eM] = check(monthly, { min: 0 });
  const [r, er] = check(rate, { min: -100, max: 1000 });
  const [y, ey] = check(years, { positive: true, max: 100 });

  let result = (
    <Waiting>{T("Type what you start with, the rate and the years.")}</Waiting>
  );
  let below = null;
  if (S !== null && M !== null && r !== null && y !== null) {
    const g = grow(S, M, r, y, freq);
    const share = g.balance > 0 ? (g.deposits / g.balance) * 100 : 100;
    result = (
      <>
        <Hero
          label={T("After {n} years", { n: f.n(y, 2) })}
          value={f.money(g.balance)}
          raw={g.balance}
        />
        <Stats
          rows={[
            {
              id: "deposits",
              label: T("Money you put in"),
              value: f.money(g.deposits),
              raw: g.deposits,
            },
            {
              id: "interest",
              label: T("Interest earned"),
              value: f.money(g.interest),
              raw: g.interest,
            },
          ]}
        />
        {g.interest > 0 && (
          <div>
            <div className="calc-split" aria-hidden="true">
              <span style={{ width: `${share}%` }} />
              <span style={{ width: `${100 - share}%` }} />
            </div>
            <div className="calc-legend" style={{ marginTop: 8 }}>
              <span>
                <i />
                {T("Deposits {p}", { p: f.pct(share, 0) })}
              </span>
              <span>
                <i className="b" />
                {T("Interest {p}", { p: f.pct(100 - share, 0) })}
              </span>
            </div>
          </div>
        )}
      </>
    );
    below = (
      <>
        <How>
          <p>
            {M > 0
              ? T(
                  "Interest compounds {f}; each deposit is added at the end of the month.",
                  {
                    f: T(
                      FREQ.find(([v]) => v === freq)?.[1] ?? "Monthly",
                    ).toLowerCase(),
                  },
                )
              : T("Interest compounds {f}.", {
                  f: T(
                    FREQ.find(([v]) => v === freq)?.[1] ?? "Monthly",
                  ).toLowerCase(),
                })}
          </p>
          <p>
            {M === 0
              ? `${f.money(S)} × (1 + ${f.pct(r, 4)} ÷ ${f.d(freq)})^(${f.d(freq)} × ${f.n(y, 2)}) = `
              : `${T("Total")} = `}
            <b>{f.money(g.balance)}</b>
          </p>
        </How>
        <section>
          <div className="calc-sub-head">
            <h3>{T("Year by year")}</h3>
          </div>
          <Table
            max={30}
            head={[
              T("Year"),
              T("Deposits"),
              T("Interest"),
              T("Total interest"),
              T("Balance"),
            ]}
            rows={g.rows.map((x) => [
              f.d(x.year),
              f.money(x.deposits),
              f.money(x.interest),
              f.money(x.totalInterest),
              f.money(x.balance),
            ])}
          />
        </section>
      </>
    );
  }

  return (
    <CalcCard result={result} below={below}>
      <NumField
        name="start"
        label={T("Starting amount")}
        value={start}
        error={eS}
        step={100}
        onChange={setStart}
      />
      <NumField
        name="monthly"
        label={T("Added each month")}
        value={monthly}
        error={eM}
        step={10}
        onChange={setMonthly}
      />
      <Row>
        <NumField
          name="rate"
          label={T("Interest rate per year")}
          unit="%"
          value={rate}
          error={er}
          step={0.25}
          onChange={setRate}
        />
        <NumField
          name="years"
          label={T("Years")}
          value={years}
          error={ey}
          onChange={setYears}
        />
      </Row>
      <Field label={T("Compounding")} htmlFor="calc-freq">
        <select
          id="calc-freq"
          name="freq"
          className="calc-control"
          value={freq}
          onChange={(e) => setFreq(+e.target.value)}
        >
          {FREQ.map(([v, l]) => (
            <option key={v} value={v}>
              {T(l)}
            </option>
          ))}
        </select>
      </Field>
    </CalcCard>
  );
}
