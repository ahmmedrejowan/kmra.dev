import { useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Seg } from "@kmra/ui/components/controls";
import { copyText } from "@kmra/ui/components/kit";
import type { ToolProps } from ".";
import {
  col,
  contrast,
  css,
  ratioText,
  textOn,
  toHex,
  toOklchString,
} from "../lib/color";
import {
  cssVariables,
  shadeScale,
  slugName,
  tailwindConfig,
  themeBlock,
  type ValueFormat,
} from "../lib/palette";
import { CodeOut, ColorField, useHashColor } from "../lib/ui";

type Out = "theme" | "config" | "css";

export default function Shades({ preset }: ToolProps) {
  const T = useT();
  const [base, setBase] = useHashColor(col("#1e90ff"));
  const [label, setLabel] = useState("brand");
  const [out, setOut] = useState<Out>(
    preset?.format === "tailwind" ? "theme" : "css",
  );
  const [fmt, setFmt] = useState<ValueFormat>("hex");

  const scale = shadeScale(base);
  const name = slugName(label);
  const entries = scale.map(
    (s) => [`${name}-${s.step}`, s.color] as [string, typeof s.color],
  );
  const code =
    out === "theme"
      ? themeBlock(entries, fmt)
      : out === "config"
        ? tailwindConfig(name, scale, fmt)
        : cssVariables(entries, fmt);
  const at = scale.find((s) => s.base)!;
  const white = col("#fff");

  return (
    <div className="ct-card side-first inputs-first">
      <div className="ct-side">
        <ColorField
          label={T("Base colour")}
          value={base}
          onChange={setBase}
          alpha={false}
        />
        <p className="ct-hint">
          {T(
            "Your colour lands on step {step}, unchanged. The other steps follow a smooth lightness ramp in OKLCH.",
            {
              step: at.step,
            },
          )}
        </p>
        <label className="ct-inline col">
          <span>{T("Colour name")}</span>
          <input
            className="num"
            value={label}
            spellCheck={false}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <Seg
          label={T("Export as")}
          options={[
            ["theme", T("Tailwind v4")],
            ["config", T("Tailwind config")],
            ["css", T("CSS variables")],
          ]}
          value={out}
          onPick={setOut}
        />
        <Seg
          label={T("Values")}
          options={[
            ["hex", "HEX"],
            ["oklch", "OKLCH"],
          ]}
          value={fmt}
          onPick={setFmt}
        />
      </div>

      <div className="ct-main">
        <div className="ct-scale" data-count={scale.length}>
          {scale.map((s) => {
            const hex = toHex(s.color, false);
            const r = contrast(s.color, white);
            return (
              <button
                key={s.step}
                type="button"
                className={`ct-shade${s.base ? " base" : ""}`}
                data-step={s.step}
                data-hex={hex}
                style={{
                  background: css(s.color),
                  color: css(textOn(s.color)),
                }}
                aria-label={T("Copy {step}: {hex}", { step: s.step, hex })}
                title={toOklchString(s.color)}
                onClick={() =>
                  void copyText(
                    hex,
                    T("Copied {what}", { what: hex }),
                    T("Couldn't copy. Select the text and copy it yourself."),
                  )
                }
              >
                <span className="ct-shade-step">{s.step}</span>
                <span className="ct-shade-hex">{hex.slice(1)}</span>
                <span className="ct-shade-ratio" title={T("Contrast on white")}>
                  {ratioText(r)}
                </span>
                {s.base && <span className="ct-shade-base">{T("Base")}</span>}
              </button>
            );
          })}
        </div>
        <p className="ct-cap">
          {T(
            "Click a step to copy it. The small number is its contrast on white; 4.5:1 or more is fine for text.",
          )}
        </p>
        <CodeOut
          code={code}
          label={T("Export")}
          file={out === "config" ? "tailwind.colors.js" : `${name}.css`}
        />
      </div>
    </div>
  );
}
