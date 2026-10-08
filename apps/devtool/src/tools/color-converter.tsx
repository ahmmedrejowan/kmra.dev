import { useMemo, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import { Pane, Workspace, useInput } from "../lib/kit";
import { Rows, type Row } from "../lib/rows";
import {
  ColorError,
  clampColor,
  contrast,
  format,
  outOfGamut,
  parseColor,
  toHex,
  withAlpha,
  type Kind,
  type Rgba,
} from "../lib/color";

const KIND_NAMES: Record<Kind, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
  hwb: "HWB",
  oklch: "OKLCH",
  oklab: "OKLab",
  name: "a color name",
};

const SAMPLE = "#8e4ec6";

function read(s: string) {
  if (!s.trim()) return null;
  try {
    return { ok: true as const, ...parseColor(s) };
  } catch (e) {
    if (!(e instanceof ColorError)) throw e;
    return { ok: false as const, message: e.message };
  }
}

/** Writes a colour back in the format the person typed (names become HEX) */
function rewrite(c: Rgba, kind: Kind) {
  return format(c, kind === "name" ? "hex" : kind);
}

export default function ColorConverter({ preset }: ToolProps) {
  const T = useT();
  const [input, setInput] = useInput(
    "color-converter",
    typeof preset?.color === "string" ? preset.color : "",
  );
  const [bgInput, setBgInput] = useState("#ffffff");

  const fg = useMemo(() => read(input), [input]);
  const bg = useMemo(() => read(bgInput), [bgInput]);
  const color = fg?.ok ? fg.color : null;
  const back = bg?.ok ? bg.color : null;

  const rows: Row[] = [];
  if (color) {
    const name = format(color, "name");
    const pick = preset?.color ? "rgb" : fg?.ok ? fg.kind : null;
    rows.push(
      {
        id: "hex",
        label: "HEX",
        value: format(color, "hex"),
        on: pick === "hex",
      },
      { id: "hex8", label: T("HEX with alpha"), value: format(color, "hex8") },
      {
        id: "rgb",
        label: "RGB",
        value: format(color, "rgb"),
        on: pick === "rgb",
      },
      {
        id: "rgb-legacy",
        label: T("RGB, with commas"),
        value: format(color, "rgb-legacy"),
      },
      {
        id: "hsl",
        label: "HSL",
        value: format(color, "hsl"),
        on: pick === "hsl",
      },
      {
        id: "hwb",
        label: "HWB",
        value: format(color, "hwb"),
        on: pick === "hwb",
      },
      {
        id: "oklch",
        label: "OKLCH",
        value: format(color, "oklch"),
        on: pick === "oklch",
      },
      {
        id: "oklab",
        label: "OKLab",
        value: format(color, "oklab"),
        on: pick === "oklab",
      },
    );
    if (name)
      rows.push({
        id: "name",
        label: T("Name"),
        value: name,
        on: pick === "name",
      });
  }

  const ratio = color && back ? contrast(color, back) : null;
  const checks: [string, number][] = [
    ["AA, normal text", 4.5],
    ["AA, large text", 3],
    ["AAA, normal text", 7],
    ["AAA, large text", 4.5],
  ];

  function setAlpha(a: number) {
    if (!color || !fg?.ok) return;
    setInput(rewrite(withAlpha(color, a), fg.kind));
  }

  function pickMain(hex6: string) {
    const c = parseColor(hex6).color;
    setInput(fg?.ok ? rewrite(withAlpha(c, color!.a), fg.kind) : hex6);
  }

  const shown = color ? clampColor(color) : null;
  const css = (c: Rgba) => format(c, "rgb");

  return (
    <Workspace
      cols={3}
      bar={
        <>
          <span className="bar-item bar-label">
            {T(
              "Reads HEX, rgb(), hsl(), hwb(), oklch(), oklab() and color names",
            )}
          </span>
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
        !fg ? (
          <span>{T("Type a color or pick one.")}</span>
        ) : fg.ok ? (
          <>
            <span className="ok">
              {T("Read as {kind}", { kind: T(KIND_NAMES[fg.kind]) })}
            </span>
            {fg.color.a < 1 && (
              <span>
                {T("Alpha {n}%", { n: Math.round(fg.color.a * 100) })}
              </span>
            )}
            {outOfGamut(fg.color) && (
              <span>
                {T("Outside the sRGB range, so HEX, RGB and HSL are clipped")}
              </span>
            )}
          </>
        ) : (
          <span className="bad">{T("Not a color")}</span>
        )
      }
    >
      <Pane
        label={T("Color")}
        value={input}
        onChange={setInput}
        error={fg && !fg.ok ? { message: T(fg.message) } : null}
      >
        <div className="dev-list">
          <div className="cc-swatch" aria-hidden="true">
            <i style={shown ? { background: css(shown) } : undefined} />
          </div>
          <div className="dev-form">
            <label className="dev-field">
              <span>{T("Color in any CSS format")}</span>
              <span className="cc-inrow">
                <input
                  className="dev-input mono"
                  value={input}
                  placeholder="#8e4ec6"
                  aria-label={T("Color")}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(e) => setInput(e.target.value)}
                />
                <input
                  type="color"
                  className="cc-picker"
                  aria-label={T("Pick a color")}
                  value={shown ? toHex(shown, false) : "#000000"}
                  onChange={(e) => pickMain(e.target.value)}
                />
              </span>
            </label>
            <label className="dev-field">
              <span>
                {T("Alpha")}: {color ? Math.round(color.a * 100) : 100}%
              </span>
              <input
                type="range"
                className="cc-range"
                min={0}
                max={100}
                disabled={!color}
                value={color ? Math.round(color.a * 100) : 100}
                onChange={(e) => setAlpha(Number(e.target.value) / 100)}
              />
            </label>
          </div>
        </div>
      </Pane>
      <Pane
        label={T("Formats")}
        value={rows.map((r) => `${r.label}: ${r.value}`).join("\n")}
        readOnly
      >
        <div className="dev-list">
          <Rows
            rows={rows}
            empty={T("Every format appears here as you type.")}
          />
        </div>
      </Pane>
      <Pane
        label={T("Contrast")}
        value={ratio ? `${ratio.toFixed(2)}:1` : ""}
        readOnly
      >
        <div className="dev-list">
          <div className="dev-form">
            <label className="dev-field">
              <span>{T("Background color")}</span>
              <span className="cc-inrow">
                <input
                  className="dev-input mono"
                  value={bgInput}
                  aria-label={T("Background")}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(e) => setBgInput(e.target.value)}
                />
                <input
                  type="color"
                  className="cc-picker"
                  aria-label={T("Pick a background color")}
                  value={back ? toHex(clampColor(back), false) : "#ffffff"}
                  onChange={(e) => setBgInput(e.target.value)}
                />
                <button
                  type="button"
                  className="btn xs"
                  disabled={!fg?.ok || !bg?.ok}
                  title={T("Swap text and background")}
                  onClick={() => {
                    setInput(bgInput);
                    setBgInput(input);
                  }}
                >
                  <Icon name="convert" />
                  {T("Swap")}
                </button>
              </span>
            </label>
            {bg && !bg.ok && <p className="cc-bad">{T(bg.message)}</p>}
          </div>
          {ratio !== null && shown && back && (
            <>
              <div
                className="cc-sample"
                style={{ background: css(clampColor(back)), color: css(shown) }}
              >
                <p className="cc-large">{T("Large text, 24px")}</p>
                <p>
                  {T(
                    "Normal text, 16px. The quick brown fox jumps over the lazy dog.",
                  )}
                </p>
              </div>
              <p className="cc-ratio">
                <strong data-ratio>{ratio.toFixed(2)}:1</strong>
                <span className="muted">{T("contrast ratio")}</span>
              </p>
              <ul className="cc-checks">
                {checks.map(([label, need]) => {
                  const pass = ratio >= need;
                  return (
                    <li key={label} className={pass ? "pass" : "fail"}>
                      <span>{T(label)}</span>
                      <span className="muted">{need}:1</span>
                      <strong>{pass ? T("Pass") : T("Fail")}</strong>
                    </li>
                  );
                })}
              </ul>
              <p className="dev-note">
                {T(
                  "Large text is 24px, or 18.66px bold. A see-through text color is blended with the background first.",
                )}
              </p>
            </>
          )}
        </div>
      </Pane>
    </Workspace>
  );
}
