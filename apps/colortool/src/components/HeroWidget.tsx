import { useState } from "react";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useLp, useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { copyText } from "@kmra/ui/components/kit";
import { formatKeys } from "@kmra/ui/lib/keys";
import { col, css, nearestName, textOn, toHex, type Rgba } from "../lib/color";
import { randomPalette } from "../lib/palette";
import { useSpace } from "../lib/ui";
import "../color.css";

const FIRST = ["#1d3557", "#457b9d", "#a8dadc", "#f1faee", "#e63946"].map(col);

/** Home page hero: a five-colour palette that changes on Space; click a colour to copy it. */
function Strip() {
  const T = useT();
  const L = useLp();
  const [colors, setColors] = useState<Rgba[]>(FIRST);
  const next = () => setColors(randomPalette(5));
  useSpace(next);

  return (
    <div className="ct-herowidget">
      <div className="ct-strip" data-count={colors.length}>
        {colors.map((c, i) => {
          const hex = toHex(c, false);
          return (
            <button
              key={i}
              type="button"
              className="ct-strip-cell"
              data-hex={hex}
              style={{ background: css(c), color: css(textOn(c)) }}
              aria-label={T("Copy {hex}", { hex })}
              onClick={() =>
                void copyText(
                  hex,
                  T("Copied {what}", { what: hex }),
                  T("Couldn't copy. Select the text and copy it yourself."),
                )
              }
            >
              <strong>{hex.slice(1).toUpperCase()}</strong>
              <span>{nearestName(c).name}</span>
              <em className="ct-strip-copy">
                <Icon name="copy" />
                {T("Copy")}
              </em>
            </button>
          );
        })}
      </div>
      <div className="ct-strip-foot">
        <button type="button" className="btn acc ct-strip-new" onClick={next}>
          <Icon name="shuffle" />
          {T("New palette")}
        </button>
        <span className="muted ct-strip-hint">
          {T("or press {key}. Click a colour to copy it.", { key: formatKeys("Space") })}
        </span>
        <a className="btn" href={L("/palette-generator")}>
          <Icon name="palette" />
          {T("Open the palette generator")}
        </a>
      </div>
    </div>
  );
}

export default function HeroWidget({ lang = "en" }: { lang?: Locale }) {
  return (
    <LangProvider lang={lang}>
      <Strip />
    </LangProvider>
  );
}
