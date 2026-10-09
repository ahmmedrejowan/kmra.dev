import { useState, type CSSProperties } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Seg, Slider, Toggle } from "@kmra/ui/components/controls";
import { CopyBtn, copyText } from "@kmra/ui/components/kit";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import {
  col,
  css,
  fit,
  mix,
  steps,
  textOn,
  toHex,
  toOklchString,
  toRgbString,
  type Space,
} from "../lib/color";
import { ColorField, CopyRow } from "../lib/ui";

export default function ColorMixer(_: ToolProps) {
  const T = useT();
  const [a, setA] = useState(col("#ff5e62"));
  const [b, setB] = useState(col("#3d7bff"));
  const [ratio, setRatio] = useState(50);
  const [n, setN] = useState(7);
  const [space, setSpace] = useState<Space>("oklab");
  const [compare, setCompare] = useState(true);

  const t = ratio / 100;
  const result = fit(mix(a, b, t, space));
  const list = steps(a, b, n, space);
  const plain = steps(a, b, n, "srgb");
  const ink = textOn(result);

  const allCss = `:root {\n${list.map((c, i) => `  --mix-${i + 1}: ${toHex(c)};`).join("\n")}\n}`;
  const mixCss = `color-mix(in ${space}, ${toHex(a)} ${100 - ratio}%, ${toHex(b)})`;

  const spaces: [Space, string][] = [
    ["oklab", "OKLab"],
    ["oklch", "OKLCH"],
    ["srgb", "sRGB"],
    ["srgb-linear", T("Linear")],
  ];

  return (
    <div className="ct-card side-first inputs-first">
      <div className="ct-side">
        <ColorField label={T("First colour")} value={a} onChange={setA} />
        <ColorField label={T("Second colour")} value={b} onChange={setB} />
        <button
          type="button"
          className="btn sm ct-swap"
          onClick={() => {
            setA(b);
            setB(a);
          }}
        >
          <Icon name="convert" />
          {T("Swap colours")}
        </button>
        <Slider
          label={T("Amount of the second colour")}
          value={ratio}
          min={0}
          max={100}
          unit="%"
          reset={50}
          onChange={setRatio}
        />
        <Seg label={T("Mix in")} options={spaces} value={space} onPick={setSpace} />
        <p className="ct-hint">
          {space === "oklab"
            ? T("OKLab mixes evenly, the way eyes see colour.")
            : space === "oklch"
              ? T("OKLCH keeps colours vivid by going round the hue wheel.")
              : space === "srgb"
                ? T("sRGB is how browsers mix by default. Middles can look grey or dull.")
                : T("Linear light mixes like real light, so middles look bright.")}
        </p>
        <Slider
          label={T("Steps")}
          value={n}
          min={3}
          max={15}
          reset={7}
          onChange={setN}
        />
        {space !== "srgb" && (
          <Toggle label={T("Compare with sRGB")} on={compare} onChange={setCompare} />
        )}
      </div>

      <div className="ct-main">
        <div className="ct-mix">
          <div className="ct-mix-end" style={{ background: css(a) }} />
          <div
            className="ct-mix-result"
            data-hex={toHex(result)}
            style={{ "--c": css(result), color: css(ink) } as CSSProperties}
          >
            <span className="ct-mix-pct">
              {100 - ratio}% + {ratio}%
            </span>
            <strong>{toHex(result)}</strong>
          </div>
          <div className="ct-mix-end" style={{ background: css(b) }} />
        </div>

        <div className="ct-rows">
          <CopyRow id="hex" label="HEX" value={toHex(result)} on />
          <CopyRow id="rgb" label="RGB" value={toRgbString(result)} />
          <CopyRow id="oklch" label="OKLCH" value={toOklchString(result)} />
          <CopyRow id="css" label={T("CSS color-mix()")} value={mixCss} />
        </div>

        <div className="ct-subhead">
          <h3>{T("{n} steps", { n })}</h3>
          <CopyBtn text={allCss} className="btn sm" label={T("Copy all as CSS")} />
        </div>
        <div className="ct-steps" data-steps={list.length}>
          {list.map((c, i) => (
            <button
              key={i}
              type="button"
              className="ct-step"
              data-hex={toHex(c)}
              style={{ background: css(c), color: css(textOn(c)) }}
              aria-label={T("Copy {hex}", { hex: toHex(c) })}
              onClick={() =>
                void copyText(
                  toHex(c),
                  T("Copied {what}", { what: toHex(c) }),
                  T("Couldn't copy. Select the text and copy it yourself."),
                )
              }
            >
              <span>{toHex(c).slice(1)}</span>
            </button>
          ))}
        </div>
        {compare && space !== "srgb" && (
          <>
            <p className="ct-cap">{T("The same steps mixed in sRGB")}</p>
            <div className="ct-steps thin" aria-hidden="true">
              {plain.map((c, i) => (
                <span key={i} className="ct-step" style={{ background: css(c) }} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
