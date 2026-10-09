import { useMemo, useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { Slider } from "@kmra/ui/components/controls";
import { copyText } from "@kmra/ui/components/kit";
import { formatKeys } from "@kmra/ui/lib/keys";
import type { ToolProps } from ".";
import {
  col,
  css,
  hueOf8bit,
  nearestName,
  randomColor,
  textOn,
  toHex,
  type Rgba,
} from "../lib/color";
import {
  SCHEMES,
  cssVariables,
  jsonOf,
  randomPalette,
  scheme,
  themeBlock,
  type Scheme,
} from "../lib/palette";
import { CodeOut, ColorField, downloadCanvas, useSpace } from "../lib/ui";

type Mode = Scheme | "random";
type Out = "css" | "json" | "tailwind";

const FIRST = ["#264653", "#2a9d8f", "#e9c46a", "#f4a261", "#e76f51"].map(col);

export default function PaletteGenerator({ preset }: ToolProps) {
  const T = useT();
  const start = SCHEMES.some((s) => s.id === preset?.scheme)
    ? (preset!.scheme as Scheme)
    : "random";
  const [mode, setMode] = useState<Mode>(start);
  const [base, setBase] = useState(col("#1e90ff"));
  const [rand, setRand] = useState<Rgba[]>(FIRST);
  const [locks, setLocks] = useState<boolean[]>(FIRST.map(() => false));
  const [out, setOut] = useState<Out>("css");
  const [prefix, setPrefix] = useState("palette");

  const colors = useMemo(
    () => (mode === "random" ? rand : scheme(base, mode)),
    [mode, base, rand],
  );

  function regenerate() {
    if (mode === "random")
      setRand((r) => randomPalette(r.length, r.map((c, i) => (locks[i] ? c : null))));
    else setBase(randomColor());
  }

  useSpace(regenerate);

  function resize(n: number) {
    setRand((r) => {
      if (n <= r.length) return r.slice(0, n);
      return randomPalette(n, r);
    });
    setLocks((l) => Array.from({ length: n }, (_, i) => l[i] ?? false));
  }

  const name = (prefix.trim() || "palette").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const entries: [string, Rgba][] = colors.map((c, i) => [`${name}-${i + 1}`, c]);
  const code =
    out === "css"
      ? cssVariables(entries)
      : out === "json"
        ? jsonOf(entries)
        : themeBlock(entries);

  const canvas = useRef<HTMLCanvasElement>(null);
  async function png() {
    const c = canvas.current!;
    const W = 1600;
    const H = 900;
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    const font = getComputedStyle(document.body).fontFamily;
    const w = W / colors.length;
    colors.forEach((x, i) => {
      g.fillStyle = css(x);
      g.fillRect(Math.floor(i * w), 0, Math.ceil(w) + 1, H);
      g.fillStyle = css(textOn(x));
      g.font = `600 40px ${font}`;
      g.fillText(toHex(x).toUpperCase(), i * w + 32, H - 84);
      g.globalAlpha = 0.75;
      g.font = `400 26px ${font}`;
      g.fillText(nearestName(x).name, i * w + 32, H - 42);
      g.globalAlpha = 1;
    });
    await downloadCanvas(c, `${name}.png`);
  }

  const modes: [Mode, string][] = [
    ["random", T("Random")],
    ...SCHEMES.map((s) => [s.id, T(s.name)] as [Mode, string]),
  ];
  const about =
    mode === "random"
      ? T("Colours that go together. Lock the ones you like and press Space for new ones.")
      : T(SCHEMES.find((s) => s.id === mode)!.about);

  return (
    <div className="ct-card side-first">
      <div className="ct-side">
        <div className="ct-group">
          <span className="ct-glabel">
            <span>{T("Palette")}</span>
          </span>
          <div className="ct-modes" role="group" aria-label={T("Palette")}>
            {modes.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="ct-hint">{about}</p>
        </div>
        {mode === "random" ? (
          <Slider
            label={T("Colours")}
            value={rand.length}
            min={3}
            max={8}
            reset={5}
            onChange={resize}
          />
        ) : (
          <ColorField label={T("Base colour")} value={base} onChange={setBase} alpha={false} />
        )}
        <button type="button" className="btn acc ct-regen" onClick={regenerate}>
          <Icon name="shuffle" />
          {mode === "random" ? T("New palette") : T("Random base colour")}
          <kbd>{T("Space")}</kbd>
        </button>
      </div>

      <div className="ct-main">
        <div className="ct-palette" data-mode={mode} data-count={colors.length}>
          {colors.map((c, i) => {
            const hex = toHex(c, false);
            const ink = css(textOn(c));
            return (
              <div
                key={i}
                className="ct-pcol"
                data-hex={hex}
                data-h={Math.round(hueOf8bit(c))}
                style={{ background: css(c), color: ink }}
              >
                <div className="ct-pacts">
                  {mode === "random" && (
                    <button
                      type="button"
                      className="ct-pbtn"
                      aria-pressed={!!locks[i]}
                      aria-label={locks[i] ? T("Unlock {hex}", { hex }) : T("Lock {hex}", { hex })}
                      title={locks[i] ? T("Unlock") : T("Lock")}
                      onClick={() =>
                        setLocks((l) => l.map((v, j) => (j === i ? !v : v)))
                      }
                    >
                      <Icon name="lock" />
                    </button>
                  )}
                  {mode !== "random" && i > 0 && (
                    <button
                      type="button"
                      className="ct-pbtn"
                      aria-label={T("Use {hex} as the base", { hex })}
                      title={T("Use as the base")}
                      onClick={() => setBase(c)}
                    >
                      <Icon name="pipette" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="ct-pinfo"
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
                </button>
              </div>
            );
          })}
        </div>
        <p className="ct-cap">
          {T("Click a colour to copy it. Press {key} for a new palette.", {
            key: formatKeys("Space"),
          })}
        </p>

        <div className="ct-subhead">
          <h3>{T("Export")}</h3>
          <div className="ct-tabs" role="group" aria-label={T("Export")}>
            {(
              [
                ["css", T("CSS variables")],
                ["json", "JSON"],
                ["tailwind", "Tailwind"],
              ] as [Out, string][]
            ).map(([id, l]) => (
              <button
                key={id}
                type="button"
                aria-pressed={out === id}
                onClick={() => setOut(id)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <label className="ct-inline">
          <span>{T("Name prefix")}</span>
          <input
            className="num"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            spellCheck={false}
          />
        </label>
        <CodeOut code={code} label={T("Export")} />
        <div className="ct-actions">
          <button type="button" className="btn sm ct-png" onClick={() => void png()}>
            <Icon name="image" />
            {T("Download PNG")}
          </button>
          <button
            type="button"
            className="btn sm"
            onClick={() =>
              void copyText(
                colors.map((c) => toHex(c, false)).join(", "),
                T("Copied"),
                T("Couldn't copy. Select the text and copy it yourself."),
              )
            }
          >
            <Icon name="copy" />
            {T("Copy HEX list")}
          </button>
        </div>
        <canvas ref={canvas} hidden />
      </div>
    </div>
  );
}
