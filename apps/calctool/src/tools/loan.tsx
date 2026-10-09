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
  Table,
  Waiting,
  pre,
  useCheck,
  useFmt,
} from "../lib/ui";
import { amortize, byYear } from "../lib/money";

export default function Loan({ preset }: ToolProps) {
  const T = useT();
  const f = useFmt();
  const check = useCheck();
  const [amount, setAmount] = useState(String(pre(preset?.amount, 100000)));
  const [rate, setRate] = useState(String(pre(preset?.rate, 5)));
  const [years, setYears] = useState(String(pre(preset?.years, 5)));
  const [months, setMonths] = useState("0");
  const [view, setView] = useState<"year" | "month">("year");

  const [P, eP] = check(amount, { positive: true });
  const [r, er] = check(rate, { min: 0, max: 100 });
  const [y, ey] = check(years, { min: 0, max: 100, integer: true });
  const [m, em] = check(months, { min: 0, max: 11, integer: true });
  const n = (y ?? 0) * 12 + (m ?? 0);

  let result = (
    <Waiting>
      {T("Type the amount, the rate and the length of the loan.")}
    </Waiting>
  );
  let below = null;
  if (P !== null && r !== null && y !== null && m !== null) {
    if (n === 0) {
      result = (
        <Waiting>{T("Give the loan a length of at least one month.")}</Waiting>
      );
    } else {
      const s = amortize(P, r, n);
      const total = P + s.totalInterest;
      const share = (P / total) * 100;
      const rows = view === "year" ? byYear(s.rows) : s.rows;
      result = (
        <>
          <Hero
            label={T("Monthly payment")}
            value={f.money(s.payment)}
            raw={s.payment}
            sub={T("for {n} months", { n: f.d(n) })}
          />
          <Stats
            rows={[
              {
                id: "interest",
                label: T("Total interest"),
                value: f.money(s.totalInterest),
                raw: s.totalInterest,
              },
              {
                id: "total",
                label: T("Total you pay"),
                value: f.money(total),
                raw: total,
              },
            ]}
          />
          <div>
            <div className="calc-split" aria-hidden="true">
              <span style={{ width: `${share}%` }} />
              <span style={{ width: `${100 - share}%` }} />
            </div>
            <div className="calc-legend" style={{ marginTop: 8 }}>
              <span>
                <i />
                {T("Loan {p}", { p: f.pct(share, 0) })}
              </span>
              <span>
                <i className="b" />
                {T("Interest {p}", { p: f.pct(100 - share, 0) })}
              </span>
            </div>
          </div>
        </>
      );
      below = (
        <>
          <How>
            <p>
              {T("Monthly rate")} = {f.pct(r, 4)} ÷ {f.d(12)} ={" "}
              {f.pct(r / 12, 6)}
            </p>
            <p>
              {r === 0
                ? `${T("Payment")} = ${f.money(P)} ÷ ${f.d(n)} = `
                : `${T("Payment")} = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1), n = ${f.d(n)} = `}
              <b>{f.money(s.payment)}</b>
            </p>
          </How>
          <section className="calc-sched">
            <div className="calc-sub-head">
              <h3>{T("Payment schedule")}</h3>
              <Choice
                label={T("Show")}
                hideLabel
                value={view}
                onPick={setView}
                options={[
                  ["year", T("By year")],
                  ["month", T("By month")],
                ]}
              />
            </div>
            <Table
              key={view}
              max={view === "month" ? 24 : 40}
              head={[
                view === "year" ? T("Year") : T("Month"),
                T("Paid"),
                T("Interest"),
                T("Loan repaid"),
                T("Balance"),
              ]}
              rows={rows.map((x) => [
                f.d(x.n),
                f.money(x.payment),
                f.money(x.interest),
                f.money(x.principal),
                f.money(x.balance),
              ])}
              foot={[
                T("Total"),
                f.money(total),
                f.money(s.totalInterest),
                f.money(P),
                "",
              ]}
            />
          </section>
        </>
      );
    }
  }

  return (
    <CalcCard result={result} below={below}>
      <NumField
        name="amount"
        label={T("Loan amount")}
        value={amount}
        error={eP}
        step={1000}
        onChange={setAmount}
      />
      <NumField
        name="rate"
        label={T("Interest rate per year")}
        unit="%"
        value={rate}
        error={er}
        step={0.25}
        onChange={setRate}
      />
      <Row>
        <NumField
          name="years"
          label={T("Years")}
          value={years}
          error={ey}
          onChange={setYears}
        />
        <NumField
          name="months"
          label={T("Months")}
          value={months}
          error={em}
          onChange={setMonths}
        />
      </Row>
      <p className="calc-note">
        {T(
          "Fixed rate, paid monthly. Fees, taxes and insurance aren't included.",
        )}
      </p>
    </CalcCard>
  );
}
