import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import { Card, Choice, Pills, Select, load, save } from "../lib/ui";
import { Fretboard, Piano, type Mark } from "../components/Boards";
import {
  ROOTS,
  SCALES,
  freqOf,
  noteName,
  pc,
  scale,
  scaleType,
} from "../lib/theory";
import { key } from "../lib/sound";
import { audio } from "../lib/audio";

type View = "guitar" | "ukulele" | "piano";
const PREFS = "kmra-music-scales";
const BOARDS = { guitar: [40, 45, 50, 55, 59, 64], ukulele: [67, 60, 64, 69] };

export default function Scales({ preset }: ToolProps) {
  const T = useT();
  const saved = load(PREFS, {
    root: 9,
    scale: "minor-pentatonic",
    view: "guitar" as View,
    frets: 15,
    labels: "notes",
  });
  const [rootIdx, setRootIdx] = useState(saved.root);
  const [scaleId, setScaleId] = useState(
    typeof preset?.scale === "string" ? preset.scale : saved.scale,
  );
  const [view, setView] = useState<View>(saved.view);
  const [frets, setFrets] = useState(saved.frets);
  const [labels, setLabels] = useState<"notes" | "degrees">(
    saved.labels === "degrees" ? "degrees" : "notes",
  );
  const [active, setActive] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () => save(PREFS, { root: rootIdx, scale: scaleId, view, frets, labels }),
    [rootIdx, scaleId, view, frets, labels],
  );

  const sc = useMemo(
    () => scale(ROOTS[rootIdx]!, scaleType(scaleId)),
    [rootIdx, scaleId],
  );
  const marks: Mark[] = sc.notes.map((n, i) => ({
    pc: sc.pcs[i]!,
    label: labels === "notes" ? noteName(n) : sc.degrees[i]!,
    root: i === 0,
  }));
  // One run of the scale from the root around middle C, plus the octave
  const rootMidi = 60 + ((pc(sc.root) + 12) % 12) - (pc(sc.root) >= 7 ? 12 : 0);
  const run = [...sc.semis.map((s) => rootMidi + s), rootMidi + 12];

  function stopPlaying() {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
    setActive(null);
  }

  function play(order: "up" | "down" | "both") {
    stopPlaying();
    const c = audio();
    const seq =
      order === "up"
        ? run
        : order === "down"
          ? [...run].reverse()
          : [...run, ...[...run].reverse().slice(1)];
    const step = 0.34;
    const t0 = c.currentTime + 0.08;
    seq.forEach((m, i) => {
      key(freqOf(m), t0 + i * step, 0.9, 1.1);
      timers.current.push(
        window.setTimeout(() => setActive(m), (0.08 + i * step) * 1000),
      );
    });
    timers.current.push(
      window.setTimeout(
        () => setActive(null),
        (0.08 + seq.length * step + 0.2) * 1000,
      ),
    );
  }
  useEffect(() => stopPlaying, []);

  const title = `${noteName(sc.root)} ${T(sc.type.name).toLowerCase()}`;

  const stage = (
    <div
      className="mt-scale"
      data-notes={sc.notes.map((n) => noteName(n, true)).join(" ")}
    >
      <div className="mt-chord-head">
        <h2 className="mt-scale-title">{title}</h2>
        <ul className="mt-notes" aria-label={T("Notes in the scale")}>
          {sc.notes.map((n, i) => (
            <li
              key={i}
              className={`${i === 0 ? "root" : ""}${active !== null && active % 12 === sc.pcs[i] ? " on" : ""}`}
            >
              <strong>{noteName(n)}</strong>
              <small>{sc.degrees[i]}</small>
            </li>
          ))}
        </ul>
      </div>
      <div className={`mt-board ${view}`}>
        {view === "piano" ? (
          <Piano
            marks={marks}
            active={active}
            from={rootMidi >= 60 ? 60 : 48}
          />
        ) : (
          <Fretboard
            strings={BOARDS[view]}
            frets={frets}
            marks={marks}
            active={active}
            title={T("{scale} on the {instrument} fretboard", {
              scale: title,
              instrument: view === "guitar" ? T("guitar") : T("ukulele"),
            })}
          />
        )}
      </div>
      <div className="mt-actions">
        <button type="button" className="btn acc lg" onClick={() => play("up")}>
          <Icon name="play" />
          {T("Play up")}
        </button>
        <button type="button" className="btn lg" onClick={() => play("down")}>
          {T("Down")}
        </button>
        <button type="button" className="btn lg" onClick={() => play("both")}>
          {T("Up and down")}
        </button>
      </div>
    </div>
  );

  const side = (
    <>
      <Pills
        label={T("Root")}
        value={rootIdx}
        options={ROOTS.map((r, i) => [i, noteName(r)] as [number, string])}
        onPick={setRootIdx}
      />
      <Select
        label={T("Scale")}
        name="scale"
        value={scaleId}
        options={SCALES.map((s) => [s.id, T(s.name)] as [string, string])}
        onChange={setScaleId}
      />
      <Choice
        label={T("Show on")}
        value={view}
        options={[
          ["guitar", T("Guitar")],
          ["ukulele", T("Ukulele")],
          ["piano", T("Piano")],
        ]}
        onPick={setView}
      />
      {view !== "piano" && (
        <Choice
          label={T("Frets")}
          value={frets}
          options={[
            [12, "12"],
            [15, "15"],
            [24, "24"],
          ]}
          onPick={setFrets}
        />
      )}
      <Choice
        label={T("Labels")}
        value={labels}
        options={[
          ["notes", T("Note names")],
          ["degrees", T("Degrees")],
        ]}
        onPick={setLabels}
      />
    </>
  );

  return <Card className="mt-scale-card" stage={stage} side={side} />;
}
