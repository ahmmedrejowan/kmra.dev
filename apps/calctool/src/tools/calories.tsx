import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import {
  CalcCard,
  Choice,
  Field,
  Hero,
  How,
  NumField,
  Row,
  Table,
  Waiting,
  pre,
  useCheck,
  useFmt,
} from "../lib/ui";

type System = "metric" | "imperial";
type Sex = "male" | "female";

export const ACTIVITY: [number, string, string][] = [
  [1.2, "Little or no exercise", "Desk job, little walking"],
  [1.375, "Light exercise", "1–3 days a week"],
  [1.55, "Moderate exercise", "3–5 days a week"],
  [1.725, "Hard exercise", "6–7 days a week"],
  [1.9, "Very hard exercise", "Physical job or training twice a day"],
];

/** Mifflin–St Jeor resting energy, kcal a day */
export function bmr(sex: Sex, kg: number, cm: number, age: number): number {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161);
}

const LB = 0.45359237;

export default function Calories({ preset }: ToolProps) {
  const T = useT();
  const f = useFmt();
  const check = useCheck();
  const [sys, setSys] = useState<System>(
    pre(preset?.units, "metric") as System,
  );
  const [sex, setSex] = useState<Sex>("male");
  const [age, setAge] = useState("30");
  const [cm, setCm] = useState("180");
  const [kg, setKg] = useState("80");
  const [ft, setFt] = useState("5");
  const [inch, setInch] = useState("11");
  const [lb, setLb] = useState("176");
  const [act, setAct] = useState(1.55);

  const [A, eA] = check(age, { min: 15, max: 100 });
  const [vcm, ecm] = check(cm, { positive: true, max: 272 });
  const [vkg, ekg] = check(kg, { positive: true, max: 650 });
  const [vft, eft] = check(ft, { min: 0, max: 8 });
  const [vin, ein] = check(inch, { min: 0, max: 120 });
  const [vlb, elb] = check(lb, { positive: true, max: 1400 });

  const h =
    sys === "metric"
      ? vcm
      : vft !== null && vin !== null
        ? (vft * 12 + vin) * 2.54
        : null;
  const w = sys === "metric" ? vkg : vlb !== null ? vlb * LB : null;

  let result = <Waiting>{T("Type your age, height and weight.")}</Waiting>;
  let below = null;
  if (A !== null && h && w) {
    const base = bmr(sex, w, h, A);
    const tdee = base * act;
    const kcal = (v: number) => `${f.int(v)} kcal`;
    const perWeek = (kgw: number) =>
      sys === "metric" ? `${f.n(kgw, 2)} kg` : `${f.n(kgw / LB, 1)} lb`;
    // About 7,700 kcal per kg of body fat
    const goals: [string, number, number][] = [
      ["Lose weight fast", -1000, -1],
      ["Lose weight", -500, -0.5],
      ["Lose weight slowly", -250, -0.25],
      ["Keep your weight", 0, 0],
      ["Gain weight slowly", 250, 0.25],
      ["Gain weight", 500, 0.5],
    ];
    const floor = sex === "male" ? 1500 : 1200;
    result = (
      <>
        <Hero
          label={T("Calories to keep your weight")}
          value={f.int(tdee)}
          raw={tdee}
          sub={T("kcal a day, at your activity level")}
        />
        <dl className="calc-stats">
          <div data-id="bmr">
            <dt>
              {T("At rest (BMR)")}
              <small>{T("What your body uses doing nothing at all")}</small>
            </dt>
            <dd data-value={String(base)}>{kcal(base)}</dd>
            <span />
          </div>
        </dl>
      </>
    );
    below = (
      <>
        <section>
          <div className="calc-sub-head">
            <h3>{T("Daily calories for your goal")}</h3>
          </div>
          <Table
            head={[T("Goal"), T("Per week"), T("Calories a day")]}
            rows={goals.map(([g, d, k]) => [
              T(g),
              k === 0 ? "–" : `${k > 0 ? "+" : "−"}${perWeek(Math.abs(k))}`,
              tdee + d < floor && d < 0 ? (
                <span title={T("Below this, talk to a doctor first.")}>
                  {kcal(tdee + d)} *
                </span>
              ) : (
                kcal(tdee + d)
              ),
            ])}
          />
          {goals.some(([, d]) => d < 0 && tdee + d < floor) && (
            <p className="calc-note" style={{ marginTop: 8 }}>
              *{" "}
              {T(
                "Eating under {n} kcal a day isn't advised without a doctor's help.",
                { n: f.int(floor) },
              )}
            </p>
          )}
        </section>
        <How>
          <p>
            {T("Mifflin–St Jeor")}: 10 × {f.n(w, 1)} + 6.25 × {f.n(h, 1)} − 5 ×{" "}
            {f.n(A)} {sex === "male" ? "+ 5" : "− 161"} = {kcal(base)}
          </p>
          <p>
            {kcal(base)} × {f.n(act, 3)} = <b>{kcal(tdee)}</b>.{" "}
            {T("These are estimates; everyone's body is a little different.")}
          </p>
        </How>
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
      below={below}
    >
      <Row>
        <Choice
          label={T("Sex")}
          value={sex}
          onPick={setSex}
          options={[
            ["male", T("Male")],
            ["female", T("Female")],
          ]}
        />
        <NumField
          name="age"
          label={T("Age")}
          unit={T("years")}
          value={age}
          error={eA}
          onChange={setAge}
        />
      </Row>
      {sys === "metric" ? (
        <Row>
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
            onChange={setKg}
          />
        </Row>
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
      <Field label={T("How active you are")} htmlFor="calc-act">
        <select
          id="calc-act"
          name="activity"
          className="calc-control"
          value={act}
          onChange={(e) => setAct(+e.target.value)}
        >
          {ACTIVITY.map(([v, l, d]) => (
            <option key={v} value={v}>
              {T(l)}: {T(d)}
            </option>
          ))}
        </select>
      </Field>
    </CalcCard>
  );
}
