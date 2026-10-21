import { useEffect, useMemo, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import { Card, Choice, Pills, load, pre, save, useNum } from "../lib/ui";
import { ChordDiagram } from "../components/ChordDiagram";
import {
  CHORDS,
  ROOTS,
  chord,
  chordType,
  freqOf,
  mod,
  noteName,
  type Chord,
} from "../lib/theory";
import { FRETTED, voicings, type Fretted } from "../lib/voicing";
import { pluck, strum } from "../lib/sound";
import { audio } from "../lib/audio";

type Inst = Fretted["id"];
const PREFS = "kmra-music-chords";

export default function Chords({ preset }: ToolProps) {
  const T = useT();
  const num = useNum();
  const saved = load(PREFS, { inst: "guitar" as Inst, root: 0, type: "maj" });
  const presetInst = pre(preset?.instrument, "");
  const [inst, setInst] = useState<Inst>(
    presetInst === "guitar" || presetInst === "ukulele" || presetInst === "bass"
      ? presetInst
      : saved.inst,
  );
  const [rootIdx, setRootIdx] = useState(saved.root);
  const [typeId, setTypeId] = useState(saved.type);
  const [shape, setShape] = useState(0);

  useEffect(
    () => save(PREFS, { inst, root: rootIdx, type: typeId }),
    [inst, rootIdx, typeId],
  );
  useEffect(() => setShape(0), [inst, rootIdx, typeId]);

  const c: Chord = useMemo(
    () => chord(ROOTS[rootIdx]!, chordType(typeId)),
    [rootIdx, typeId],
  );
  const fretted = FRETTED[inst];
  const list = useMemo(() => voicings(c, fretted), [c, fretted]);
  const v = list[Math.min(shape, list.length - 1)];
  const nameOfPc = (p: number) => {
    const i = c.pcs.indexOf(p);
    return i >= 0 ? noteName(c.notes[i]!) : "";
  };
  const sounding = v
    ? v.frets.map((f, s) => (f < 0 ? null : fretted.strings[s]! + f))
    : [];

  function play(arp = false) {
    audio();
    const freqs = sounding
      .filter((m): m is number => m !== null)
      .map((m) => freqOf(m));
    if (arp)
      freqs.forEach((f, i) =>
        pluck(f, audio().currentTime + 0.05 + i * 0.32, 0.85),
      );
    else strum(freqs, 0, inst === "bass" ? 0.06 : 0.035);
  }

  const fullName = `${noteName(c.root)} ${T(c.type.name).toLowerCase()}`;

  const stage = (
    <div
      className="mt-chord"
      data-chord={c.symbol}
      data-notes={c.notes.map((n) => noteName(n, true)).join(" ")}
    >
      <div className="mt-chord-head">
        <h2 className="mt-chord-symbol">{c.symbol}</h2>
        <p className="mt-chord-full">{fullName}</p>
      </div>
      {v ? (
        <ChordDiagram
          v={v}
          strings={fretted.strings.length}
          title={c.symbol}
          labels={sounding.map((m) => (m === null ? "" : nameOfPc(mod(m, 12))))}
        />
      ) : (
        <p className="mt-hint">
          {T("No playable shape for this chord on this instrument.")}
        </p>
      )}
      {list.length > 1 && (
        <div className="mt-shapes">
          <button
            type="button"
            className="mt-round sm"
            aria-label={T("Previous shape")}
            onClick={() => setShape((shape - 1 + list.length) % list.length)}
          >
            <Icon name="back" />
          </button>
          <span className="mt-shapes-n" aria-live="polite">
            {T("Shape {n} of {total}", {
              n: num(shape + 1),
              total: num(list.length),
            })}
          </span>
          <button
            type="button"
            className="mt-round sm"
            aria-label={T("Next shape")}
            onClick={() => setShape((shape + 1) % list.length)}
          >
            <Icon name="right" />
          </button>
        </div>
      )}
      <ul className="mt-notes" aria-label={T("Notes in the chord")}>
        {c.notes.map((n, i) => (
          <li key={i} className={i === 0 ? "root" : ""}>
            <strong>{noteName(n)}</strong>
            <small>{c.degrees[i]}</small>
          </li>
        ))}
      </ul>
      <div className="mt-actions">
        <button
          type="button"
          className="btn acc lg"
          onClick={() => play()}
          disabled={!v}
        >
          <Icon name="play" />
          {T("Strum")}
        </button>
        <button
          type="button"
          className="btn lg"
          onClick={() => play(true)}
          disabled={!v}
        >
          <Icon name="music" />
          {T("Note by note")}
        </button>
      </div>
    </div>
  );

  const side = (
    <>
      <Choice
        label={T("Instrument")}
        value={inst}
        options={[
          ["guitar", T("Guitar")],
          ["ukulele", T("Ukulele")],
          ["bass", T("Bass")],
        ]}
        onPick={setInst}
      />
      <p className="mt-hint">
        {inst === "guitar"
          ? T("Standard tuning, EADGBE.")
          : inst === "ukulele"
            ? T("GCEA tuning (soprano, concert and tenor).")
            : T("4-string bass, EADG: root, fifth and octave shapes.")}
      </p>
      <Pills
        label={T("Root")}
        value={rootIdx}
        options={ROOTS.map((r, i) => [i, noteName(r)] as [number, string])}
        onPick={setRootIdx}
      />
      <Pills
        label={T("Chord")}
        value={typeId}
        options={CHORDS.map(
          (t) =>
            [
              t.id,
              t.symbol ? `${noteName(c.root)}${t.symbol}` : noteName(c.root),
            ] as [string, string],
        )}
        onPick={setTypeId}
      />
    </>
  );

  return <Card className="mt-chord-card" stage={stage} side={side} />;
}
