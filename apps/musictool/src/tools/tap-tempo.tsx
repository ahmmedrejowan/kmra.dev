import { useEffect, useRef, useState } from "react";
import { useLp, useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import { Card, Keys, busyTarget, useNum } from "../lib/ui";
import { tapResets, tapTempo } from "../lib/metronome";
import { tempoName } from "../lib/theory";
import { audio } from "../lib/audio";
import { clickBuffer, playBuffer } from "../lib/sound";

export default function TapTempo(_: ToolProps) {
  const T = useT();
  const L = useLp();
  const num = useNum();
  const [taps, setTaps] = useState<number[]>([]);
  const [click, setClick] = useState(false);
  const [flash, setFlash] = useState(0);
  const clickRef = useRef(click);
  clickRef.current = click;
  const r = tapTempo(taps);

  function tap(at = performance.now()) {
    setFlash((n) => n + 1);
    if (clickRef.current) {
      audio();
      playBuffer(clickBuffer("wood", 2), 0, 0.6);
    }
    setTaps((list) => {
      const last = list[list.length - 1];
      const bpm = tapTempo(list)?.bpm ?? null;
      const next =
        last !== undefined && tapResets(at - last, bpm) ? [at] : [...list, at];
      return next.slice(-17);
    });
  }

  const tapRef = useRef(tap);
  tapRef.current = tap;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || busyTarget(e)) return;
      const t = e.target as HTMLElement;
      // Other focused buttons and links keep their own Space and Enter
      if (t.closest("a, button:not(.mt-tap-pad)")) return;
      if (e.key === "Escape") return setTaps([]);
      if (e.key === " " || e.key === "Enter" || e.key.toLowerCase() === "t") {
        e.preventDefault();
        tapRef.current(e.timeStamp || performance.now());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const steady =
    r && r.intervals >= 3
      ? r.spread < 0.03
        ? "steady"
        : r.spread < 0.08
          ? "settling"
          : "uneven"
      : null;
  const whole = r ? Math.round(r.bpm) : null;

  const stage = (
    <div className="mt-tap">
      <button
        type="button"
        className={`mt-tap-pad${flash % 2 ? " a" : flash ? " b" : ""}`}
        onPointerDown={(e) => {
          e.preventDefault();
          tap(e.timeStamp || performance.now());
        }}
        onKeyDown={(e) => {
          // The window handler counts keyboard taps; stop the button's own click
          if (e.key === " " || e.key === "Enter") e.preventDefault();
        }}
        aria-label={T("Tap")}
      >
        <span
          className={`mt-tap-bpm${r ? "" : " empty"}`}
          data-value={r ? r.bpm.toFixed(2) : ""}
        >
          {r ? num(r.bpm, 1) : "–"}
        </span>
        <span className="mt-tap-unit">BPM</span>
        <span className="mt-tap-hint">
          {taps.length === 0
            ? T("Tap here, or press Space, in time with the beat")
            : taps.length === 1
              ? T("Keep tapping")
              : T("{n} taps", { n: num(taps.length) })}
        </span>
      </button>
      <Keys
        items={[
          [["Space", "T"], T("tap")],
          [["Esc"], T("start over")],
        ]}
      />
    </div>
  );

  const side = (
    <>
      <dl className="mt-stats">
        <div data-id="whole">
          <dt>{T("Nearest whole BPM")}</dt>
          <dd data-value={whole ?? ""}>{whole ? num(whole) : "–"}</dd>
        </div>
        <div data-id="tempo">
          <dt>{T("Tempo marking")}</dt>
          <dd>{whole ? T(tempoName(whole)) : "–"}</dd>
        </div>
        <div data-id="steady">
          <dt>{T("Steadiness")}</dt>
          <dd className={steady ?? ""}>
            {steady === "steady"
              ? T("Steady")
              : steady === "settling"
                ? T("Settling")
                : steady === "uneven"
                  ? T("Uneven")
                  : "–"}
            {r && r.intervals >= 3 && (
              <small> ±{num(r.spread * 100, 1)}%</small>
            )}
          </dd>
        </div>
        <div data-id="ms">
          <dt>{T("Beat length")}</dt>
          <dd>{r ? `${num(Math.round(60000 / r.bpm))} ms` : "–"}</dd>
        </div>
      </dl>
      <p className="mt-hint">
        {T(
          "The BPM is the median of your last eight taps, so one early or late tap barely moves it. Pause for two seconds to start over.",
        )}
      </p>
      <label className="toggle">
        <input
          type="checkbox"
          checked={click}
          onChange={(e) => setClick(e.target.checked)}
        />
        <span>{T("Click on each tap")}</span>
      </label>
      <div className="mt-side-actions">
        <a
          className={`btn acc${whole ? "" : " disabled"}`}
          href={whole ? `${L("/metronome")}?bpm=${whole}` : L("/metronome")}
          aria-disabled={!whole}
        >
          <Icon name="metronome" />
          {T("Use in metronome")}
        </a>
        <button
          type="button"
          className="btn"
          onClick={() => setTaps([])}
          disabled={!taps.length}
        >
          <Icon name="rotate" />
          {T("Start over")}
        </button>
      </div>
    </>
  );

  return <Card className="mt-tap-card" stage={stage} side={side} />;
}
