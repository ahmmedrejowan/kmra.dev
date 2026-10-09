import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Toggle } from "@kmra/ui/components/controls";
import type { ToolProps } from ".";
import {
  CalcCard,
  Chips,
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
import { parseNum } from "../lib/num";

export default function Tip({ preset }: ToolProps) {
  const T = useT();
  const f = useFmt();
  const check = useCheck();
  const [bill, setBill] = useState("64.50");
  const [tip, setTip] = useState(String(pre(preset?.tip, 15)));
  const [people, setPeople] = useState(String(pre(preset?.people, 2)));
  const [round, setRound] = useState(false);

  const [b, eb] = check(bill, { min: 0 });
  const [t, et] = check(tip, { min: 0, max: 100 });
  const [n, en] = check(people, { min: 1, integer: true, max: 1000 });

  let result = (
    <Waiting>{T("Type the bill to see what each person pays.")}</Waiting>
  );
  let how = null;
  if (b !== null && t !== null && n !== null) {
    const tipAmt = (b * t) / 100;
    const total = b + tipAmt;
    let each = total / n;
    // Round each share up to a whole amount; the extra goes to the tip
    if (round) each = Math.ceil(each - 1e-9);
    const paid = each * n;
    const realTip = paid - b;
    const realPct = b > 0 ? (realTip / b) * 100 : 0;
    result = (
      <>
        <Hero
          label={n === 1 ? T("You pay") : T("Each person pays")}
          value={f.money(each)}
          raw={each}
          sub={
            n > 1
              ? T("{n} people, {t} in total", { n, t: f.money(paid) })
              : undefined
          }
        />
        <Stats
          rows={[
            {
              id: "tip",
              label: T("Tip"),
              value: f.money(realTip),
              raw: realTip,
              note: round
                ? T("{p} after rounding up", { p: f.pct(realPct) })
                : undefined,
            },
            {
              id: "total",
              label: T("Total with tip"),
              value: f.money(paid),
              raw: paid,
            },
            ...(n > 1
              ? [
                  {
                    id: "tip-each",
                    label: T("Tip per person"),
                    value: f.money(realTip / n),
                    raw: realTip / n,
                  },
                ]
              : []),
          ]}
        />
      </>
    );
    how = (
      <>
        <p>
          {T("Tip")}: {f.money(b)} × {f.pct(t)} = {f.money(tipAmt)}
        </p>
        <p>
          {T("Each")}: ({f.money(b)} + {f.money(tipAmt)}) ÷ {f.d(n)} ={" "}
          {f.money(total / n)}
          {round && (
            <>
              {", "}
              {T("rounded up to {v}", { v: f.money(each) })}
            </>
          )}
        </p>
      </>
    );
  }

  return (
    <CalcCard result={result} below={how && <How>{how}</How>}>
      <NumField
        name="bill"
        label={T("Bill")}
        value={bill}
        error={eb}
        onChange={setBill}
      />
      <NumField
        name="tip"
        label={T("Tip")}
        unit="%"
        value={tip}
        error={et}
        onChange={setTip}
      />
      <Chips
        label={T("Common tips")}
        value={parseNum(tip)}
        onPick={(v) => setTip(String(v))}
        options={[0, 10, 12, 15, 18, 20, 25].map(
          (v) => [v, v === 0 ? T("No tip") : f.pct(v)] as [number, string],
        )}
      />
      <Row>
        <NumField
          name="people"
          label={T("People")}
          value={people}
          error={en}
          onChange={setPeople}
        />
      </Row>
      <Toggle
        label={T("Round up each share to a whole amount")}
        on={round}
        onChange={setRound}
      />
    </CalcCard>
  );
}
