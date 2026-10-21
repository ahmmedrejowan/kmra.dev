/**
 * ColorTool's building blocks: the picker (saturation/brightness area, hue and alpha sliders),
 * a colour field (text + swatch that opens the picker), copy rows and the card layout.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as RKeyboardEvent,
  type ReactNode,
} from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { CopyBtn, canvasBlob, copyText } from "@kmra/ui/components/kit";
import { downloadBlob } from "@kmra/ui/lib/files";
import { useT } from "@kmra/ui/lib/i18n-react";
import {
  css,
  fit,
  hsvToRgb,
  parseColor,
  toHex,
  toHsv,
  withAlpha,
  type Rgba,
} from "./color";

/* ---------- layout ---------- */

/** Main area (the colour) and a side panel (settings); `side="left"` puts settings first */
export function Card({
  main,
  side,
  sideFirst = false,
  className = "",
}: {
  main: ReactNode;
  side: ReactNode;
  sideFirst?: boolean;
  className?: string;
}) {
  return (
    <div className={`ct-card${sideFirst ? " side-first" : ""} ${className}`}>
      <div className="ct-main">{main}</div>
      <div className="ct-side">{side}</div>
    </div>
  );
}

export function Group({
  label,
  children,
  aside,
}: {
  label: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="ct-group">
      <div className="ct-glabel">
        <span>{label}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

/* ---------- picker ---------- */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * HSV state that remembers hue and saturation through greys and black, so dragging to a corner
 * and back doesn't lose the hue.
 */
function useHsv(value: Rgba) {
  const memo = useRef({ h: 0, s: 0 });
  let [h, s, v] = toHsv(value);
  if (s < 1e-3 || v < 1e-3) h = memo.current.h;
  if (v < 1e-3) s = memo.current.s;
  memo.current = { h, s };
  return {
    h,
    s,
    v,
    remember: (hh: number, ss: number) => (memo.current = { h: hh, s: ss }),
  };
}

export function Picker({
  value,
  onChange,
  alpha = true,
  big = false,
}: {
  value: Rgba;
  onChange: (c: Rgba) => void;
  alpha?: boolean;
  big?: boolean;
}) {
  const T = useT();
  const { h, s, v, remember } = useHsv(value);
  const area = useRef<HTMLDivElement>(null);
  const a = value.a;

  const set = (hh: number, ss: number, vv: number, aa = a) => {
    remember(hh, ss);
    onChange(hsvToRgb(hh, clamp01(ss), clamp01(vv), clamp01(aa)));
  };

  function fromPointer(e: { clientX: number; clientY: number }) {
    const r = area.current!.getBoundingClientRect();
    set(
      h,
      clamp01((e.clientX - r.left) / r.width),
      1 - clamp01((e.clientY - r.top) / r.height),
    );
  }

  function key(e: RKeyboardEvent) {
    const d = e.shiftKey ? 0.1 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-d, 0],
      ArrowRight: [d, 0],
      ArrowUp: [0, d],
      ArrowDown: [0, -d],
    };
    const m = moves[e.key];
    if (e.key === "Home") set(h, 0, v);
    else if (e.key === "End") set(h, 1, v);
    else if (m) set(h, s + m[0], v + m[1]);
    else return;
    e.preventDefault();
  }

  const solid = hsvToRgb(h, 1, 1);
  const opaque = withAlpha(value, 1);
  return (
    <div className={`ct-picker${big ? " big" : ""}`}>
      <div
        ref={area}
        className="ct-sv"
        style={{ "--hue": css(solid) } as CSSProperties}
        role="slider"
        tabIndex={0}
        aria-label={T("Saturation and brightness")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(s * 100)}
        aria-valuetext={T("Saturation {s}%, brightness {v}%", {
          s: Math.round(s * 100),
          v: Math.round(v * 100),
        })}
        onKeyDown={key}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.focus();
          fromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
        }}
      >
        <span
          className="ct-thumb"
          style={{
            left: `${s * 100}%`,
            top: `${(1 - v) * 100}%`,
            background: css(opaque),
          }}
        />
      </div>
      <input
        type="range"
        className="ct-range ct-hue"
        min={0}
        max={360}
        step={1}
        value={Math.round(h)}
        aria-label={T("Hue")}
        onChange={(e) => set(+e.target.value % 360, s, v)}
      />
      {alpha && (
        <div
          className="ct-alpha-wrap"
          style={{ "--solid": css(opaque) } as CSSProperties}
        >
          <input
            type="range"
            className="ct-range ct-alpha"
            min={0}
            max={100}
            step={1}
            value={Math.round(a * 100)}
            aria-label={T("Opacity")}
            onChange={(e) => set(h, s, v, +e.target.value / 100)}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- colour field ---------- */

/** Text field that reads any colour format, with a swatch that opens the picker */
export function ColorField({
  label,
  value,
  onChange,
  alpha = true,
  hideLabel = false,
}: {
  label: string;
  value: Rgba;
  onChange: (c: Rgba) => void;
  alpha?: boolean;
  hideLabel?: boolean;
}) {
  const T = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => toHex(value));
  const [bad, setBad] = useState(false);
  const focused = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  // Show the current value unless the person is typing
  useEffect(() => {
    if (!focused.current) {
      setDraft(toHex(value));
      setBad(false);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="ct-field" ref={box}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "ct-flabel"}>
        {label}
      </label>
      <div className={`ct-finput${bad ? " bad" : ""}`}>
        <button
          type="button"
          className="ct-fsw"
          aria-label={T("Open the colour picker for {what}", { what: label })}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <i style={{ background: css(value) }} />
        </button>
        <input
          id={id}
          value={draft}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={bad}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false;
            setDraft(toHex(value));
            setBad(false);
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            try {
              const c = parseColor(e.target.value).color;
              setBad(false);
              onChange(alpha ? fit(c) : withAlpha(fit(c), 1));
            } catch {
              setBad(e.target.value.trim().length > 0);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </div>
      {open && (
        <div className="ct-pop" role="dialog" aria-label={label}>
          <Picker value={value} onChange={onChange} alpha={alpha} />
          <label className="ct-native">
            <span>{T("System colour picker")}</span>
            <input
              type="color"
              value={toHex(value, false)}
              onChange={(e) =>
                onChange(withAlpha(parseColor(e.target.value).color, value.a))
              }
            />
          </label>
        </div>
      )}
    </div>
  );
}

/* ---------- swatches and rows ---------- */

/** A row: label, value in mono, copy button. `on` highlights it. */
export function CopyRow({
  id,
  label,
  value,
  on = false,
}: {
  id: string;
  label: string;
  value: string;
  on?: boolean;
}) {
  return (
    <div className={`ct-row${on ? " on" : ""}`} data-id={id}>
      <span className="ct-rlabel">{label}</span>
      <code className="ct-val">{value}</code>
      <IconCopy text={value} label={label} />
    </div>
  );
}

/** Icon-only copy button with a proper label */
export function IconCopy({ text, label }: { text: string; label: string }) {
  const T = useT();
  return (
    <button
      type="button"
      className="btn xs ct-copy"
      aria-label={T("Copy {what}", { what: label })}
      title={T("Copy")}
      onClick={() =>
        void copyText(
          text,
          T("Copied {what}", { what: text }),
          T("Couldn't copy. Select the text and copy it yourself."),
        )
      }
    >
      <Icon name="copy" />
    </button>
  );
}

/** Code block with copy (and optional download) */
export function CodeOut({
  code,
  file,
  label,
}: {
  code: string;
  file?: string;
  label?: string;
}) {
  const T = useT();
  return (
    <div className="ct-code">
      <pre aria-label={label}>
        <code>{code}</code>
      </pre>
      <div className="ct-code-acts">
        <CopyBtn text={code} className="btn sm" label={T("Copy code")} />
        {file && (
          <button
            type="button"
            className="btn sm"
            onClick={() =>
              downloadBlob(
                new Blob([code], { type: "text/plain;charset=utf-8" }),
                file,
              )
            }
          >
            <Icon name="download" />
            {T("Download")}
          </button>
        )}
      </div>
    </div>
  );
}

/** Copy a value when clicked; shows the colour */
export function SwatchButton({
  color,
  label,
  className = "",
  children,
  style,
  onClick,
  ...rest
}: {
  color: Rgba;
  label: string;
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
  onClick: () => void;
  [k: `data-${string}`]: string | number | undefined;
}) {
  return (
    <button
      type="button"
      className={`ct-swbtn ${className}`}
      style={{ background: css(color), ...style }}
      aria-label={label}
      title={label}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- files ---------- */

export async function downloadCanvas(c: HTMLCanvasElement, name: string) {
  downloadBlob(await canvasBlob(c, "image/png"), name);
}

/* ---------- keyboard ---------- */

/** Space (outside fields and buttons) runs `fn` */
export function useSpace(fn: () => void) {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable ||
          t.closest(
            "input, textarea, select, button, a, [role=slider], [role=dialog]",
          ))
      )
        return;
      e.preventDefault();
      cb.current();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}

/** Colour kept in the URL hash (#1e90ff), so a link shares it */
export function useHashColor(initial: Rgba): [Rgba, (c: Rgba) => void] {
  const [c, setC] = useState(initial);
  useEffect(() => {
    const read = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (!h) return;
      try {
        setC(
          parseColor(
            h.startsWith("#") || /^[0-9a-f]+$/i.test(h)
              ? `#${h.replace(/^#/, "")}`
              : h,
          ).color,
        );
      } catch {
        /* not a colour: ignore */
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      const want = `#${toHex(c).slice(1)}`;
      if (location.hash !== want)
        history.replaceState(
          null,
          "",
          `${location.pathname}${location.search}${want}`,
        );
    }, 150);
    return () => clearTimeout(t);
  }, [c]);
  return [c, setC];
}
