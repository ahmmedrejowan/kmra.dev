import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import {
  CalcCard,
  Chips,
  Field,
  Hero,
  How,
  NumField,
  Stats,
  Waiting,
  useCheck,
  useFmt,
} from "../lib/ui";
import { KINDS, convert, kindOf } from "../lib/units";

/** Enough digits for small and large values alike */
function digits(v: number): number {
  const a = Math.abs(v);
  if (a === 0 || a >= 1000) return 2;
  if (a >= 100) return 3;
  if (a >= 10) return 4;
  if (a >= 1) return 5;
  return Math.min(10, 3 - Math.floor(Math.log10(a)) + 2);
}

export default function UnitConverter({ preset }: ToolProps) {
  const T = useT();
  const f = useFmt();
  const check = useCheck();
  const start = kindOf(
    typeof preset?.kind === "string" ? preset.kind : "length",
  );
  const has = (id: unknown) => start.units.some((u) => u.id === id);
  const [kind, setKind] = useState(start.id);
  const [from, setFrom] = useState(
    has(preset?.from) ? String(preset!.from) : start.from,
  );
  const [to, setTo] = useState(has(preset?.to) ? String(preset!.to) : start.to);
  const [value, setValue] = useState(
    start.id === "temperature"
      ? "20"
      : start.id === "length" && from === "cm"
        ? "30"
        : "1",
  );

  const k = kindOf(kind);
  const [v, ev] = check(value);
  const unit = (id: string) => k.units.find((u) => u.id === id)!;
  const sym = (id: string) => unit(id).sym;

  const pickKind = (id: string) => {
    const n = kindOf(id);
    setKind(n.id);
    setFrom(n.from);
    setTo(n.to);
    setValue(n.id === "temperature" ? "20" : "1");
  };

  let result = <Waiting>{T("Type a value to convert it.")}</Waiting>;
  let how = null;
  const kelvin =
    v !== null && k.id === "temperature"
      ? convert("temperature", from, "k", v)
      : 1;
  if (v !== null && kelvin < 0) {
    result = (
      <Waiting>
        {T(
          "That's colder than absolute zero (−273.15 °C), the lowest temperature there is.",
        )}
      </Waiting>
    );
  } else if (v !== null) {
    const r = convert(k.id, from, to, v);
    result = (
      <>
        <Hero
          label={T("{v} {from} is", { v: f.n(v, 10), from: sym(from) })}
          value={
            <>
              {f.n(r, digits(r))}
              <span className="calc-unit">{sym(to)}</span>
            </>
          }
          copy={`${f.n(r, digits(r))} ${sym(to)}`}
          raw={r}
          sub={T(unit(to).name)}
        />
        <Stats
          rows={k.units
            .filter((u) => u.id !== from && u.id !== to)
            .map((u) => {
              const x = convert(k.id, from, u.id, v);
              return {
                id: u.id,
                label: T(u.name),
                value: `${f.n(x, digits(x))} ${u.sym}`,
                raw: x,
              };
            })}
        />
      </>
    );
    const one = convert(k.id, from, to, 1);
    how =
      k.id === "temperature" ? (
        <p>
          {from === "c" &&
            to === "f" &&
            `°F = °C × 9/5 + 32 → ${f.n(v, 4)} × 9/5 + 32 = `}
          {from === "f" &&
            to === "c" &&
            `°C = (°F − 32) × 5/9 → (${f.n(v, 4)} − 32) × 5/9 = `}
          {from === "c" &&
            to === "k" &&
            `K = °C + 273.15 → ${f.n(v, 4)} + 273.15 = `}
          {from === "k" &&
            to === "c" &&
            `°C = K − 273.15 → ${f.n(v, 4)} − 273.15 = `}
          {from === "f" && to === "k" && `K = (°F − 32) × 5/9 + 273.15 = `}
          {from === "k" && to === "f" && `°F = (K − 273.15) × 9/5 + 32 = `}
          {from === to && `${f.n(v, 4)} ${sym(from)} = `}
          <b>
            {f.n(r, digits(r))} {sym(to)}
          </b>
        </p>
      ) : (
        <p>
          {f.d(1)} {sym(from)} = {f.n(one, digits(one) + 2)} {sym(to)},{" "}
          {T("so")} {f.n(v, 10)} {sym(from)} × {f.n(one, digits(one) + 2)} ={" "}
          <b>
            {f.n(r, digits(r))} {sym(to)}
          </b>
        </p>
      );
  }

  const unitSelect = (id: string, val: string, set: (v: string) => void) => (
    <select
      id={id}
      name={id}
      className="calc-control"
      value={val}
      onChange={(e) => set(e.target.value)}
    >
      {k.units.map((u) => (
        <option key={u.id} value={u.id}>
          {T(u.name)} ({u.sym})
        </option>
      ))}
    </select>
  );

  return (
    <CalcCard
      bar={
        <Chips
          label={T("What you're measuring")}
          value={kind}
          onPick={pickKind}
          options={KINDS.map((x) => [x.id, T(x.name)] as [string, string])}
        />
      }
      result={result}
      below={how && <How>{how}</How>}
    >
      <NumField
        name="value"
        label={T("Value")}
        value={value}
        error={ev}
        unit={sym(from)}
        onChange={setValue}
      />
      <Field label={T("Convert from")} htmlFor="from">
        {unitSelect("from", from, setFrom)}
      </Field>
      <button
        type="button"
        className="btn sm calc-add"
        onClick={() => {
          setFrom(to);
          setTo(from);
        }}
      >
        <Icon name="shuffle" />
        {T("Swap units")}
      </button>
      <Field label={T("Convert to")} htmlFor="to">
        {unitSelect("to", to, setTo)}
      </Field>
    </CalcCard>
  );
}
