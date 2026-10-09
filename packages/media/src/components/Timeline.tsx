import { useEffect, useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { thumbnails } from "../engine";
import { fmtTime, parseTime } from "../plan";

/**
 * A strip of frames with a selected range: drag the start and end handles (or the range itself),
 * use the arrow keys on a handle (0.1 s, Shift for 1 s), or type the times (m:ss.s). Clicking the
 * strip moves the playhead. Used by trim, video to GIF and extract frames.
 *
 *   <Timeline file={file} duration={info.durationSec} start={a} end={b}
 *     onChange={(a, b) => …} time={playhead} onSeek={(t) => …} />
 *
 * `single` shows one handle only (pick a moment): `onChange(t, t)`.
 */
export function Timeline({
  file,
  duration,
  start,
  end,
  onChange,
  time,
  onSeek,
  minLength = 0.1,
  maxLength,
  single,
}: {
  file: File;
  duration: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  time?: number;
  onSeek?: (t: number) => void;
  minLength?: number;
  /** Longest allowed range (e.g. GIFs), seconds */
  maxLength?: number;
  single?: boolean;
}) {
  const T = useT();
  const strip = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const drag = useRef<{
    what: "a" | "b" | "range";
    x0: number;
    a0: number;
    b0: number;
  } | null>(null);
  const D = Math.max(0.001, duration);

  // Thumbnails: as many as fit the strip's width, redrawn when the file or width changes
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setWidth(Math.round(el.clientWidth / 40) * 40),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !width || !duration) return;
    const H = 56;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = width * dpr;
    c.height = H * dpr;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const count = Math.max(4, Math.min(24, Math.round(width / 72)));
    const slot = c.width / count;
    const ac = new AbortController();
    void thumbnails(file, {
      count,
      height: Math.round(H * dpr),
      duration,
      signal: ac.signal,
      onThumb: (i, bmp) => {
        if (ac.signal.aborted) return bmp.close();
        // cover-fit each frame into its slot
        const k = Math.max(slot / bmp.width, c.height / bmp.height);
        const w = bmp.width * k;
        const h = bmp.height * k;
        ctx.save();
        ctx.beginPath();
        ctx.rect(i * slot, 0, slot, c.height);
        ctx.clip();
        ctx.drawImage(bmp, i * slot + (slot - w) / 2, (c.height - h) / 2, w, h);
        ctx.restore();
        bmp.close();
      },
    });
    return () => ac.abort();
  }, [file, width, duration]);

  const clamp = (a: number, b: number): [number, number] => {
    if (single) {
      const t = Math.max(0, Math.min(D, a));
      return [t, t];
    }
    a = Math.max(0, Math.min(a, D - minLength));
    b = Math.max(a + minLength, Math.min(b, D));
    if (maxLength && b - a > maxLength) b = a + maxLength;
    return [a, b];
  };
  const at = (clientX: number) => {
    const r = strip.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * D;
  };
  const down = (what: "a" | "b" | "range") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { what, x0: e.clientX, a0: start, b0: end };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const r = strip.current!.getBoundingClientRect();
    const dt = ((e.clientX - d.x0) / r.width) * D;
    if (d.what === "a") {
      const [a, b] = clamp(d.a0 + dt, single ? d.a0 + dt : d.b0);
      onChange(a, b);
      onSeek?.(a);
    } else if (d.what === "b") {
      // keep the start; maxLength trims from the end
      let b = Math.max(d.a0 + minLength, Math.min(D, d.b0 + dt));
      if (maxLength) b = Math.min(b, d.a0 + maxLength);
      onChange(d.a0, b);
      onSeek?.(b);
    } else {
      const len = d.b0 - d.a0;
      const a = Math.max(0, Math.min(D - len, d.a0 + dt));
      onChange(a, a + len);
      onSeek?.(a);
    }
  };
  const up = () => (drag.current = null);
  const key = (what: "a" | "b") => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 1 : 0.1;
    const dir =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? -1
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? 1
          : 0;
    if (!dir) return;
    e.preventDefault();
    if (what === "a") {
      const [a, b] = clamp(
        start + dir * step,
        single ? start + dir * step : end,
      );
      onChange(a, b);
      onSeek?.(a);
    } else {
      const [a, b] = clamp(start, end + dir * step);
      onChange(a, b);
      onSeek?.(b);
    }
  };

  const pa = (start / D) * 100;
  const pb = (end / D) * 100;
  return (
    <div className={`mp-timeline${single ? " single" : ""}`}>
      <div
        className="mp-strip"
        ref={strip}
        onPointerDown={(e) => {
          if (drag.current) return;
          onSeek?.(at(e.clientX));
        }}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <canvas ref={canvas} aria-hidden="true" />
        {!single && (
          <>
            <div className="mp-dim" style={{ left: 0, width: `${pa}%` }} />
            <div className="mp-dim" style={{ left: `${pb}%`, right: 0 }} />
            <div
              className="mp-range"
              style={{ left: `${pa}%`, width: `${pb - pa}%` }}
              onPointerDown={down("range")}
              onPointerMove={move}
              onPointerUp={up}
            />
          </>
        )}
        {time !== undefined && (
          <div
            className="mp-head"
            style={{ left: `${(Math.min(D, time) / D) * 100}%` }}
            aria-hidden="true"
          />
        )}
        <div
          className="mp-handle a"
          role="slider"
          tabIndex={0}
          aria-label={single ? T("Time") : T("Start")}
          aria-valuemin={0}
          aria-valuemax={Math.round(D * 10) / 10}
          aria-valuenow={Math.round(start * 10) / 10}
          aria-valuetext={fmtTime(start)}
          style={{ left: `${pa}%` }}
          onPointerDown={down("a")}
          onPointerMove={move}
          onPointerUp={up}
          onKeyDown={key("a")}
        />
        {!single && (
          <div
            className="mp-handle b"
            role="slider"
            tabIndex={0}
            aria-label={T("End")}
            aria-valuemin={0}
            aria-valuemax={Math.round(D * 10) / 10}
            aria-valuenow={Math.round(end * 10) / 10}
            aria-valuetext={fmtTime(end)}
            style={{ left: `${pb}%` }}
            onPointerDown={down("b")}
            onPointerMove={move}
            onPointerUp={up}
            onKeyDown={key("b")}
          />
        )}
      </div>
      <div className="mp-times">
        <TimeInput
          label={single ? T("Time") : T("Start")}
          value={start}
          onCommit={(v) => {
            const [a, b] = clamp(v, single ? v : end);
            onChange(a, b);
            onSeek?.(a);
          }}
        />
        {!single && (
          <>
            <span className="mp-len">
              {T("Length")} <b>{fmtTime(end - start)}</b>
            </span>
            <TimeInput
              label={T("End")}
              value={end}
              onCommit={(v) => {
                const [a, b] = clamp(start, v);
                onChange(a, b);
                onSeek?.(b);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** A time field (m:ss.s) that applies on Enter or when it loses focus */
export function TimeInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(fmtTime(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(fmtTime(value));
  }, [value, editing]);
  const commit = () => {
    setEditing(false);
    const v = parseTime(text);
    if (Number.isFinite(v)) onCommit(v);
    else setText(fmtTime(value));
  };
  return (
    <label className="mp-tin">
      <span>{label}</span>
      <input
        className="num"
        inputMode="decimal"
        value={text}
        aria-label={label}
        onFocus={() => setEditing(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setText(fmtTime(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </label>
  );
}
