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

type System = "metric" | "imperial";

const LB = 0.45359237;
const IN = 2.54;

/** WHO adult categories */
export function category(bmi: number): {
  name: string;
  tone: "good" | "warn" | "bad";
} {
  if (bmi < 18.5) return { name: "Underweight", tone: "warn" };
  if (bmi < 25) return { name: "Healthy weight", tone: "good" };
  if (bmi < 30) return { name: "Overweight", tone: "warn" };
  return { name: "Obese", tone: "bad" };
}

export default function Bmi({ preset }: ToolProps) {
  const T = useT();
  const f = useFmt();
  const check = useCheck();
  const [sys, setSys] = useState<System>(
    pre(preset?.units, "metric") as System,
  );
  const [cm, setCm] = useState("175");
  const [kg, setKg] = useState("70");
  const [ft, setFt] = useState("5");
  const [inch, setInch] = useState("9");
  const [lb, setLb] = useState("154");

  const [vcm, ecm] = check(cm, { positive: true, max: 300 });
  const [vkg, ekg] = check(kg, { positive: true, max: 700 });
  const [vft, eft] = check(ft, { min: 0, max: 9 });
  const [vin, ein] = check(inch, { min: 0, max: 120 });
  const [vlb, elb] = check(lb, { positive: true, max: 1500 });

  // Everything in metres and kilograms
  const m =
    sys === "metric"
      ? vcm !== null
        ? vcm / 100
        : null
      : vft !== null && vin !== null
        ? ((vft * 12 + vin) * IN) / 100
        : null;
  const w = sys === "metric" ? vkg : vlb !== null ? vlb * LB : null;

  let result = <Waiting>{T("Type your height and weight.")}</Waiting>;
  let how = null;
  if (m && w) {
    const bmi = w / (m * m);
    const cat = category(bmi);
    const lo = 18.5 * m * m;
    const hi = 24.9 * m * m;
    const wt = (kgv: number) =>
      sys === "metric" ? `${f.n(kgv, 1)} kg` : `${f.n(kgv / LB, 1)} lb`;
    // Marker position on a 15–40 scale with four equal bands (<18.5, 18.5–25, 25–30, 30+)
    const pos =
      bmi < 18.5
        ? ((Math.max(bmi, 15) - 15) / 3.5) * 25
        : bmi < 25
          ? 25 + ((bmi - 18.5) / 6.5) * 25
          : bmi < 30
            ? 50 + ((bmi - 25) / 5) * 25
            : 75 + ((Math.min(bmi, 40) - 30) / 10) * 25;
    result = (
      <>
        <Hero
          label={T("Your BMI")}
          value={f.n(bmi, 1, 1)}
          raw={bmi}
          tone={cat.tone}
          sub={T(cat.name)}
        />
        <div className="calc-scale" aria-hidden="true">
          <span className="calc-scale-mark" style={{ left: `${pos}%` }} />
          <div className="calc-scale-bar">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="calc-scale-ticks">
            <span>{f.n(15)}</span>
            <span>{f.n(18.5, 1)}</span>
            <span>{f.n(25)}</span>
            <span>{f.n(30)}</span>
            <span>{f.n(40)}</span>
          </div>
        </div>
        <Stats
          rows={[
            {
              id: "range",
              label: T("Healthy weight for your height"),
              value: `${wt(lo)} – ${wt(hi)}`,
            },
            ...(bmi >= 25
              ? [
                  {
                    id: "change",
                    label: T("To reach a BMI of 24.9, lose"),
                    value: wt(w - hi),
                    raw: w - hi,
                  },
                ]
              : bmi < 18.5
                ? [
                    {
                      id: "change",
                      label: T("To reach a BMI of 18.5, gain"),
                      value: wt(lo - w),
                      raw: lo - w,
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
          {T("BMI = weight in kg ÷ (height in m)²")}: {f.n(w, 2)} ÷ {f.n(m, 3)}²
          = <b>{f.n(bmi, 1, 1)}</b>
        </p>
        <p>
          {T(
            "Under 18.5 is underweight, 18.5 to 24.9 healthy, 25 to 29.9 overweight and 30 or more obese. BMI is a rough guide for adults: it doesn't tell muscle from fat, and it isn't meant for children or pregnancy.",
          )}
        </p>
      </>
    );
  }

  return (
    <CalcCard
      bar={
        <Choice
          label={T("Units")}
          hideLabel
          value={sys}
          onPick={setSys}
          options={[
            ["metric", T("Metric (cm, kg)")],
            ["imperial", T("Imperial (ft, lb)")],
          ]}
        />
      }
      result={result}
      below={how && <How>{how}</How>}
    >
      {sys === "metric" ? (
        <>
          <NumField
            name="cm"
            label={T("Height")}
            unit="cm"
            value={cm}
            error={ecm}
            onChange={setCm}
          />
          <NumField
            name="kg"
            label={T("Weight")}
            unit="kg"
            value={kg}
            error={ekg}
            step={0.5}
            onChange={setKg}
          />
        </>
      ) : (
        <>
          <div className="calc-field">
            <span className="calc-label">{T("Height")}</span>
            <Row>
              <NumField
                name="ft"
                label={T("Feet")}
                unit="ft"
                value={ft}
                error={eft}
                onChange={setFt}
              />
              <NumField
                name="in"
                label={T("Inches")}
                unit="in"
                value={inch}
                error={ein}
                onChange={setInch}
              />
            </Row>
          </div>
          <NumField
            name="lb"
            label={T("Weight")}
            unit="lb"
            value={lb}
            error={elb}
            onChange={setLb}
          />
        </>
      )}
    </CalcCard>
  );
}
