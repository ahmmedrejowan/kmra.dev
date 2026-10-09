import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Toggle } from "@kmra/ui/components/controls";
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

type Kind = "percent" | "amount";

export default function Discount({ preset }: ToolProps) {
  const T = useT();
  const f = useFmt();
  const check = useCheck();
  const [price, setPrice] = useState("80");
  const [kind, setKind] = useState<Kind>(pre(preset?.kind, "percent") as Kind);
  const [off, setOff] = useState(String(pre(preset?.off, 25)));
  const [stack, setStack] = useState(false);
  const [off2, setOff2] = useState("10");

  const [p, ep] = check(price, { min: 0 });
  const [d, ed] = check(off, {
    min: 0,
    max: kind === "percent" ? 100 : (p ?? undefined),
  });
  const [d2, ed2] = check(off2, { min: 0, max: 100 });

  let result = <Waiting>{T("Type a price and a discount.")}</Waiting>;
  let how = null;
  if (p !== null && d !== null && (!stack || d2 !== null)) {
    const after1 = kind === "percent" ? p * (1 - d / 100) : p - d;
    const final = stack ? after1 * (1 - (d2 ?? 0) / 100) : after1;
    const saved = p - final;
    const pct = p > 0 ? (saved / p) * 100 : 0;
    result = (
      <>
        <Hero
          label={T("You pay")}
          value={f.money(final)}
          raw={final}
          sub={T("You save {s} ({p})", { s: f.money(saved), p: f.pct(pct) })}
        />
        <Stats
          rows={[
            {
              id: "price",
              label: T("Original price"),
              value: f.money(p),
              raw: p,
            },
            {
              id: "saved",
              label: T("You save"),
              value: f.money(saved),
              raw: saved,
            },
            {
              id: "pct",
              label: T("Total discount"),
              value: f.pct(pct),
              raw: pct,
              note:
                stack && kind === "percent"
                  ? T("Two discounts don't add up: {a} then {b} isn't {c}.", {
                      a: f.pct(d),
                      b: f.pct(d2 ?? 0),
                      c: f.pct(d + (d2 ?? 0)),
                    })
                  : undefined,
            },
          ]}
        />
      </>
    );
    how = (
      <>
        <p>
          {kind === "percent"
            ? `${f.money(p)} × (1 − ${f.n(d, 4)}%) = ${f.money(after1)}`
            : `${f.money(p)} − ${f.money(d)} = ${f.money(after1)}`}
        </p>
        {stack && (
          <p>
            {T("Then")} {f.money(after1)} × (1 − {f.n(d2 ?? 0, 4)}%) ={" "}
            <b>{f.money(final)}</b>
          </p>
        )}
      </>
    );
  }

  return (
    <CalcCard result={result} below={how && <How>{how}</How>}>
      <NumField
        name="price"
        label={T("Price")}
        value={price}
        error={ep}
        onChange={setPrice}
      />
      <Choice
        label={T("Discount type")}
        value={kind}
        onPick={(k) => {
          setKind(k);
          // A percentage like 25 makes no sense as "25 off" a 20 item, and back
          if (k === "amount" && p !== null && (parseNum(off) ?? 0) <= 100)
            setOff(
              String(Number((((parseNum(off) ?? 0) / 100) * p).toFixed(2))),
            );
          if (k === "percent" && p) {
            const v = parseNum(off) ?? 0;
            setOff(String(Number(((v / p) * 100).toFixed(2))));
          }
        }}
        options={[
          ["percent", T("Percent off")],
          ["amount", T("Amount off")],
        ]}
      />
      <NumField
        name="off"
        label={kind === "percent" ? T("Discount") : T("Amount off")}
        unit={kind === "percent" ? "%" : undefined}
        value={off}
        error={ed}
        onChange={setOff}
      />
      {kind === "percent" && (
        <Chips
          label={T("Common discounts")}
          value={parseNum(off)}
          onPick={(v) => setOff(String(v))}
          options={[10, 15, 20, 25, 30, 40, 50, 70].map(
            (v) => [v, f.pct(v)] as [number, string],
          )}
        />
      )}
      <Toggle
        label={T("Add a second discount")}
        on={stack}
        onChange={setStack}
      />
      {stack && (
        <NumField
          name="off2"
          label={T("Second discount, on the reduced price")}
          unit="%"
          value={off2}
          error={ed2}
          onChange={setOff2}
        />
      )}
    </CalcCard>
  );
}
