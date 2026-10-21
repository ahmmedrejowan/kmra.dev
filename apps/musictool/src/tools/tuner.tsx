import { useEffect, useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import { Card, NumInput, Select, load, pre, save, useNum } from "../lib/ui";
import {
  listen,
  micProblem,
  type Listener,
  type MicProblem,
  type Reading,
} from "../lib/listen";
import { Smoother } from "../lib/pitch";
import {
  INSTRUMENTS,
  freqOf,
  instrument as findInstrument,
  midiName,
  nearestString,
  readNote,
} from "../lib/theory";
import { key, pluck } from "../lib/sound";
import { testHook } from "../lib/audio";

type State = "idle" | "asking" | "on" | MicProblem;

interface Shown {
  freq: number;
  name: string;
  octave: number;
  /** Cents the needle shows: from the nearest note, or from the target string */
  cents: number;
  /** Cents from the nearest note */
  noteCents: number;
  string: number | null;
  stringCents: number;
}

const IN_TUNE = 3;
const PREFS = "kmra-music-tuner";
const BOWED = new Set(["violin", "viola", "cello"]);

export default function Tuner({ preset }: ToolProps) {
  const T = useT();
  const num = useNum();
  const saved = load(PREFS, {
    instrument: "chromatic",
    tuning: "standard",
    a4: 440,
  });
  const [inst, setInst] = useState(pre(preset?.instrument, saved.instrument));
  const instrument = findInstrument(inst);
  const [tuningId, setTuningId] = useState(
    pre(
      preset?.tuning,
      preset?.instrument
        ? (instrument.tunings[0]?.id ?? "standard")
        : saved.tuning,
    ),
  );
  const tuning =
    instrument.tunings.find((t) => t.id === tuningId) ??
    instrument.tunings[0] ??
    null;
  const [a4, setA4] = useState(
    saved.a4 >= 430 && saved.a4 <= 450 ? saved.a4 : 440,
  );
  const [state, setState] = useState<State>("idle");
  const [shown, setShown] = useState<Shown | null>(null);
  const [heard, setHeard] = useState(false);
  const [level, setLevel] = useState(0);
  const listener = useRef<Listener | null>(null);
  const smoother = useRef(new Smoother(5));
  const lastPitch = useRef(0);
  const settings = useRef({
    a4,
    strings: tuning?.strings ?? [],
    flats: !!tuning?.flats,
  });
  settings.current = {
    a4,
    strings: tuning?.strings ?? [],
    flats: !!tuning?.flats,
  };

  useEffect(() => {
    save(PREFS, { instrument: inst, tuning: tuning?.id ?? "standard", a4 });
  }, [inst, tuning, a4]);

  useEffect(() => () => listener.current?.stop(), []);

  function onReading(r: Reading) {
    setLevel(r.level);
    const now = performance.now();
    const p = r.pitch;
    if (!p || p.clarity < 0.85) {
      if (now - lastPitch.current > 450) {
        setHeard(false);
        smoother.current.reset();
      }
      return;
    }
    lastPitch.current = now;
    const { a4, strings, flats } = settings.current;
    const f = smoother.current.push(p.freq);
    const n = readNote(f, a4, flats);
    const s = strings.length ? nearestString(f, strings, a4) : null;
    setHeard(true);
    setShown({
      freq: f,
      name: n.name,
      octave: n.octave,
      noteCents: n.cents,
      cents: s ? s.cents : n.cents,
      string: s ? s.index : null,
      stringCents: s ? s.cents : 0,
    });
  }

  async function start() {
    if (listener.current) return;
    setState("asking");
    try {
      listener.current = await listen(onReading);
      setState("on");
    } catch (e) {
      setState(
        (e as { name?: string })?.name === "Insecure"
          ? "insecure"
          : micProblem(e),
      );
    }
  }

  function stop() {
    listener.current?.stop();
    listener.current = null;
    setState("idle");
    setHeard(false);
    setLevel(0);
    smoother.current.reset();
  }

  function playString(midi: number) {
    const f = freqOf(midi, a4);
    if (BOWED.has(inst)) key(f, 0, 0.9, 2.4);
    else pluck(f, 0, 0.9, 3);
  }

  const cents = shown ? shown.cents : 0;
  const clamped = Math.max(-50, Math.min(50, cents));
  const live = state === "on" && heard && shown !== null;
  const inTune = live && Math.abs(cents) <= IN_TUNE;
  const status = !live
    ? "waiting"
    : inTune
      ? "in-tune"
      : cents < 0
        ? "flat"
        : "sharp";
  testHook("tuner", { status, shown });

  const target =
    shown && shown.string !== null && tuning
      ? tuning.strings[shown.string]!
      : null;
  const targetName =
    target !== null ? midiName(target, settings.current.flats) : "";
  let advice = "";
  if (live) {
    if (inTune) advice = T("In tune");
    else if (target !== null && Math.abs(cents) > 50)
      advice =
        cents < 0
          ? T("Tune up to {note}", { note: targetName })
          : T("Tune down to {note}", { note: targetName });
    else advice = cents < 0 ? T("Flat: tune up") : T("Sharp: tune down");
  }

  const message: Record<Exclude<State, "on">, string> = {
    idle: T(
      "Press Start and allow the microphone. The tuner listens on your device; the sound isn't recorded or sent.",
    ),
    asking: T("Allow the microphone in your browser's prompt."),
    denied: T(
      "The microphone is blocked. Allow it for this site in your browser's address bar, then press Start again.",
    ),
    nomic: T("No microphone was found. Connect one, then press Start again."),
    busy: T(
      "Another app is using the microphone. Close it, then press Start again.",
    ),
    insecure: T("This browser can't use the microphone on this page."),
    other: T(
      "The microphone couldn't start. Check that one is connected, then press Start again.",
    ),
  };

  const stage = (
    <div
      className={`mt-tuner ${status}`}
      data-state={state === "on" ? status : state}
      data-note={live ? `${shown!.name}${shown!.octave}` : ""}
      data-cents={live ? shown!.cents.toFixed(2) : ""}
      data-freq={live ? shown!.freq.toFixed(3) : ""}
    >
      <Meter cents={live ? clamped : 0} active={live} inTune={inTune} />
      <div className="mt-tuner-note" aria-live="off">
        <span className={`mt-tuner-name${live ? "" : " empty"}`}>
          {live ? shown!.name : "–"}
        </span>
        <span className="mt-tuner-oct">{live ? num(shown!.octave) : ""}</span>
      </div>
      <div className="mt-tuner-read">
        <span className="mt-tuner-cents">
          {live
            ? `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${num(Math.abs(cents), 1)} ${T("cents")}`
            : " "}
        </span>
        <span className="mt-tuner-hz">
          {live ? `${num(shown!.freq, 1)} Hz` : " "}
        </span>
      </div>
      <p className={`mt-tuner-advice${inTune ? " ok" : ""}`} role="status">
        {state !== "on" ? message[state] : live ? advice : T("Play a note")}
      </p>
      {state === "on" && (
        <div className="mt-level" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.min(1, level * 2.5)})` }} />
        </div>
      )}
      {tuning && (
        <div
          className="mt-strings"
          role="group"
          aria-label={T("Strings: play a reference tone")}
        >
          {tuning.strings.map((m, i) => {
            const near = live && shown!.string === i;
            return (
              <button
                key={i}
                type="button"
                className={`mt-string${near ? " near" : ""}${near && inTune ? " ok" : ""}`}
                aria-label={T("Play {note}", {
                  note: midiName(m, tuning.flats),
                })}
                onClick={() => playString(m)}
              >
                <strong>{midiName(m, tuning.flats).replace(/\d+$/, "")}</strong>
                <small>
                  {num(midiName(m, tuning.flats).match(/\d+$/)?.[0] ?? "")}
                </small>
                <Icon name="play" />
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-actions">
        {state === "on" ? (
          <button type="button" className="btn lg" onClick={stop}>
            <Icon name="stop" />
            {T("Stop")}
          </button>
        ) : (
          <button
            type="button"
            className="btn acc lg"
            onClick={start}
            disabled={state === "asking"}
          >
            <Icon name="mic" />
            {T("Start")}
          </button>
        )}
      </div>
    </div>
  );

  const side = (
    <>
      <Select
        label={T("Instrument")}
        name="instrument"
        value={inst}
        options={INSTRUMENTS.map((i) => [i.id, T(i.name)])}
        onChange={(v) => {
          setInst(v);
          setTuningId(findInstrument(v).tunings[0]?.id ?? "standard");
          smoother.current.reset();
        }}
      />
      {instrument.tunings.length > 1 && (
        <Select
          label={T("Tuning")}
          name="tuning"
          value={tuning?.id ?? ""}
          options={instrument.tunings.map((t) => [t.id, T(t.name)])}
          onChange={(v) => setTuningId(v)}
        />
      )}
      {tuning && (
        <p className="mt-note">
          {tuning.strings.map((m) => midiName(m, tuning.flats)).join(" · ")}
        </p>
      )}
      <NumInput
        label={T("Reference pitch A4")}
        name="a4"
        value={a4}
        min={430}
        max={450}
        unit="Hz"
        onChange={setA4}
      />
      <div
        className="chips mt-pills"
        role="group"
        aria-label={T("Common reference pitches")}
      >
        {[440, 442, 432].map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={a4 === v}
            onClick={() => setA4(v)}
          >
            {num(v)} Hz
          </button>
        ))}
      </div>
      <p className="mt-hint">
        {T(
          "Within ±{n} cents counts as in tune. Pluck one string at a time and let it ring.",
          { n: num(IN_TUNE) },
        )}
      </p>
    </>
  );

  return <Card className="mt-tuner-card" stage={stage} side={side} />;
}

/** The needle meter: ±50 cents across a 120° arc, a green band for in tune. */
function Meter({
  cents,
  active,
  inTune,
}: {
  cents: number;
  active: boolean;
  inTune: boolean;
}) {
  const T = useT();
  const cx = 160;
  const cy = 168;
  const r = 140;
  const pt = (c: number, rr: number) => {
    const a = ((c * 1.2 - 90) * Math.PI) / 180;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  };
  const ticks = [];
  for (let c = -50; c <= 50; c += 5) {
    const major = c % 25 === 0;
    const [x1, y1] = pt(c, r - (major ? 18 : c % 10 === 0 ? 12 : 7));
    const [x2, y2] = pt(c, r);
    ticks.push(
      <line
        key={c}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        className={major ? "major" : ""}
      />,
    );
  }
  const [bx1, by1] = pt(-IN_TUNE * 1.6, r + 6);
  const [bx2, by2] = pt(IN_TUNE * 1.6, r + 6);
  return (
    <svg
      className={`mt-meter${active ? " on" : ""}${inTune ? " ok" : ""}`}
      viewBox="0 0 320 186"
      role="img"
      aria-label={T("Tuning meter")}
    >
      <path
        className="mt-meter-band"
        d={`M ${bx1} ${by1} A ${r + 6} ${r + 6} 0 0 1 ${bx2} ${by2}`}
      />
      <g className="mt-meter-ticks">{ticks}</g>
      <text
        x={pt(-50, r - 34)[0]}
        y={pt(-50, r - 34)[1]}
        className="mt-meter-lbl"
        textAnchor="middle"
      >
        ♭
      </text>
      <text
        x={pt(50, r - 34)[0]}
        y={pt(50, r - 34)[1]}
        className="mt-meter-lbl"
        textAnchor="middle"
      >
        ♯
      </text>
      <g
        className="mt-needle"
        style={{ transform: `rotate(${cents * 1.2}deg)` }}
      >
        <line x1={cx} y1={cy} x2={cx} y2={cy - r + 4} />
      </g>
      <circle cx={cx} cy={cy} r="7" className="mt-meter-hub" />
    </svg>
  );
}
