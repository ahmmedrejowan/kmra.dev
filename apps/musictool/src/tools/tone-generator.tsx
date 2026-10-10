import { useEffect, useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { Toggle } from "@kmra/ui/components/controls";
import type { ToolProps } from ".";
import { Card, Choice, Keys, NotePicker, NumInput, Range, busyTarget, pre, useNum } from "../lib/ui";
import { audio, curve, out, reducedMotion, testHook } from "../lib/audio";
import { freqOf, midiOf, readNote } from "../lib/theory";

type Wave = OscillatorType;
const MIN = 1;
const MAX = 20000;
const toSlider = (f: number) => Math.round((Math.log(f / MIN) / Math.log(MAX / MIN)) * 1000);
const fromSlider = (v: number) => MIN * (MAX / MIN) ** (v / 1000);
const FADE = 0.06;

interface Live {
  osc: OscillatorNode;
  env: GainNode;
  pan: StereoPannerNode;
  an: AnalyserNode;
  /** Sweep start time and settings, when sweeping */
  sweep?: { t0: number; from: number; to: number; dur: number; log: boolean };
}

/** The strongest frequency in the analyser's spectrum (parabolic interpolation between bins) */
function peakOf(an: AnalyserNode, bins: Float32Array<ArrayBuffer>): number | null {
  an.getFloatFrequencyData(bins);
  let best = 1;
  for (let i = 2; i < bins.length - 1; i++) if (bins[i]! > bins[best]!) best = i;
  if (!(bins[best]! > -110)) return null;
  const a = bins[best - 1]!;
  const b = bins[best]!;
  const c = bins[best + 1]!;
  const den = a - 2 * b + c;
  const shift = den ? (0.5 * (a - c)) / den : 0;
  return ((best + shift) * an.context.sampleRate) / an.fftSize;
}

export default function ToneGenerator({ preset }: ToolProps) {
  const T = useT();
  const num = useNum();
  const [freq, setFreq] = useState(() => Math.min(MAX, Math.max(MIN, pre(preset?.freq, 440))));
  const [wave, setWave] = useState<Wave>("sine");
  const [vol, setVol] = useState(25);
  const [bal, setBal] = useState(0);
  const [sweepOn, setSweepOn] = useState(false);
  const [sweep, setSweep] = useState({ from: 20, to: 20000, dur: 10, log: true });
  const [playing, setPlaying] = useState(false);
  const [shownFreq, setShownFreq] = useState<number | null>(null);
  const [peak, setPeak] = useState<number | null>(null);
  const live = useRef<Live | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const gainFor = (v: number) => curve(v / 100) * 0.6;

  function start() {
    if (live.current) return;
    const c = audio();
    const osc = c.createOscillator();
    osc.type = wave;
    const env = c.createGain();
    env.gain.value = 0;
    const pan = c.createStereoPanner();
    pan.pan.value = bal / 100;
    const an = c.createAnalyser();
    an.fftSize = 16384;
    an.smoothingTimeConstant = 0.2;
    osc.connect(env).connect(pan).connect(an).connect(out());
    const t = c.currentTime + 0.01;
    let s: Live["sweep"];
    if (sweepOn) {
      const from = Math.max(MIN, sweep.from);
      const to = Math.max(MIN, sweep.to);
      osc.frequency.setValueAtTime(from, t);
      if (sweep.log) osc.frequency.exponentialRampToValueAtTime(to, t + sweep.dur);
      else osc.frequency.linearRampToValueAtTime(to, t + sweep.dur);
      s = { t0: t, from, to, dur: sweep.dur, log: sweep.log };
    } else osc.frequency.setValueAtTime(freq, t);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gainFor(vol), t + FADE);
    osc.start(t);
    live.current = { osc, env, pan, an, sweep: s };
    testHook("tone", { osc, an });
    setPlaying(true);
    if (s) {
      env.gain.setValueAtTime(gainFor(vol), t + s.dur - FADE);
      env.gain.linearRampToValueAtTime(0, t + s.dur);
      osc.stop(t + s.dur + 0.05);
      osc.onended = () => {
        if (live.current?.osc === osc) finish();
      };
    }
  }

  function finish() {
    const l = live.current;
    live.current = null;
    setPlaying(false);
    setShownFreq(null);
    setPeak(null);
    if (!l) return;
    setTimeout(() => {
      l.osc.disconnect();
      l.an.disconnect();
    }, 200);
  }

  function stop() {
    const l = live.current;
    if (!l) return;
    const c = audio();
    const t = c.currentTime;
    l.env.gain.cancelScheduledValues(t);
    l.env.gain.setValueAtTime(l.env.gain.value, t);
    l.env.gain.linearRampToValueAtTime(0, t + FADE);
    l.osc.onended = null;
    try {
      l.osc.stop(t + FADE + 0.02);
    } catch {
      // already stopped
    }
    finish();
  }

  // Live changes while playing
  useEffect(() => {
    const l = live.current;
    if (!l || l.sweep) return;
    const c = audio();
    l.osc.frequency.cancelScheduledValues(c.currentTime);
    l.osc.frequency.setTargetAtTime(freq, c.currentTime, 0.015);
  }, [freq]);
  useEffect(() => {
    if (live.current) live.current.osc.type = wave;
  }, [wave]);
  useEffect(() => {
    const l = live.current;
    if (!l) return;
    const c = audio();
    if (l.sweep && c.currentTime > l.sweep.t0 + l.sweep.dur - FADE) return;
    l.env.gain.cancelScheduledValues(c.currentTime);
    l.env.gain.setTargetAtTime(gainFor(vol), c.currentTime, 0.02);
    if (l.sweep) {
      const end = l.sweep.t0 + l.sweep.dur;
      l.env.gain.setValueAtTime(gainFor(vol), end - FADE);
      l.env.gain.linearRampToValueAtTime(0, end);
    }
  }, [vol]);
  useEffect(() => {
    const l = live.current;
    if (l) l.pan.pan.setTargetAtTime(bal / 100, audio().currentTime, 0.02);
  }, [bal]);
  useEffect(() => () => stop(), []);

  // Scope, sweep position and the measured peak
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let lastPeak = 0;
    const l = live.current!;
    const wave = new Float32Array(2048);
    const bins = new Float32Array(l.an.frequencyBinCount);
    const still = reducedMotion();
    const draw = (now: number) => {
      const c = audio();
      if (l.sweep) {
        const p = Math.min(1, Math.max(0, (c.currentTime - l.sweep.t0) / l.sweep.dur));
        const { from, to, log } = l.sweep;
        setShownFreq(log ? from * (to / from) ** p : from + (to - from) * p);
      }
      if (now - lastPeak > 150) {
        lastPeak = now;
        setPeak(peakOf(l.an, bins));
      }
      const cv = canvas.current;
      if (cv && (!still || now - lastPeak < 20)) {
        const g = cv.getContext("2d")!;
        const w = (cv.width = cv.clientWidth * devicePixelRatio);
        const h = (cv.height = cv.clientHeight * devicePixelRatio);
        l.an.getFloatTimeDomainData(wave);
        // Start at a rising zero crossing so the wave stands still
        let s = 0;
        for (let i = 1; i < 1024; i++)
          if (wave[i - 1]! < 0 && wave[i]! >= 0) {
            s = i;
            break;
          }
        const span = 1024;
        let m = 0;
        for (let i = s; i < s + span; i++) m = Math.max(m, Math.abs(wave[i]!));
        const k = m > 0 ? 0.8 / m : 0;
        g.clearRect(0, 0, w, h);
        g.lineWidth = 2.5 * devicePixelRatio;
        g.strokeStyle = getComputedStyle(cv).color;
        g.beginPath();
        for (let i = 0; i < span; i++) {
          const x = (i / (span - 1)) * w;
          const y = h / 2 - wave[s + i]! * k * (h / 2);
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Space plays and stops
  const toggleRef = useRef(() => {});
  toggleRef.current = () => (live.current ? stop() : start());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " || e.repeat || busyTarget(e, true)) return;
      e.preventDefault();
      toggleRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const f = shownFreq ?? freq;
  const note = readNote(f);
  const nearest = Math.round(midiOf(freq));
  const fmtHz = (v: number) => (v >= 1000 ? num(v, v >= 10000 ? 0 : 1) : num(v, v < 100 ? 2 : 1));

  const stage = (
    <div className={`mt-tone${playing ? " on" : ""}`}>
      <canvas ref={canvas} className="mt-scope" aria-hidden="true" />
      <div className="mt-tone-read" data-freq={f.toFixed(3)} data-peak={peak ? peak.toFixed(2) : ""}>
        <output className="mt-tone-hz">
          {fmtHz(f)}
          <span>Hz</span>
        </output>
        <span className="mt-tone-note">
          {note.name}
          {num(note.octave)} {note.cents >= 0 ? "+" : "−"}
          {num(Math.abs(note.cents), 1)} {T("cents")}
        </span>
      </div>
      {!sweepOn && (
        <input
          type="range"
          className="mt-range mt-freq-slider"
          min={0}
          max={1000}
          value={toSlider(freq)}
          aria-label={T("Frequency")}
          onChange={(e) => setFreq(Number(fromSlider(Number(e.target.value)).toPrecision(4)))}
        />
      )}
      <div className="mt-actions">
        <button type="button" className={`btn lg${playing ? "" : " acc"}`} onClick={() => (playing ? stop() : start())}>
          <Icon name={playing ? "stop" : "play"} />
          {playing ? T("Stop") : sweepOn ? T("Play the sweep") : T("Play")}
        </button>
      </div>
      <p className="mt-warn">
        <Icon name="volume" />
        {T("Start quietly. Turn the volume up slowly: high or loud tones can hurt your ears and speakers.")}
      </p>
      <Keys items={[[["Space"], T("play or stop")]]} />
    </div>
  );

  const side = (
    <>
      <NumInput
        label={T("Frequency")}
        name="freq"
        value={freq}
        min={MIN}
        max={MAX}
        decimals={2}
        unit="Hz"
        onChange={setFreq}
      />
      <NotePicker label={T("Or pick a note (A4 = 440 Hz)")} midi={nearest} onChange={(m) => setFreq(Number(freqOf(m).toFixed(2)))} />
      <div className="chips mt-pills" role="group" aria-label={T("Common tones")}>
        {[50, 100, 432, 440, 1000, 10000].map((v) => (
          <button key={v} type="button" aria-pressed={freq === v} onClick={() => setFreq(v)}>
            {num(v)} Hz
          </button>
        ))}
      </div>
      <Choice
        label={T("Wave")}
        value={wave}
        options={[
          ["sine", T("Sine")],
          ["square", T("Square")],
          ["triangle", T("Triangle")],
          ["sawtooth", T("Sawtooth")],
        ]}
        onPick={setWave}
      />
      <Range label={T("Volume")} value={vol} min={0} max={100} display={`${num(vol)}%`} onChange={setVol} />
      <Range
        label={T("Balance")}
        value={bal}
        min={-100}
        max={100}
        display={bal === 0 ? T("Centre") : bal < 0 ? `${T("Left")} ${num(-bal)}%` : `${T("Right")} ${num(bal)}%`}
        onChange={setBal}
      />
      <div className="mt-group">
        <Toggle label={T("Sweep from one frequency to another")} on={sweepOn} onChange={(v) => { stop(); setSweepOn(v); }} />
        {sweepOn && (
          <>
            <div className="mt-row">
              <NumInput label={T("From")} name="from" unit="Hz" value={sweep.from} min={MIN} max={MAX} decimals={1} onChange={(from) => setSweep({ ...sweep, from })} />
              <NumInput label={T("To")} name="to" unit="Hz" value={sweep.to} min={MIN} max={MAX} decimals={1} onChange={(to) => setSweep({ ...sweep, to })} />
            </div>
            <div className="mt-row">
              <NumInput label={T("Length")} name="dur" unit={T("s")} value={sweep.dur} min={1} max={120} onChange={(dur) => setSweep({ ...sweep, dur })} />
              <Choice
                label={T("Curve")}
                value={sweep.log}
                options={[
                  [true, T("Log")],
                  [false, T("Linear")],
                ]}
                onPick={(log) => setSweep({ ...sweep, log })}
              />
            </div>
          </>
        )}
      </div>
    </>
  );

  return <Card className="mt-tone-card" stage={stage} side={side} />;
}
