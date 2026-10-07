import {
  useRef,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  ADJUST_SLIDERS,
  FILTERS,
  GRADIENTS,
  NO_ADJUST,
  NO_FRAME,
  PHOTO_SPECS,
  SHEETS,
  type Adjust,
  type Bg,
  type Frame,
  type Ink,
  type Redact,
  type Spot,
  type TextLayer,
  type Watermark,
} from "../lib/fx";
import { RATIOS, type Settings } from "../lib/settings";

/** Controls for the effects in fx.ts. Each takes the settings and the state setter. */
interface P {
  s: Settings;
  setS: Dispatch<SetStateAction<Settings>>;
}

export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  onChange,
  reset,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  /** Double-click the slider to return to this value */
  reset?: number;
}) {
  return (
    <div className="ctl">
      <label>
        {label}
        <span>
          {value > 0 && min < 0 ? "+" : ""}
          {Math.round(value * 10) / 10}
          {unit}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        onDoubleClick={() => reset !== undefined && onChange(reset)}
        aria-label={label}
      />
    </div>
  );
}

export function Seg<T extends string | number | boolean>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: [T, string][];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="ctl">
      <span className="lbl">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map(([v, l]) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={v === value}
            onClick={() => onPick(v)}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

const SWATCHES = [
  "#ffffff",
  "#000000",
  "#e5484d",
  "#f5a524",
  "#30a46c",
  "#0057ff",
  "#8e4ec6",
  "#f0f0f0",
];

export function Colors({
  label,
  value,
  onPick,
  list = SWATCHES,
  extra,
}: {
  label: string;
  value: string;
  onPick: (v: string) => void;
  list?: string[];
  extra?: ReactNode;
}) {
  return (
    <div className="ctl">
      <span className="lbl">{label}</span>
      <div className="swatches">
        {extra}
        {list.map((c) => (
          <button
            key={c}
            type="button"
            className="sw"
            style={{ background: c }}
            aria-label={c}
            aria-pressed={value.toLowerCase() === c}
            onClick={() => onPick(c)}
          />
        ))}
        <label className="sw pick" title="Pick any colour">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
            onChange={(e) => onPick(e.target.value)}
            aria-label={`${label}: pick any colour`}
          />
        </label>
      </div>
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/* ---------- Adjust ---------- */

export function AdjustCtl({ s, setS }: P) {
  const a = s.adjust ?? NO_ADJUST;
  const put = (k: keyof Adjust, v: number) =>
    setS((p) => ({ ...p, adjust: { ...(p.adjust ?? NO_ADJUST), [k]: v } }));
  const changed = ADJUST_SLIDERS.some((x) => a[x.key] !== 0);
  return (
    <>
      {ADJUST_SLIDERS.map((x) => (
        <Slider
          key={x.key}
          label={x.label}
          min={x.min}
          value={a[x.key]}
          reset={0}
          onChange={(v) => put(x.key, v)}
        />
      ))}
      {changed && (
        <button
          type="button"
          className="btn sm"
          onClick={() => setS((p) => ({ ...p, adjust: { ...NO_ADJUST } }))}
        >
          Reset sliders
        </button>
      )}
    </>
  );
}

/* ---------- Filters ---------- */

export function FilterCtl({ s, setS }: P) {
  return (
    <>
      <div className="ctl">
        <span className="lbl">Look</span>
        <div className="looks">
          <button
            type="button"
            aria-pressed={s.filter === null}
            onClick={() => setS((p) => ({ ...p, filter: null }))}
          >
            <i style={{ background: "var(--raise)" }} />
            None
          </button>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={s.filter === f.id}
              onClick={() => setS((p) => ({ ...p, filter: f.id }))}
            >
              <i style={{ background: f.swatch }} />
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {s.filter && (
        <Slider
          label="Strength"
          value={s.filterAmount}
          unit="%"
          reset={100}
          onChange={(v) => setS((p) => ({ ...p, filterAmount: v }))}
        />
      )}
    </>
  );
}

/* ---------- Frame: border, padding, background, screenshot ---------- */

export function FrameCtl({
  s,
  setS,
  mode,
}: P & { mode: "border" | "extend" | "beautify" | "all" }) {
  const f = s.frame ?? NO_FRAME;
  const put = (patch: Partial<Frame>) =>
    setS((p) => ({ ...p, frame: { ...(p.frame ?? NO_FRAME), ...patch } }));
  const show = (...m: string[]) => mode === "all" || m.includes(mode);
  const ratioChips = (
    <div className="ctl">
      <span className="lbl">Canvas shape</span>
      <div className="chips">
        <button
          type="button"
          aria-pressed={f.ratio === null}
          onClick={() => put({ ratio: null })}
        >
          {mode === "extend" ? "Even padding" : "Auto"}
        </button>
        {RATIOS.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={f.ratio === r.id}
            onClick={() => put({ ratio: r.id })}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
  const fill = (
    <>
      <Seg<Frame["fill"]>
        label="Background"
        options={[
          ["blur", "Blurred"],
          ["color", "Colour"],
          ["gradient", "Gradient"],
          ["transparent", "None"],
        ]}
        value={f.fill}
        onPick={(v) => put({ fill: v })}
      />
      {f.fill === "color" && (
        <Colors
          label="Colour"
          value={f.color}
          onPick={(v) => put({ color: v })}
        />
      )}
      {f.fill === "gradient" && (
        <div className="ctl">
          <span className="lbl">Gradient</span>
          <div className="swatches">
            {GRADIENTS.map((g) => (
              <button
                key={g.id}
                type="button"
                className="sw"
                aria-label={g.id}
                aria-pressed={f.gradient === g.id}
                style={{
                  background: `linear-gradient(135deg,${g.stops.join(",")})`,
                }}
                onClick={() => put({ gradient: g.id })}
              />
            ))}
          </div>
        </div>
      )}
      {f.fill === "transparent" && (
        <small className="muted">
          Save as PNG or WebP to keep the padding transparent.
        </small>
      )}
    </>
  );
  return (
    <>
      {show("extend", "beautify") && ratioChips}
      {show("extend", "beautify") && (
        <Slider
          label="Padding"
          value={f.pad}
          max={40}
          unit="%"
          reset={0}
          onChange={(v) => put({ pad: v })}
        />
      )}
      {show("extend", "beautify") && fill}
      {show("border") && (
        <>
          <Slider
            label="Border"
            value={f.border}
            max={15}
            step={0.5}
            unit="%"
            reset={0}
            onChange={(v) => put({ border: v })}
          />
          {f.border > 0 && (
            <Colors
              label="Border colour"
              value={f.borderColor}
              onPick={(v) => put({ borderColor: v })}
            />
          )}
        </>
      )}
      <Slider
        label="Rounded corners"
        value={f.radius}
        max={50}
        step={0.5}
        unit="%"
        reset={0}
        onChange={(v) => put({ radius: v })}
      />
      {show("beautify", "border") && (
        <Toggle
          label="Drop shadow"
          on={f.shadow}
          onChange={(v) => put({ shadow: v })}
        />
      )}
      {show("beautify") && (
        <Seg<Frame["chrome"]>
          label="Window bar"
          options={[
            ["none", "None"],
            ["light", "Light"],
            ["dark", "Dark"],
          ]}
          value={f.chrome}
          onPick={(v) => put({ chrome: v })}
        />
      )}
      {mode === "border" && f.radius > 0 && (
        <small className="muted">
          Corners stay transparent in PNG and WebP. JPEG fills them with white.
        </small>
      )}
    </>
  );
}

/* ---------- Meme / caption text ---------- */

export function TextCtl({ s, setS }: P) {
  const t = s.text!;
  const put = (patch: Partial<TextLayer>) =>
    setS((p) => ({ ...p, text: { ...p.text!, ...patch } }));
  return (
    <>
      <div className="ctl">
        <label htmlFor="tx-top">Top text</label>
        <textarea
          id="tx-top"
          className="num"
          rows={2}
          value={t.top}
          placeholder="Text at the top"
          onChange={(e) => put({ top: e.target.value })}
        />
      </div>
      <div className="ctl">
        <label htmlFor="tx-bottom">Bottom text</label>
        <textarea
          id="tx-bottom"
          className="num"
          rows={2}
          value={t.bottom}
          placeholder="Text at the bottom"
          onChange={(e) => put({ bottom: e.target.value })}
        />
      </div>
      <Seg<TextLayer["font"]>
        label="Font"
        options={[
          ["impact", "Meme"],
          ["sans", "Clean"],
          ["serif", "Serif"],
        ]}
        value={t.font}
        onPick={(v) => put({ font: v })}
      />
      <Slider
        label="Size"
        value={t.size}
        min={3}
        max={20}
        step={0.5}
        unit="%"
        reset={10}
        onChange={(v) => put({ size: v })}
      />
      <Colors
        label="Colour"
        value={t.color}
        onPick={(v) => put({ color: v })}
      />
      <Toggle
        label="Outline"
        on={t.stroke}
        onChange={(v) => put({ stroke: v })}
      />
    </>
  );
}

/* ---------- Watermark ---------- */

const SPOTS: Spot[] = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];

export function MarkCtl({ s, setS }: P) {
  const m = s.mark!;
  const logoRef = useRef<HTMLInputElement>(null);
  const put = (patch: Partial<Watermark>) =>
    setS((p) => ({ ...p, mark: { ...p.mark!, ...patch } }));
  return (
    <>
      <Seg<"text" | "logo">
        label="Watermark"
        options={[
          ["text", "Text"],
          ["logo", "Logo"],
        ]}
        value={m.logo ? "logo" : "text"}
        onPick={(v) =>
          v === "logo"
            ? logoRef.current?.click()
            : put({ logo: null, logoName: "", size: 4 })
        }
      />
      <input
        ref={logoRef}
        type="file"
        accept="image/png,image/svg+xml,image/webp,image/jpeg"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) put({ logo: f, logoName: f.name, size: 20 });
          e.target.value = "";
        }}
      />
      {m.logo ? (
        <div className="ctl">
          <span className="lbl">Logo</span>
          <div className="filepill">
            <span>{m.logoName}</span>
            <button
              type="button"
              className="btn sm"
              onClick={() => logoRef.current?.click()}
            >
              Change
            </button>
          </div>
          <small className="muted">
            A PNG with a transparent background looks best.
          </small>
        </div>
      ) : (
        <div className="ctl">
          <label htmlFor="wm-text">Text</label>
          <input
            id="wm-text"
            className="num"
            value={m.text}
            onChange={(e) => put({ text: e.target.value })}
          />
        </div>
      )}
      <div className="ctl">
        <span className="lbl">Position</span>
        <div className="spot-row">
          <div className="spots" role="group" aria-label="Position">
            {SPOTS.map((p) => (
              <button
                key={p}
                type="button"
                aria-label={p}
                aria-pressed={m.pos === p}
                onClick={() => put({ pos: p })}
              />
            ))}
          </div>
          <button
            type="button"
            className="btn sm"
            aria-pressed={m.pos === "tile"}
            onClick={() => put({ pos: "tile" })}
          >
            Repeat across
          </button>
        </div>
      </div>
      <Slider
        label="Size"
        value={m.size}
        min={1}
        max={m.logo ? 60 : 20}
        step={0.5}
        unit="%"
        onChange={(v) => put({ size: v })}
      />
      <Slider
        label="Opacity"
        value={m.opacity}
        min={5}
        unit="%"
        onChange={(v) => put({ opacity: v })}
      />
      {!m.logo && (
        <Colors
          label="Colour"
          value={m.color}
          onPick={(v) => put({ color: v })}
        />
      )}
    </>
  );
}

/* ---------- Blur / pixelate ---------- */

export function RedactCtl({ s, setS, extra }: P & { extra?: ReactNode }) {
  const r = s.redact!;
  const put = (patch: Partial<Redact>) =>
    setS((p) => ({ ...p, redact: { ...p.redact!, ...patch } }));
  return (
    <>
      <Toggle
        label="Find and cover faces automatically"
        on={r.faces}
        onChange={(v) => put({ faces: v })}
      />
      {extra}
      <Seg<Redact["mode"]>
        label="Effect"
        options={[
          ["pixelate", "Pixelate"],
          ["blur", "Blur"],
          ["fill", "Solid"],
        ]}
        value={r.mode}
        onPick={(v) => put({ mode: v })}
      />
      {r.mode === "fill" ? (
        <Colors
          label="Colour"
          value={r.color}
          onPick={(v) => put({ color: v })}
          list={["#000000", "#ffffff", "#e5484d", "#f5a524"]}
        />
      ) : (
        <Slider
          label="Strength"
          value={r.strength}
          min={1}
          onChange={(v) => put({ strength: v })}
        />
      )}
      <Seg<Redact["shape"]>
        label="Shape"
        options={[
          ["rect", "Box"],
          ["ellipse", "Oval"],
        ]}
        value={r.shape}
        onPick={(v) => put({ shape: v })}
      />
      <div className="ctl">
        <span className="lbl">
          Areas <span>{r.regions.length}</span>
        </span>
        {r.regions.length ? (
          <button
            type="button"
            className="btn sm"
            onClick={() => put({ regions: [] })}
          >
            Clear all areas
          </button>
        ) : (
          <small className="muted">
            {r.faces
              ? "Faces are covered in every image. Drag on the image to cover anything else."
              : "Drag on the image to cover a face, name or number."}
          </small>
        )}
      </div>
    </>
  );
}

/* ---------- Signature ---------- */

export function InkCtl({ s, setS }: P) {
  const k = s.ink!;
  const put = (patch: Partial<Ink>) =>
    setS((p) => ({ ...p, ink: { ...p.ink!, ...patch } }));
  return (
    <>
      <Slider
        label="Keep faint strokes"
        value={k.threshold}
        reset={50}
        onChange={(v) => put({ threshold: v })}
      />
      <Seg<string>
        label="Ink colour"
        options={[
          ["keep", "Original"],
          ["#111111", "Black"],
          ["#1a3d9c", "Blue"],
        ]}
        value={k.color}
        onPick={(v) => put({ color: v })}
      />
      <Toggle
        label="Trim empty space"
        on={k.trim}
        onChange={(v) => put({ trim: v })}
      />
    </>
  );
}

/* ---------- Print sheet ---------- */

export function SheetCtl({ s, setS }: P) {
  return (
    <Seg<string>
      label="Print sheet"
      options={[
        ["", "Single photo"],
        ...SHEETS.map((x) => [x.id, x.label] as [string, string]),
      ]}
      value={s.sheet ?? ""}
      onPick={(v) => setS((p) => ({ ...p, sheet: v || null }))}
    />
  );
}

/* ---------- Background ---------- */

export function BgCtl({ s, setS, lockMode }: P & { lockMode?: boolean }) {
  const b = s.bg!;
  const put = (patch: Partial<Bg>) =>
    setS((p) => ({ ...p, bg: { ...p.bg!, ...patch } }));
  return (
    <>
      {!lockMode && (
        <Seg<Bg["mode"]>
          label="Background"
          options={[
            ["remove", "Transparent"],
            ["color", "Colour"],
            ["blur", "Blurred"],
          ]}
          value={b.mode}
          onPick={(v) =>
            setS((p) => ({
              ...p,
              bg: { ...p.bg!, mode: v },
              // Transparency needs PNG or WebP
              ...(v === "remove" && p.type === "image/jpeg" && !p.keepFormat
                ? { type: "image/png" as const }
                : {}),
            }))
          }
        />
      )}
      {b.mode === "color" && (
        <Colors
          label="Colour"
          value={b.color}
          onPick={(v) => put({ color: v })}
          list={[
            "#ffffff",
            "#f2f2f2",
            "#dbe9ff",
            "#4a90e2",
            "#000000",
            "#30a46c",
            "#e5484d",
            "#f5a524",
          ]}
        />
      )}
      <Seg<Bg["model"]>
        label="Subject"
        options={[
          ["auto", "Auto"],
          ["person", "Person"],
          ["object", "Object"],
        ]}
        value={b.model}
        onPick={(v) => put({ model: v })}
      />
      <small className="muted">
        Runs on your device. The first time, the AI engine and model download
        from this site (about 10 MB) and are then cached.
      </small>
    </>
  );
}

/* ---------- ID / passport photo ---------- */

const ID_BACKS: [string, string][] = [
  ["#ffffff", "White"],
  ["#f0f0f0", "Light grey"],
  ["#dbe9ff", "Light blue"],
  ["keep", "Keep"],
];

export function PassportCtl({ s, setS }: P) {
  const pp = s.passport!;
  const spec = PHOTO_SPECS.find((x) => x.id === pp.spec)!;
  return (
    <>
      <div className="ctl">
        <span className="lbl">Photo size</span>
        <div className="presets one">
          {PHOTO_SPECS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={pp.spec === x.id}
              onClick={() =>
                setS((p) => ({
                  ...p,
                  passport: { ...p.passport!, spec: x.id },
                  target: x.target && p.target ? x.target : null,
                }))
              }
            >
              <strong>{x.label}</strong>
              <small>{x.hint}</small>
            </button>
          ))}
        </div>
      </div>
      <Seg<string>
        label="Background"
        options={ID_BACKS}
        value={s.bg ? s.bg.color : "keep"}
        onPick={(v) =>
          setS((p) => ({
            ...p,
            bg:
              v === "keep"
                ? null
                : { mode: "color", color: v, model: "person" },
          }))
        }
      />
      <Slider
        label="Head size"
        value={pp.zoom}
        min={-20}
        max={20}
        unit="%"
        reset={0}
        onChange={(v) =>
          setS((p) => ({ ...p, passport: { ...p.passport!, zoom: v } }))
        }
      />
      <SheetCtl s={s} setS={setS} />
      {spec.target && !s.sheet && (
        <label className="toggle">
          <input
            type="checkbox"
            checked={s.target === spec.target}
            onChange={(e) =>
              setS((p) => ({
                ...p,
                target: e.target.checked ? spec.target! : null,
                type: "image/jpeg",
                keepFormat: false,
              }))
            }
          />
          <span>Under {spec.target} KB for online forms</span>
        </label>
      )}
    </>
  );
}
