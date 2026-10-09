import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import {
  CalcCard,
  Choice,
  Chips,
  Hero,
  How,
  NumField,
  Stats,
  Waiting,
  pre,
  useCheck,
  useFmt,
} from "../lib/ui";
import { parseNum } from "../lib/num";

type Mode = "add" | "remove";

export default function SalesTax({ preset }: ToolProps) {
  const T = useT();
  const f = useFmt();
  const check = useCheck();
  const [mode, setMode] = useState<Mode>(pre(preset?.mode, "add") as Mode);
  const [price, setPrice] = useState("100");
  const [rate, setRate] = useState(String(pre(preset?.rate, 15)));

  const [p, ep] = check(price, { min: 0 });
  const [r, er] = check(rate, { min: 0, max: 1000 });

  let result = <Waiting>{T("Type a price and a tax rate.")}</Waiting>;
  let how = null;
  if (p !== null && r !== null) {
    if (mode === "add") {
      const tax = (p * r) / 100;
      const gross = p + tax;
      result = (
        <>
          <Hero
            label={T("Price with tax")}
            value={f.money(gross)}
            raw={gross}
          />
          <Stats
            rows={[
              {
                id: "net",
                label: T("Price before tax"),
                value: f.money(p),
                raw: p,
              },
              { id: "tax", label: T("Tax"), value: f.money(tax), raw: tax },
            ]}
          />
        </>
      );
      how = (
        <p>
          {f.money(p)} × (1 + {f.pct(r, 3)}) = <b>{f.money(gross)}</b>
        </p>
      );
    } else {
      const net = p / (1 + r / 100);
      const tax = p - net;
      result = (
        <>
          <Hero label={T("Price before tax")} value={f.money(net)} raw={net} />
          <Stats
            rows={[
              {
                id: "gross",
                label: T("Price with tax"),
                value: f.money(p),
                raw: p,
              },
              {
                id: "tax",
                label: T("Tax included"),
                value: f.money(tax),
                raw: tax,
              },
            ]}
          />
        </>
      );
      how = (
        <>
          <p>
            {f.money(p)} ÷ (1 + {f.pct(r, 3)}) = <b>{f.money(net)}</b>
          </p>
          <p>
            {T(
              "Taking {r} off the price would be wrong: the tax was added to the price before tax, not to the total.",
              { r: f.pct(r, 3) },
            )}
          </p>
        </>
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
            ["add", T("Add tax")],
            ["remove", T("Remove tax")],
          ]}
        />
      }
      result={result}
      below={how && <How>{how}</How>}
    >
      <NumField
        name="price"
        label={mode === "add" ? T("Price before tax") : T("Price with tax")}
        value={price}
        error={ep}
        onChange={setPrice}
      />
      <NumField
        name="rate"
        label={T("Tax rate")}
        unit="%"
        value={rate}
        error={er}
        onChange={setRate}
      />
      <Chips
        label={T("Common rates")}
        value={parseNum(rate)}
        onPick={(v) => setRate(String(v))}
        options={[5, 7.5, 10, 12, 15, 18, 20, 25].map(
          (v) => [v, f.pct(v, 1)] as [number, string],
        )}
      />
    </CalcCard>
  );
}
