import { useState, type ReactNode } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import {
  CalcCard,
  Choice,
  Hero,
  How,
  NumField,
  Stats,
  Waiting,
  useFmt,
} from "../lib/ui";
import {
  apply,
  gcd,
  lcm,
  mixed,
  parseFrac,
  str,
  toNumber,
  type Frac,
  type Op,
} from "../lib/fraction";
import type { Fmt } from "../lib/num";

const OPS: [Op, string, string][] = [
  ["+", "+", "Add"],
  ["-", "−", "Subtract"],
  ["*", "×", "Multiply"],
  ["/", "÷", "Divide"],
];

/** A fraction drawn stacked, in the page's digits */
function Stack({ f, d }: { f: Frac; d: Fmt["d"] }) {
  if (f.d === 1n) return <>{d(String(f.n).replace("-", "−"))}</>;
  const neg = f.n < 0n;
  return (
    <span className="calc-mixed">
      {neg && "−"}
      <span className="calc-frac" style={{ fontSize: "0.7em" }}>
        <span>{d(String(neg ? -f.n : f.n))}</span>
        <span>{d(String(f.d))}</span>
      </span>
    </span>
  );
}

function mixedText(f: Frac): string {
  const m = mixed(f);
  if (m.whole === 0n || m.n === 0n) return str(f);
  return `${m.neg ? "-" : ""}${m.whole} ${m.n}/${m.d}`;
}

export default function Fraction(_: ToolProps) {
  const T = useT();
  const f = useFmt();
  const [a, setA] = useState("1/3");
  const [b, setB] = useState("2 1/4");
  const [op, setOp] = useState<Op>("+");

  const fa = parseFrac(a);
  const fb = parseFrac(b);
  const ea = typeof fa === "string" ? T(fa) : null;
  const eb = typeof fb === "string" ? T(fb) : null;

  let result = (
    <Waiting>{T("Type two fractions, like 1/3 and 2 1/4.")}</Waiting>
  );
  let how: ReactNode = null;
  if (fa && fb && typeof fa !== "string" && typeof fb !== "string") {
    const r = apply(fa, op, fb);
    if (!r) result = <Waiting>{T("You can't divide by zero.")}</Waiting>;
    else {
      const dec = toNumber(r);
      const m = mixed(r);
      const isMixed = m.whole !== 0n && m.n !== 0n;
      result = (
        <>
          <Hero
            label={T("Answer")}
            value={<Stack f={r} d={f.d} />}
            raw={str(r)}
            copy={str(r)}
            sub={
              isMixed ? (
                <>
                  {T("As a mixed number")}: {f.d(mixedText(r))}
                </>
              ) : undefined
            }
          />
          <Stats
            rows={[
              ...(isMixed
                ? [
                    {
                      id: "mixed",
                      label: T("Mixed number"),
                      value: f.d(mixedText(r)),
                    },
                  ]
                : []),
              { id: "fraction", label: T("Fraction"), value: f.d(str(r)) },
              {
                id: "decimal",
                label: T("Decimal"),
                value: f.n(dec, 10),
                raw: dec,
              },
              {
                id: "percent",
                label: T("Percent"),
                value: f.pct(dec * 100, 6),
                raw: dec * 100,
              },
            ]}
          />
        </>
      );
      // The steps, with the reader's numbers
      const s = (x: Frac) => f.d(str(x));
      const steps: string[] = [];
      if (op === "+" || op === "-") {
        const L = lcm(fa.d, fb.d);
        const na = fa.n * (L / fa.d);
        const nb = fb.n * (L / fb.d);
        const sum = op === "+" ? na + nb : na - nb;
        steps.push(
          T("Use the common denominator {d}: {a} = {a2} and {b} = {b2}.", {
            d: f.d(String(L)),
            a: s(fa),
            a2: f.d(`${na}/${L}`),
            b: s(fb),
            b2: f.d(`${nb}/${L}`),
          }),
        );
        steps.push(
          `${f.d(`${na}/${L}`)} ${op === "+" ? "+" : "−"} ${f.d(`${nb}/${L}`)} = ${f.d(`${sum}/${L}`)}`,
        );
        const g = gcd(sum, L);
        if (g > 1n)
          steps.push(
            T("Divide top and bottom by {g}: {r}.", {
              g: f.d(String(g)),
              r: s(r),
            }),
          );
      } else {
        const bb =
          op === "/"
            ? { n: fb.d * (fb.n < 0n ? -1n : 1n), d: fb.n < 0n ? -fb.n : fb.n }
            : fb;
        if (op === "/")
          steps.push(
            T("Dividing by {b} is multiplying by {flip}.", {
              b: s(fb),
              flip: f.d(`${bb.n}/${bb.d}`),
            }),
          );
        const n = fa.n * bb.n;
        const d = fa.d * bb.d;
        steps.push(
          `${s(fa)} × ${f.d(`${bb.n}/${bb.d}`)} = ${f.d(`${n}/${d}`)}`,
        );
        const g = gcd(n, d);
        if (g > 1n)
          steps.push(
            T("Divide top and bottom by {g}: {r}.", {
              g: f.d(String(g)),
              r: s(r),
            }),
          );
      }
      how = steps.map((x) => <p key={x}>{x}</p>);
    }
  }

  return (
    <CalcCard result={result} below={how && <How>{how}</How>}>
      <NumField
        name="a"
        label={T("First fraction")}
        value={a}
        error={ea}
        inputMode="text"
        hint={T("Like 3/4, 2 1/4, 5 or 0.75")}
        onChange={setA}
      />
      <Choice
        label={T("Operation")}
        value={op}
        onPick={setOp}
        options={OPS.map(([o, sym]) => [o, sym] as [Op, string])}
      />
      <NumField
        name="b"
        label={T("Second fraction")}
        value={b}
        error={eb}
        inputMode="text"
        onChange={setB}
      />
    </CalcCard>
  );
}
