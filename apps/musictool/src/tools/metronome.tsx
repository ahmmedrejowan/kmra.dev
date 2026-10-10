import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { Toggle } from "@kmra/ui/components/controls";
import type { ToolProps } from ".";
import { Card, Choice, Keys, NumInput, Pills, Range, busyTarget, load, pre, save, useNum } from "../lib/ui";
import {
  MAX_BPM,
  MIN_BPM,
  clampBpm,
  defaultAccents,
  tapResets,
  tapTempo,
  type Accent,
  type MetroSettings,
} from "../lib/metronome";
import type { ClickSound } from "../lib/sound";
import { useMetronome } from "../lib/useMetronome";
import { tempoName } from "../lib/theory";

const METERS: [string, number, number][] = [
  ["2/4", 2, 4],
  ["3/4", 3, 4],
  ["4/4", 4, 4],
  ["5/4", 5, 4],
  ["6/8", 6, 8],
  ["7/8", 7, 8],
  ["9/8", 9, 8],
  ["12/8", 12, 8],
];
const PREFS = "kmra-music-metronome";

export default function MetronomeTool({ preset }: ToolProps) {
  const T = useT();
  const num = useNum();
  const saved = load(PREFS, { sound: "click" as ClickSound, volume: 0.8, sub: 1 });
  const [bpm, setBpmRaw] = useState(() => {
    try {
      const q = Number(new URLSearchParams(location.search).get("bpm"));
      if (q >= MIN_BPM && q <= MAX_BPM) return clampBpm(q);
    } catch {
      // no URL (prerender)
    }
    return clampBpm(pre(preset?.bpm, 100));
  });
  const [beats, setBeats] = useState(pre(preset?.beats, 4));
  const [unit, setUnit] = useState(pre(preset?.unit, 4));
  const [accents, setAccents] = useState<Accent[]>(() => defaultAccents(beats, unit));
  const [sub, setSub] = useState(saved.sub);
  const [sound, setSound] = useState<ClickSound>(saved.sound);
  const [volume, setVolume] = useState(saved.volume);
  const [custom, setCustom] = useState(!METERS.some(([, b, u]) => b === beats && u === unit));
  const [trainer, setTrainer] = useState({ on: false, step: 5, every: 4, max: 160 });
  const taps = useRef<number[]>([]);

  const setBpm = (v: number) => setBpmRaw(clampBpm(v));

  useEffect(() => save(PREFS, { sound, volume, sub }), [sound, volume, sub]);

  const settings = useMemo<MetroSettings>(
    () => ({ bpm, beats, unit, accents, sub, sound, volume, trainer }),
    [bpm, beats, unit, accents, sub, sound, volume, trainer],
  );
  const m = useMetronome(settings, (v) => setBpmRaw(v));

  function meter(b: number, u: number) {
    setBeats(b);
    setUnit(u);
    setAccents(defaultAccents(b, u));
  }

  function tap() {
    const now = performance.now();
    const list = taps.current;
    const last = list[list.length - 1];
    if (last !== undefined && tapResets(now - last, bpm)) list.length = 0;
    list.push(now);
    if (list.length > 9) list.shift();
    const r = tapTempo(list);
    if (r) setBpm(r.bpm);
  }

  // Space start/stop, arrows ±1 (Shift ±10), T tap
  const keys = useRef({ toggle: m.toggle, tap, bpm });
  keys.current = { toggle: m.toggle, tap, bpm };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && e.key === " ") return;
      if (e.key === " " || e.code === "Space") {
        if (busyTarget(e, true)) return;
        e.preventDefault();
        keys.current.toggle();
      } else if (e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft") {
        if (busyTarget(e)) return;
        e.preventDefault();
        const d = (e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 10 : 1);
        setBpmRaw((b) => clampBpm(b + d));
      } else if (e.key.toLowerCase() === "t") {
        if (busyTarget(e)) return;
        keys.current.tap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cycle = (i: number) =>
    setAccents((a) => a.map((v, j) => (j === i ? (((v + 2) % 3) as Accent) : v)));
  const levelName = (v: Accent) => (v === 2 ? T("accent") : v === 1 ? T("normal") : T("muted"));

  const stage = (
    <div className={`mt-metro${m.running ? " on" : ""}`}>
      <p className="mt-tempo-name">{T(tempoName(bpm))}</p>
      <div className="mt-bpm-row">
        <button type="button" className="mt-round" aria-label={T("Slower")} onClick={() => setBpm(bpm - 1)}>
          <Icon name="minus" />
        </button>
        <div className="mt-bpm" data-value={bpm}>
          <output aria-live="polite">{num(bpm)}</output>
          <span>BPM</span>
        </div>
        <button type="button" className="mt-round" aria-label={T("Faster")} onClick={() => setBpm(bpm + 1)}>
          <Icon name="plus" />
        </button>
      </div>
      <input
        type="range"
        className="mt-range mt-bpm-slider"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpm}
        aria-label={T("Tempo")}
        onChange={(e) => setBpm(Number(e.target.value))}
      />
      <div
        className="mt-dots"
        role="group"
        aria-label={T("Beats: click a beat to change its accent")}
        data-count={beats}
      >
        {accents.map((v, i) => {
          const on = m.now?.beat === i;
          return (
            <button
              key={i}
              type="button"
              className={`mt-dot l${v}${on ? " on" : ""}${on && m.now?.sub === 0 ? " hit" : ""}`}
              data-level={v === 2 ? "accent" : v === 1 ? "normal" : "mute"}
              aria-label={T("Beat {n}: {level}", { n: num(i + 1), level: levelName(v) })}
              onClick={() => cycle(i)}
            >
              <span>{num(i + 1)}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-sig">
        {num(beats)}/{num(unit)}
        {sub > 1 && <> · {sub === 2 ? T("eighths") : sub === 3 ? T("triplets") : T("sixteenths")}</>}
        {trainer.on && <> · {T("speed trainer on")}</>}
      </p>
      <div className="mt-actions">
        <button type="button" className={`btn lg ${m.running ? "" : "acc"}`} onClick={m.toggle}>
          <Icon name={m.running ? "stop" : "play"} />
          {m.running ? T("Stop") : T("Start")}
        </button>
        <button type="button" className="btn lg" onClick={tap}>
          <Icon name="zap" />
          {T("Tap")}
        </button>
      </div>
      <Keys
        items={[
          [["Space"], T("start or stop")],
          [["↑", "↓"], T("tempo ±1 (Shift ±10)")],
          [["T"], T("tap")],
        ]}
      />
    </div>
  );

  const side = (
    <>
      <Pills
        label={T("Time signature")}
        value={custom ? "custom" : `${beats}/${unit}`}
        options={[...METERS.map(([l]) => [l, l] as [string, string]), ["custom", T("Custom")]]}
        onPick={(v) => {
          if (v === "custom") return setCustom(true);
          setCustom(false);
          const hit = METERS.find(([l]) => l === v)!;
          meter(hit[1], hit[2]);
        }}
      />
      {custom && (
        <div className="mt-row">
          <NumInput label={T("Beats per bar")} name="beats" value={beats} min={1} max={16} onChange={(b) => meter(b, unit)} />
          <Choice
            label={T("Beat unit")}
            value={unit}
            options={[2, 4, 8, 16].map((u) => [u, num(u)] as [number, string])}
            onPick={(u) => meter(beats, u)}
          />
        </div>
      )}
      <Choice
        label={T("Subdivision")}
        value={sub}
        options={[
          [1, T("None")],
          [2, T("8ths")],
          [3, T("Triplets")],
          [4, T("16ths")],
        ]}
        onPick={setSub}
      />
      <Choice
        label={T("Sound")}
        value={sound}
        options={[
          ["click", T("Click")],
          ["wood", T("Wood")],
          ["beep", T("Beep")],
        ]}
        onPick={setSound}
      />
      <Range
        label={T("Volume")}
        value={Math.round(volume * 100)}
        min={0}
        max={100}
        display={`${num(Math.round(volume * 100))}%`}
        onChange={(v) => setVolume(v / 100)}
      />
      <div className="mt-group">
        <Toggle
          label={T("Speed trainer")}
          on={trainer.on}
          onChange={(on) => setTrainer({ ...trainer, on, max: Math.max(trainer.max, bpm) })}
        />
        {trainer.on && (
          <>
            <div className="mt-row three">
              <NumInput
                label={T("Raise by")}
                name="step"
                unit="BPM"
                value={trainer.step}
                min={1}
                max={50}
                onChange={(step) => setTrainer({ ...trainer, step })}
              />
              <NumInput
                label={T("Every")}
                name="every"
                unit={T("bars")}
                value={trainer.every}
                min={1}
                max={64}
                onChange={(every) => setTrainer({ ...trainer, every })}
              />
              <NumInput
                label={T("Up to")}
                name="max"
                unit="BPM"
                value={trainer.max}
                min={MIN_BPM}
                max={MAX_BPM}
                onChange={(max) => setTrainer({ ...trainer, max })}
              />
            </div>
            <p className="mt-hint">
              {T("Adds {step} BPM every {every} bars until {max} BPM.", {
                step: trainer.step,
                every: trainer.every,
                max: trainer.max,
              })}
            </p>
          </>
        )}
      </div>
    </>
  );

  return <Card className="mt-metro-card" stage={stage} side={side} />;
}
