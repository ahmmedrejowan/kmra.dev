import { useMemo, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { ToolProps } from ".";
import {
  BarCheck,
  BarField,
  BarSeg,
  Pane,
  Workspace,
  useInput,
} from "../lib/kit";
import { Rows, type Row } from "../lib/rows";
import { lineCol } from "../lib/encode";
import {
  BaseError,
  bitLength,
  group,
  parseBase,
  toBase,
  twos,
} from "../lib/numbase";

/** 0 = detect, -1 = the custom base field */
type From = 0 | 2 | 8 | 10 | 16 | -1;

const NAMES: Record<number, string> = {
  2: "Binary",
  8: "Octal",
  10: "Decimal",
  16: "Hexadecimal",
};
const PREFIX: Record<number, string> = { 2: "0b", 8: "0o", 16: "0x" };
/** Digits per group: nibbles for binary and hex, thousands for decimal */
const GROUP: Record<number, number> = { 2: 4, 8: 3, 10: 3, 16: 4 };

const SAMPLE = "123456789012345678901234567890";

function clampBase(v: string, fallback: number) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 2 && n <= 36 ? n : fallback;
}

export default function NumberBase({ preset }: ToolProps) {
  const T = useT();
  const [input, setInput] = useInput("number-base");
  const [from, setFrom] = useState<From>(
    ([0, 2, 8, 10, 16] as const).find((b) => b === preset?.from) ?? 0,
  );
  const [custom, setCustom] = useState("36");
  const [other, setOther] = useState("36");
  const [prefix, setPrefix] = useState(true);
  const [grouped, setGrouped] = useState(false);
  const [upper, setUpper] = useState(false);
  const [all, setAll] = useState(false);

  const inBase = from === -1 ? clampBase(custom, 36) : from;
  const outBase = clampBase(other, 36);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      return { ok: true as const, ...parseBase(input, inBase) };
    } catch (e) {
      if (!(e instanceof BaseError)) throw e;
      return { ok: false as const, error: e };
    }
  }, [input, inBase]);

  function show(n: bigint, base: number) {
    let d = toBase(n, base, upper);
    if (grouped) d = group(d, GROUP[base] ?? 4, base === 10 ? "," : " ");
    if (prefix && PREFIX[base])
      d = d.startsWith("-")
        ? `-${PREFIX[base]}${d.slice(1)}`
        : PREFIX[base] + d;
    return d;
  }

  const rows: Row[] = [];
  const twosRows: Row[] = [];
  if (result?.ok) {
    const n = result.value;
    for (const b of [2, 8, 10, 16])
      rows.push({
        id: `b${b}`,
        label: T(NAMES[b]!),
        value: show(n, b),
        on: b === result.base,
      });
    const extra = all
      ? Array.from({ length: 35 }, (_, i) => i + 2).filter((b) => !NAMES[b])
      : NAMES[outBase]
        ? []
        : [outBase];
    for (const b of extra)
      rows.push({
        id: `b${b}`,
        label: T("Base {n}", { n: b }),
        value: show(n, b),
        on: b === result.base,
      });
    for (const bits of [8, 16, 32, 64]) {
      const t = twos(n, bits);
      if (!t) continue;
      const hex = upper ? t.hex.toUpperCase() : t.hex;
      twosRows.push({
        id: `t${bits}`,
        label: T("{n}-bit", { n: bits }),
        value: grouped ? group(t.bin, 4) : t.bin,
        note:
          (prefix ? "0x" : "") +
          (grouped ? group(hex, 4) : hex) +
          (t.signed !== n
            ? " · " + T("signed {n}", { n: t.signed.toString() })
            : t.unsigned !== n
              ? " · " + T("unsigned {n}", { n: t.unsigned.toString() })
              : ""),
      });
    }
  }

  const error =
    result && !result.ok
      ? {
          message:
            T(result.error.message) +
            (result.error.detail ? ` “${result.error.detail}”` : ""),
          ...(result.error.index !== undefined
            ? lineCol(input, result.error.index)
            : {}),
        }
      : null;

  const bits = result?.ok ? bitLength(result.value) : 0;

  return (
    <Workspace
      bar={
        <>
          <BarSeg<From>
            label={T("From")}
            options={[
              [0, T("Detect")],
              [2, T("Binary")],
              [8, T("Octal")],
              [10, T("Decimal")],
              [16, T("Hex")],
              [-1, T("Other")],
            ]}
            value={from}
            onPick={setFrom}
          />
          {from === -1 && (
            <BarField
              label={T("Base")}
              type="number"
              min={2}
              max={36}
              width={64}
              value={custom}
              onChange={setCustom}
            />
          )}
          <BarField
            label={T("Also show base")}
            type="number"
            min={2}
            max={36}
            width={64}
            value={other}
            onChange={setOther}
          />
          <BarCheck label={T("All bases")} on={all} onChange={setAll} />
          <BarCheck label={T("Prefixes")} on={prefix} onChange={setPrefix} />
          <BarCheck
            label={T("Group digits")}
            on={grouped}
            onChange={setGrouped}
          />
          <BarCheck label={T("Uppercase")} on={upper} onChange={setUpper} />
          {!input && (
            <button
              type="button"
              className="btn xs bar-push"
              onClick={() => setInput(SAMPLE)}
            >
              {T("Try a sample")}
            </button>
          )}
        </>
      }
      status={
        !result ? (
          <span>
            {T(
              "Type a whole number. 0b, 0o and 0x prefixes and negative numbers work.",
            )}
          </span>
        ) : result.ok ? (
          <>
            <span className="ok">
              {T("Read as {base}", {
                base: NAMES[result.base]
                  ? T(NAMES[result.base]!).toLowerCase()
                  : T("base {n}", { n: result.base }),
              })}
            </span>
            <span>{T("{n} bits", { n: bits })}</span>
            <span>
              {T("{n} decimal digits", {
                n: toBase(result.value, 10).replace("-", "").length,
              })}
            </span>
          </>
        ) : (
          <span className="bad">{T("Not a number in this base")}</span>
        )
      }
    >
      <Pane
        label={T("Number")}
        value={input}
        onChange={setInput}
        error={error}
        wrap
        placeholder={T("Type a number, e.g. 255, 0xff or -1")}
      />
      <Pane
        label={T("Converted")}
        value={[...rows, ...twosRows]
          .map(
            (r) => `${typeof r.label === "string" ? r.label : ""}: ${r.value}`,
          )
          .join("\n")}
        readOnly
      >
        <div className="dev-list">
          <Rows rows={rows} empty={T("Every base appears here as you type.")} />
          {twosRows.length > 0 && (
            <>
              <h3 className="dev-sub">{T("Two's complement")}</h3>
              <Rows rows={twosRows} />
            </>
          )}
          {result?.ok && !twosRows.length && (
            <p className="dev-note">
              {T("Too large for 64-bit two's complement.")}
            </p>
          )}
        </div>
      </Pane>
    </Workspace>
  );
}
