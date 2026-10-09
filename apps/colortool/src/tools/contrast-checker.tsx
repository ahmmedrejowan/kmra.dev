import { useState, type CSSProperties } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import {
  col,
  contrast,
  css,
  fit,
  passingLightness,
  ratioText,
  toHex,
  toOklch,
  withAlpha,
  type Rgba,
} from "../lib/color";
import { ColorField } from "../lib/ui";

const GROUPS: { what: string; checks: { id: string; level: string; need: number }[] }[] = [
  {
    what: "Normal text",
    checks: [
      { id: "aa-normal", level: "AA", need: 4.5 },
      { id: "aaa-normal", level: "AAA", need: 7 },
    ],
  },
  {
    what: "Large text",
    checks: [
      { id: "aa-large", level: "AA", need: 3 },
      { id: "aaa-large", level: "AAA", need: 4.5 },
    ],
  },
  {
    what: "Icons and input borders",
    checks: [{ id: "ui", level: "AA", need: 3 }],
  },
];

export default function ContrastChecker(_: ToolProps) {
  const T = useT();
  const [fg, setFg] = useState(col("#777777"));
  const [bg, setBg] = useState(col("#ffffff"));
  const ratio = contrast(fg, bg);
  const verdict =
    ratio >= 7
      ? T("Great for any text")
      : ratio >= 4.5
        ? T("Good for text")
        : ratio >= 3
          ? T("Only for large text and icons")
          : T("Too low for text");

  type Fix = { target: number; which: "text" | "background"; c: Rgba };
  const fixes: Fix[] = [];
  for (const target of [4.5, 7]) {
    if (ratio >= target) continue;
    for (const which of ["text", "background"] as const) {
      const [from, against] = which === "text" ? [fg, bg] : [bg, fg];
      const opts = (["lighter", "darker"] as const)
        .map((d) => passingLightness(from, against, target, d))
        .filter((c): c is Rgba => !!c);
      // The option closest to the original colour
      const best = opts.sort(
        (x, y) => dist(x, from) - dist(y, from),
      )[0];
      // Skip suggestions that would turn the design upside down (white into near black)
      if (best && Math.abs(toOklch(best)[0] - toOklch(from)[0]) < 0.45)
        fixes.push({ target, which, c: best });
    }
  }

  return (
    <div className="ct-card side-first inputs-first">
      <div className="ct-side">
        <ColorField label={T("Text colour")} value={fg} onChange={setFg} />
        <ColorField label={T("Background colour")} value={bg} onChange={setBg} />
        <button
          type="button"
          className="btn sm ct-swap"
          onClick={() => {
            setFg(withAlpha(bg, 1));
            setBg(fg.a < 1 ? withAlpha(fg, 1) : fg);
          }}
        >
          <Icon name="convert" />
          {T("Swap text and background")}
        </button>
        <p className="ct-hint">
          {T("Large text is at least 24px, or 18.66px bold. A see-through text colour is blended with the background first.")}
        </p>
      </div>

      <div className="ct-main">
        <div
          className="ct-sample"
          style={{ "--s-fg": css(fg), "--s-bg": css(withAlpha(bg, 1)) } as CSSProperties}
        >
          <p className="ct-sample-big">{T("Large text, 24px")}</p>
          <p>
            {T("Normal text, 16px. The quick brown fox jumps over the lazy dog, and the colours stay easy to read.")}
          </p>
          <div className="ct-sample-ui">
            <span className="ct-sample-btn">{T("Button")}</span>
            <span className="ct-sample-input">{T("Input field")}</span>
            <Icon name="star" />
          </div>
        </div>

        <div className="ct-ratio">
          <strong data-ratio={ratio.toFixed(4)}>{ratioText(ratio)}</strong>
          <span>{verdict}</span>
        </div>

        <div className="ct-checks">
          {GROUPS.map((g) => (
            <section key={g.what} className="ct-checkcard">
              <h4>{T(g.what)}</h4>
              <ul>
                {g.checks.map((c) => {
                  const pass = ratio >= c.need;
                  return (
                    <li
                      key={c.id}
                      data-check={c.id}
                      data-pass={pass}
                      className={pass ? "pass" : "fail"}
                    >
                      <span className="ct-level">{c.level}</span>
                      <span className="ct-need">{c.need}:1</span>
                      <strong>
                        <Icon name={pass ? "check" : "x"} />
                        {pass ? T("Pass") : T("Fail")}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {fixes.length > 0 && (
          <>
            <div className="ct-subhead">
              <h3>{T("Nearest colours that pass")}</h3>
            </div>
            <div className="ct-fixes">
              {fixes.map((f, i) => {
                const hex = toHex(f.c, false);
                const r = f.which === "text" ? contrast(f.c, bg) : contrast(fg, f.c);
                return (
                  <button
                    key={i}
                    type="button"
                    className="ct-fix"
                    data-fix={`${f.which}-${f.target}`}
                    data-hex={hex}
                    onClick={() => (f.which === "text" ? setFg(f.c) : setBg(f.c))}
                  >
                    <span
                      className="ct-fix-sw"
                      style={
                        f.which === "text"
                          ? { background: css(withAlpha(bg, 1)), color: hex }
                          : { background: hex, color: css(fg) }
                      }
                    >
                      Aa
                    </span>
                    <span className="ct-fix-text">
                      <strong>
                        {f.which === "text" ? T("Text {hex}", { hex }) : T("Background {hex}", { hex })}
                      </strong>
                      <span>
                        {ratioText(r)} · {f.target === 7 ? "AAA" : "AA"}
                      </span>
                    </span>
                    <span className="ct-fix-use">{T("Use")}</span>
                  </button>
                );
              })}
            </div>
            <p className="ct-cap">
              {T("Only the lightness changes; the hue stays the same.")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function dist(a: Rgba, b: Rgba) {
  const x = fit(a);
  const y = fit(b);
  return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b);
}
