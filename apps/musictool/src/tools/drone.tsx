import { useEffect, useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { Toggle } from "@kmra/ui/components/controls";
import type { ToolProps } from ".";
import {
  Card,
  Choice,
  Keys,
  NumInput,
  Pills,
  Range,
  busyTarget,
  load,
  save,
  useNum,
} from "../lib/ui";
import { audio, curve, out, testHook } from "../lib/audio";
import { SHARPS, freqOf, mod } from "../lib/theory";

type Timbre = "warm" | "organ" | "pure";
const PREFS = "kmra-music-drone";
const DETUNE = [-6, 0, 6];

interface Voice {
  oscs: OscillatorNode[];
  semis: number;
}
interface Live {
  voices: Voice[];
  filter: BiquadFilterNode;
  env: GainNode;
  lfo: OscillatorNode;
}

function organWave(c: AudioContext) {
  const real = new Float32Array([0, 1, 0.55, 0.32, 0.22, 0.12, 0.08, 0.05]);
  return c.createPeriodicWave(real, new Float32Array(real.length));
}

export default function Drone(_: ToolProps) {
  const T = useT();
  const num = useNum();
  const saved = load(PREFS, {
    midi: 50,
    fifth: false,
    octave: false,
    timbre: "warm" as Timbre,
    vol: 40,
    a4: 440,
  });
  const [midi, setMidi] = useState(saved.midi);
  const [fifth, setFifth] = useState(saved.fifth);
  const [octave, setOctave] = useState(saved.octave);
  const [timbre, setTimbre] = useState<Timbre>(saved.timbre);
  const [vol, setVol] = useState(saved.vol);
  const [a4, setA4] = useState(saved.a4);
  const [playing, setPlaying] = useState(false);
  const live = useRef<Live | null>(null);

  useEffect(
    () => save(PREFS, { midi, fifth, octave, timbre, vol, a4 }),
    [midi, fifth, octave, timbre, vol, a4],
  );

  const level = (v: number) => curve(v / 100) * 0.5;
  const parts = () => [0, ...(fifth ? [7] : []), ...(octave ? [12] : [])];

  function voice(c: AudioContext, semis: number, dest: AudioNode): Voice {
    const f = freqOf(midi + semis, a4);
    const n = timbre === "pure" ? [0] : DETUNE;
    const oscs = n.map((d) => {
      const o = c.createOscillator();
      if (timbre === "organ") o.setPeriodicWave(organWave(c));
      else o.type = timbre === "warm" ? "sawtooth" : "sine";
      o.frequency.value = f;
      o.detune.value = d;
      const g = c.createGain();
      // Upper parts a little quieter than the root
      g.gain.value = (semis === 0 ? 1 : 0.6) / n.length;
      o.connect(g).connect(dest);
      o.start();
      return o;
    });
    return { oscs, semis };
  }

  function start() {
    if (live.current) return;
    const c = audio();
    const env = c.createGain();
    env.gain.value = 0;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.6;
    filter.frequency.value = Math.min(
      12000,
      freqOf(midi, a4) * (timbre === "warm" ? 5 : 12),
    );
    // A slow sweep of the filter keeps the drone alive without changing its pitch
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.09;
    const depth = c.createGain();
    depth.gain.value = filter.frequency.value * 0.25;
    lfo.connect(depth).connect(filter.frequency);
    lfo.start();
    filter.connect(env).connect(out());
    const voices = parts().map((s) => voice(c, s, filter));
    env.gain.setTargetAtTime(level(vol), c.currentTime, 0.35);
    live.current = { voices, filter, env, lfo };
    testHook("drone", live.current);
    setPlaying(true);
  }

  function stop() {
    const l = live.current;
    if (!l) return;
    live.current = null;
    setPlaying(false);
    const c = audio();
    l.env.gain.cancelScheduledValues(c.currentTime);
    l.env.gain.setTargetAtTime(0, c.currentTime, 0.3);
    const end = c.currentTime + 1.8;
    for (const v of l.voices) for (const o of v.oscs) o.stop(end);
    l.lfo.stop(end);
  }

  // Rebuild on structural changes; glide on note changes
  useEffect(() => {
    const l = live.current;
    if (!l) return;
    const c = audio();
    for (const v of l.voices)
      for (const o of v.oscs)
        o.frequency.setTargetAtTime(
          freqOf(midi + v.semis, a4),
          c.currentTime,
          0.06,
        );
    l.filter.frequency.setTargetAtTime(
      Math.min(12000, freqOf(midi, a4) * (timbre === "warm" ? 5 : 12)),
      c.currentTime,
      0.1,
    );
  }, [midi, a4]);
  useEffect(() => {
    if (!live.current) return;
    stop();
    const id = setTimeout(start, 60);
    return () => clearTimeout(id);
  }, [fifth, octave, timbre]);
  useEffect(() => {
    const l = live.current;
    if (l) l.env.gain.setTargetAtTime(level(vol), audio().currentTime, 0.05);
  }, [vol]);
  useEffect(() => () => stop(), []);

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

  const pcv = mod(midi, 12);
  const oct = Math.floor(midi / 12) - 1;
  const name = SHARPS[pcv]!;
  const f = freqOf(midi, a4);

  const stage = (
    <div
      className={`mt-drone${playing ? " on" : ""}`}
      data-freq={f.toFixed(3)}
      data-note={`${name}${oct}`}
    >
      <div className="mt-drone-orb" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="mt-drone-note">
        <strong>{name}</strong>
        <small>{num(oct)}</small>
      </div>
      <p className="mt-drone-hz">
        {num(f, 2)} Hz
        {fifth && <> · {T("with the fifth")}</>}
        {octave && <> · {T("with the octave")}</>}
      </p>
      <div className="mt-actions">
        <button
          type="button"
          className={`btn lg${playing ? "" : " acc"}`}
          onClick={() => (playing ? stop() : start())}
        >
          <Icon name={playing ? "stop" : "play"} />
          {playing ? T("Stop") : T("Play")}
        </button>
      </div>
      <Keys items={[[["Space"], T("play or stop")]]} />
    </div>
  );

  const side = (
    <>
      <Pills
        label={T("Note")}
        value={pcv}
        options={SHARPS.map((n, i) => [i, n] as [number, string])}
        onPick={(p) => setMidi((oct + 1) * 12 + p)}
      />
      <Choice
        label={T("Octave")}
        value={oct}
        options={[1, 2, 3, 4, 5].map((o) => [o, num(o)] as [number, string])}
        onPick={(o) => setMidi((o + 1) * 12 + pcv)}
      />
      <div className="mt-group">
        <Toggle label={T("Add the fifth")} on={fifth} onChange={setFifth} />
        <Toggle label={T("Add the octave")} on={octave} onChange={setOctave} />
      </div>
      <Choice
        label={T("Sound")}
        value={timbre}
        options={[
          ["warm", T("Warm")],
          ["organ", T("Organ")],
          ["pure", T("Pure")],
        ]}
        onPick={setTimbre}
      />
      <Range
        label={T("Volume")}
        value={vol}
        min={0}
        max={100}
        display={`${num(vol)}%`}
        onChange={setVol}
      />
      <NumInput
        label={T("Reference pitch A4")}
        name="a4"
        unit="Hz"
        value={a4}
        min={430}
        max={450}
        onChange={setA4}
      />
      <p className="mt-hint">
        {T(
          "Play or sing against the drone. When a note is slightly out, you hear a slow wobble (beating); it stops when you're in tune.",
        )}
      </p>
    </>
  );

  return <Card className="mt-drone-card" stage={stage} side={side} />;
}
