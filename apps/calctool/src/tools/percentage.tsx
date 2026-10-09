import { useState } from "react";
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
  pre,
  useCheck,
  useFmt,
} from "../lib/ui";

type Mode = "of" | "is-what" | "change";

export default function Percentage({ preset }: ToolProps) {
  const T = useT();
  const f = useFmt();
  const check = useCheck();
  const [mode, setMode] = useState<Mode>(pre(preset?.mode, "of") as Mode);
  // Each question keeps its own numbers
  const [a, setA] = useState<Record<Mode, string>>({
    of: "15",
    "is-what": "45",
    change: "50",
  });
  const [b, setB] = useState<Record<Mode, string>>({
    of: "80",
    "is-what": "60",
    change: "75",
  });
  const [x, ex] = check(a[mode]);
  const [y, ey] = check(b[mode]);

  let result = <Waiting>{T("Type both numbers to see the answer.")}</Waiting>;
  let how = null;

  if (x !== null && y !== null) {
    if (mode === "of") {
      const v = (x * y) / 100;
      result = (
        <>
          <Hero
            label={T("{p}% of {n} is", { p: f.n(x, 6), n: f.n(y, 6) })}
            value={f.n(v, 6)}
            raw={v}
          />
          <Stats
            rows={[
              {
                id: "plus",
                label: T("{n} plus {p}%", { n: f.n(y, 6), p: f.n(x, 6) }),
                value: f.n(y + v, 6),
                raw: y + v,
              },
              {
                id: "minus",
                label: T("{n} minus {p}%", { n: f.n(y, 6), p: f.n(x, 6) }),
                value: f.n(y - v, 6),
                raw: y - v,
              },
            ]}
          />
        </>
      );
      how = (
        <p>
          {f.n(x, 6)} ÷ {f.n(100)} × {f.n(y, 6)} = <b>{f.n(v, 6)}</b>
        </p>
      );
    } else if (mode === "is-what") {
      if (y === 0)
        result = (
          <Waiting>{T("The whole can't be 0. Type another number.")}</Waiting>
        );
      else {
        const v = (x / y) * 100;
        result = (
          <Hero
            label={T("{a} is this percent of {b}", {
              a: f.n(x, 6),
              b: f.n(y, 6),
            })}
            value={f.pct(v, 4)}
            raw={v}
          />
        );
        how = (
          <p>
            {f.n(x, 6)} ÷ {f.n(y, 6)} × {f.n(100)} = <b>{f.pct(v, 4)}</b>
          </p>
        );
      }
    } else {
      if (x === 0)
        result = (
          <Waiting>
            {T(
              "A change from 0 has no percentage. Type another starting value.",
            )}
          </Waiting>
        );
      else {
        const diff = y - x;
        const v = (diff / Math.abs(x)) * 100;
        const up = v > 0;
        result = (
          <>
            <Hero
              label={
                v === 0 ? T("No change") : up ? T("Increase") : T("Decrease")
              }
              value={`${up ? "+" : v < 0 ? "−" : ""}${f.pct(Math.abs(v), 4)}`}
              raw={v}
              tone={up ? "good" : v < 0 ? "warn" : undefined}
            />
            <Stats
              rows={[
                {
                  id: "diff",
                  label: T("Difference"),
                  value: `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${f.n(Math.abs(diff), 6)}`,
                  raw: diff,
                },
                {
                  id: "ratio",
                  label: T("New value as a share of the old"),
                  value: f.pct((y / x) * 100, 4),
                  raw: (y / x) * 100,
                },
              ]}
            />
          </>
        );
        how = (
          <p>
            ({f.n(y, 6)} − {f.n(x, 6)}) ÷ {f.n(Math.abs(x), 6)} × {f.n(100)} ={" "}
            <b>{f.pct(v, 4)}</b>
          </p>
        );
      }
    }
  }

  const labels: Record<Mode, [string, string, string?, string?]> = {
    of: [T("Percent"), T("Of"), "%"],
    "is-what": [T("Part"), T("Whole")],
    change: [T("From (old value)"), T("To (new value)")],
  };
  const [la, lb, ua] = labels[mode];

  return (
    <CalcCard
      bar={
        <Choice
          label={T("Question")}
          hideLabel
          value={mode}
          onPick={setMode}
          options={[
            ["of", T("X% of Y")],
            ["is-what", T("X is what % of Y")],
            ["change", T("% change")],
          ]}
        />
      }
      result={result}
      below={how && <How>{how}</How>}
    >
      <NumField
        name="a"
        label={la}
        value={a[mode]}
        unit={ua}
        error={ex}
        onChange={(v) => setA({ ...a, [mode]: v })}
      />
      <NumField
        name="b"
        label={lb}
        value={b[mode]}
        error={ey}
        onChange={(v) => setB({ ...b, [mode]: v })}
      />
    </CalcCard>
  );
}
