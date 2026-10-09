import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLp, useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { copyText } from "@kmra/ui/components/kit";
import type { ToolProps } from ".";
import {
  col,
  contrast,
  css,
  fit,
  mix,
  nearestName,
  parseColor,
  randomColor,
  ratioText,
  textOn,
  toCmykString,
  toHex,
  toHslString,
  toHsvString,
  toHwbString,
  toLinearString,
  toOklabString,
  toOklchString,
  toRgbString,
  withAlpha,
  type Rgba,
} from "../lib/color";
import { CopyRow, Picker, useHashColor } from "../lib/ui";

const START = col("#1e90ff");

export default function ColorPicker({ preset }: ToolProps) {
  const T = useT();
  const L = useLp();
  const [color, setColor] = useHashColor(START);
  const focus = typeof preset?.focus === "string" ? preset.focus : null;
  const [draft, setDraft] = useState(toHex(START));
  const [bad, setBad] = useState(false);
  const typing = useRef(false);

  useEffect(() => {
    if (!typing.current) {
      setDraft(toHex(color));
      setBad(false);
    }
  }, [color]);

  const c = fit(color);
  const opaque = withAlpha(c, 1);
  const name = nearestName(c);
  const onWhite = contrast(opaque, col("#fff"));
  const onBlack = contrast(opaque, col("#000"));
  const ink = textOn(opaque);

  const rows = useMemo(() => {
    const list: [string, string, string][] = [
      ["hex", "HEX", toHex(c)],
      ["rgb", "RGB", toRgbString(c)],
      ["hsl", "HSL", toHslString(c)],
      ["hsv", "HSV / HSB", toHsvString(c)],
      ["hwb", "HWB", toHwbString(c)],
      ["cmyk", "CMYK", toCmykString(c)],
      ["oklch", "OKLCH", toOklchString(c)],
      ["oklab", "OKLab", toOklabString(c)],
      ["linear", T("Linear RGB"), toLinearString(c)],
    ];
    if (focus) {
      const i = list.findIndex((r) => r[0] === focus);
      if (i > 0) list.unshift(...list.splice(i, 1));
    }
    return list;
  }, [c.r, c.g, c.b, c.a, focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const white = col("#fff");
  const black = col("#000");
  const ramp: [string, Rgba][] = [
    ...[0.8, 0.6, 0.4, 0.2].map(
      (t) => [`${T("Tint")} ${Math.round(t * 100)}%`, fit(mix(opaque, white, t))] as [string, Rgba],
    ),
    [T("Base"), opaque],
    ...[0.2, 0.4, 0.6, 0.8].map(
      (t) => [`${T("Shade")} ${Math.round(t * 100)}%`, fit(mix(opaque, black, t))] as [string, Rgba],
    ),
  ];

  function type(v: string) {
    setDraft(v);
    try {
      setColor(fit(parseColor(v).color));
      setBad(false);
    } catch {
      setBad(v.trim().length > 0);
    }
  }

  const hex6 = toHex(c, false);
  return (
    <div className="ct-card side-first inputs-first">
      <div className="ct-side">
        <Picker value={c} onChange={setColor} big />
        <div className="ct-group">
          <label className="ct-glabel" htmlFor="ct-any">
            <span>{T("Type or paste any colour")}</span>
          </label>
          <div className={`ct-finput${bad ? " bad" : ""}`}>
            <label className="ct-fsw native" title={T("System colour picker")}>
              <i style={{ background: css(c) }} />
              <input
                type="color"
                value={hex6}
                aria-label={T("System colour picker")}
                onChange={(e) => setColor(withAlpha(col(e.target.value), c.a))}
              />
            </label>
            <input
              id="ct-any"
              value={draft}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={bad}
              placeholder="#1e90ff, rgb(30 144 255), hsl(210 100% 56%)"
              onFocus={() => (typing.current = true)}
              onBlur={() => {
                typing.current = false;
                setDraft(toHex(c));
                setBad(false);
              }}
              onChange={(e) => type(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          </div>
          <p className={`ct-hint${bad ? " bad" : ""}`} role={bad ? "alert" : undefined}>
            {bad
              ? T("That isn't a colour yet. Try #1e90ff, rgb(30 144 255) or a name like teal.")
              : T("HEX, RGB, HSL, HWB, OKLCH, OKLab, CMYK, names, or just 30 144 255.")}
          </p>
        </div>
        <div className="ct-actions">
          <button type="button" className="btn sm" onClick={() => setColor(randomColor())}>
            <Icon name="shuffle" />
            {T("Random colour")}
          </button>
          <button
            type="button"
            className="btn sm"
            onClick={() =>
              void copyText(
                location.href,
                T("Link copied"),
                T("Couldn't copy. Select the text and copy it yourself."),
              )
            }
          >
            <Icon name="link" />
            {T("Copy link")}
          </button>
        </div>
      </div>

      <div className="ct-main">
        <div
          className="ct-hero checker"
          style={{ "--c": css(c), color: css(ink) } as CSSProperties}
        >
          <div className="ct-hero-fill" />
          <div className="ct-hero-text">
            <strong className="ct-hero-hex" data-hex={toHex(c)}>
              {toHex(c)}
            </strong>
            <span className="ct-hero-name" data-name={name.name}>
              {name.exact
                ? name.name
                : T("Close to {name}", { name: name.name })}
            </span>
          </div>
          <div className="ct-hero-ink">
            <span
              className={`ct-pill${onWhite >= onBlack ? " on" : ""}`}
              style={{ background: "#fff", color: hex6 }}
            >
              {T("On white")} {ratioText(onWhite)}
            </span>
            <span
              className={`ct-pill${onBlack > onWhite ? " on" : ""}`}
              style={{ background: "#000", color: hex6 }}
            >
              {T("On black")} {ratioText(onBlack)}
            </span>
          </div>
        </div>

        <div className="ct-rows" aria-label={T("Formats")}>
          {rows.map(([id, label, value]) => (
            <CopyRow key={id} id={id} label={label} value={value} on={id === focus} />
          ))}
          <CopyRow
            id="name"
            label={T("Nearest name")}
            value={name.name}
          />
        </div>

        <div className="ct-subhead">
          <h3>{T("Tints and shades")}</h3>
          <a className="ct-link" href={L(`/shades#${hex6.slice(1)}`)}>
            {T("Full 50–950 scale")}
            <Icon name="right" />
          </a>
        </div>
        <div className="ct-ramp">
          {ramp.map(([label, x], i) => (
            <button
              key={i}
              type="button"
              className={`ct-ramp-cell${i === 4 ? " base" : ""}`}
              style={{ background: css(x), color: css(textOn(x)) }}
              aria-label={`${label}: ${toHex(x)}`}
              title={T("Use {hex}", { hex: toHex(x) })}
              onClick={() => setColor(withAlpha(x, c.a))}
            >
              <span>{toHex(x).slice(1)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
