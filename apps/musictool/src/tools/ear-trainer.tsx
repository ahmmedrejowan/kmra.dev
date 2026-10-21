import { useEffect, useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import type { ToolProps } from ".";
import { Card, Choice, Keys, busyTarget, load, save, useNum } from "../lib/ui";
import { INTERVALS, SHARPS, freqOf } from "../lib/theory";
import { key } from "../lib/sound";
import { audio } from "../lib/audio";

type Mode = "intervals" | "chords" | "degrees";
type Dir = "up" | "down" | "together";

interface Item {
  id: string;
  label: string;
}

const QUALITIES = [
  { id: "maj", name: "Major", iv: [0, 4, 7] },
  { id: "min", name: "Minor", iv: [0, 3, 7] },
  { id: "dim", name: "Diminished", iv: [0, 3, 6] },
  { id: "aug", name: "Augmented", iv: [0, 4, 8] },
  { id: "maj7", name: "Major 7th", iv: [0, 4, 7, 11] },
  { id: "m7", name: "Minor 7th", iv: [0, 3, 7, 10] },
  { id: "7", name: "Dominant 7th", iv: [0, 4, 7, 10] },
];
const DEGREES = [
  { id: "1", semis: 0 },
  { id: "2", semis: 2 },
  { id: "3", semis: 4 },
  { id: "4", semis: 5 },
  { id: "5", semis: 7 },
  { id: "6", semis: 9 },
  { id: "7", semis: 11 },
];
const WEIGHTS = "kmra-music-ear";
const PREFS = "kmra-music-ear-prefs";

interface Question {
  answer: string;
  /** MIDI notes: played in order (melodic) or together */
  notes: number[];
  together: boolean;
  /** Degrees mode: the key's tonic (a cadence is played first) */
  tonic?: number;
}

/** Pick an item, missed ones more often: weight 1 … 8, doubled on a miss, lowered on a hit */
function weighted(
  ids: string[],
  w: Record<string, number>,
  avoid?: string,
): string {
  const pool = ids.length > 1 && avoid ? ids.filter((i) => i !== avoid) : ids;
  const total = pool.reduce((a, i) => a + (w[i] ?? 1), 0);
  let r = Math.random() * total;
  for (const i of pool) {
    r -= w[i] ?? 1;
    if (r <= 0) return i;
  }
  return pool[pool.length - 1]!;
}

export default function EarTrainer(_: ToolProps) {
  const T = useT();
  const num = useNum();
  const prefs = load(PREFS, {
    mode: "intervals" as Mode,
    intervals: ["M2", "m3", "M3", "P4", "P5", "P8"],
    chords: ["maj", "min"],
    dir: "up" as Dir,
  });
  const [mode, setMode] = useState<Mode>(prefs.mode);
  const [picked, setPicked] = useState<Record<Mode, string[]>>({
    intervals: prefs.intervals,
    chords: prefs.chords,
    degrees: DEGREES.map((d) => d.id),
  });
  const [dir, setDir] = useState<Dir>(prefs.dir);
  const [q, setQ] = useState<Question | null>(null);
  const [guess, setGuess] = useState<string | null>(null);
  const [score, setScore] = useState({
    right: 0,
    asked: 0,
    streak: 0,
    best: 0,
  });
  const weights = useRef<Record<string, Record<string, number>>>(
    load(WEIGHTS, {}),
  );
  const last = useRef<string | undefined>(undefined);

  useEffect(
    () =>
      save(PREFS, {
        mode,
        intervals: picked.intervals,
        chords: picked.chords,
        dir,
      }),
    [mode, picked, dir],
  );

  const items: Item[] =
    mode === "intervals"
      ? INTERVALS.map((i) => ({ id: i.id, label: T(i.name) }))
      : mode === "chords"
        ? QUALITIES.map((c) => ({ id: c.id, label: T(c.name) }))
        : DEGREES.map((d) => ({ id: d.id, label: num(d.id) }));
  const active = picked[mode].length ? picked[mode] : items.map((i) => i.id);
  /** The answer buttons, in display order */
  const shown = items.filter((i) => active.includes(i.id));

  function playQ(question: Question) {
    const c = audio();
    let t = c.currentTime + 0.08;
    if (question.tonic !== undefined) {
      // I – IV – V – I sets the key
      for (const chord of [
        [0, 4, 7],
        [5, 9, 12],
        [7, 11, 14],
        [0, 4, 7],
      ]) {
        for (const s of chord)
          key(freqOf(question.tonic + s - 12), t, 0.5, 0.9);
        t += 0.62;
      }
      t += 0.35;
    }
    if (question.together)
      for (const m of question.notes) key(freqOf(m), t, 0.75, 1.8);
    else
      question.notes.forEach((m, i) => key(freqOf(m), t + i * 0.7, 0.85, 1.3));
  }

  function next() {
    const w = weights.current[mode] ?? {};
    const id = weighted(active, w, last.current);
    last.current = id;
    let question: Question;
    if (mode === "intervals") {
      const semis = INTERVALS.find((i) => i.id === id)!.semis;
      const low = 52 + Math.floor(Math.random() * 12);
      const notes = dir === "down" ? [low + semis, low] : [low, low + semis];
      question = { answer: id, notes, together: dir === "together" };
    } else if (mode === "chords") {
      const root = 50 + Math.floor(Math.random() * 12);
      const iv = QUALITIES.find((c) => c.id === id)!.iv;
      question = {
        answer: id,
        notes: iv.map((s) => root + s),
        together: dir !== "up",
      };
    } else {
      const tonic = 55 + Math.floor(Math.random() * 10);
      const semis = DEGREES.find((d) => d.id === id)!.semis;
      question = { answer: id, notes: [tonic + semis], together: false, tonic };
    }
    setQ(question);
    setGuess(null);
    playQ(question);
  }

  function answer(id: string) {
    if (!q || guess) return;
    setGuess(id);
    const ok = id === q.answer;
    setScore((s) => {
      const streak = ok ? s.streak + 1 : 0;
      return {
        right: s.right + (ok ? 1 : 0),
        asked: s.asked + 1,
        streak,
        best: Math.max(s.best, streak),
      };
    });
    const w = { ...(weights.current[mode] ?? {}) };
    w[q.answer] = ok
      ? Math.max(1, (w[q.answer] ?? 1) - 1)
      : Math.min(8, (w[q.answer] ?? 1) * 2);
    if (!ok) w[id] = Math.min(8, (w[id] ?? 1) + 1);
    weights.current = { ...weights.current, [mode]: w };
    save(WEIGHTS, weights.current);
  }

  function toggle(id: string) {
    setPicked((p) => {
      const cur = p[mode];
      const nextList = cur.includes(id)
        ? cur.filter((x) => x !== id)
        : [...cur, id];
      return { ...p, [mode]: nextList.length >= 2 ? nextList : cur };
    });
    setQ(null);
    setGuess(null);
  }

  // Keys: R replay, Enter or N next, 1–9 answer
  const ref = useRef({ next, q, guess, answer, shown, playQ });
  ref.current = { next, q, guess, answer, shown, playQ };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || busyTarget(e, true)) return;
      const r = ref.current;
      const k = e.key.toLowerCase();
      if (k === "r" && r.q) r.playQ(r.q);
      else if (k === "enter" || k === "n") {
        if (!r.q || r.guess) {
          e.preventDefault();
          r.next();
        }
      } else if (/^[1-9]$/.test(k) && r.q && !r.guess) {
        const it = r.shown[Number(k) - 1];
        if (it) r.answer(it.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ok = guess !== null && q !== null && guess === q.answer;
  const label = (id: string) => items.find((i) => i.id === id)?.label ?? id;
  const keyName = q?.tonic !== undefined ? SHARPS[q.tonic % 12] : null;

  const stage = (
    <div className="mt-ear" data-answer={q?.answer ?? ""}>
      <dl className="mt-score" aria-live="polite">
        <div data-id="score">
          <dt>{T("Score")}</dt>
          <dd data-value={score.right}>
            {num(score.right)}/{num(score.asked)}
          </dd>
        </div>
        <div data-id="streak">
          <dt>{T("Streak")}</dt>
          <dd data-value={score.streak}>{num(score.streak)}</dd>
        </div>
        <div data-id="best">
          <dt>{T("Best streak")}</dt>
          <dd>{num(score.best)}</dd>
        </div>
      </dl>
      <p className="mt-ear-prompt">
        {!q
          ? T("Press Start, listen, then pick the answer.")
          : guess === null
            ? mode === "intervals"
              ? T("Which interval was that?")
              : mode === "chords"
                ? T("Which chord was that?")
                : T(
                    "Which degree of the scale was the last note? (key of {key})",
                    { key: keyName ?? "" },
                  )
            : ok
              ? T("Right: {answer}", { answer: label(q.answer) })
              : T("Not quite: it was {answer}", { answer: label(q.answer) })}
      </p>
      <div className="mt-answers" role="group" aria-label={T("Answers")}>
        {shown.map((i, n) => {
          const state =
            !guess || !q
              ? ""
              : i.id === q.answer
                ? " right"
                : i.id === guess
                  ? " wrong"
                  : "";
          return (
            <button
              key={i.id}
              type="button"
              className={`mt-answer${state}`}
              disabled={!q || guess !== null}
              onClick={() => answer(i.id)}
            >
              {n < 9 && <kbd aria-hidden="true">{num(n + 1)}</kbd>}
              {i.label}
            </button>
          );
        })}
      </div>
      <div className="mt-actions">
        {!q || guess ? (
          <button type="button" className="btn acc lg" onClick={next}>
            <Icon name="play" />
            {q ? T("Next") : T("Start")}
          </button>
        ) : null}
        <button
          type="button"
          className="btn lg"
          onClick={() => q && playQ(q)}
          disabled={!q}
        >
          <Icon name="rotateRight" />
          {T("Play again")}
        </button>
      </div>
      <Keys
        items={[
          [["1–9"], T("answer")],
          [["R"], T("play again")],
          [["Enter"], T("next")],
        ]}
      />
    </div>
  );

  const side = (
    <>
      <Choice
        label={T("Practise")}
        value={mode}
        options={[
          ["intervals", T("Intervals")],
          ["chords", T("Chords")],
          ["degrees", T("Scale degrees")],
        ]}
        onPick={(m) => {
          setMode(m);
          setQ(null);
          setGuess(null);
        }}
      />
      {mode !== "degrees" && (
        <div className="mt-field">
          <span className="mt-label">
            {mode === "intervals"
              ? T("Intervals to practise")
              : T("Chords to practise")}
          </span>
          <div
            className="chips mt-pills"
            role="group"
            aria-label={
              mode === "intervals"
                ? T("Intervals to practise")
                : T("Chords to practise")
            }
          >
            {items.map((i) => (
              <button
                key={i.id}
                type="button"
                aria-pressed={picked[mode].includes(i.id)}
                onClick={() => toggle(i.id)}
              >
                {i.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {mode !== "degrees" && (
        <Choice
          label={T("Play")}
          value={mode === "chords" && dir === "down" ? "together" : dir}
          options={
            mode === "intervals"
              ? [
                  ["up", T("Rising")],
                  ["down", T("Falling")],
                  ["together", T("Together")],
                ]
              : [
                  ["together", T("Together")],
                  ["up", T("One by one")],
                ]
          }
          onPick={setDir}
        />
      )}
      {mode === "degrees" && (
        <p className="mt-hint">
          {T(
            "A short chord progression sets the key, then one note plays. Name its degree: 1 is the key note.",
          )}
        </p>
      )}
      <p className="mt-hint">
        {T(
          "The ones you miss come back more often. Your progress is kept in this browser only.",
        )}
      </p>
      <button
        type="button"
        className="btn sm"
        onClick={() => {
          weights.current = {};
          save(WEIGHTS, {});
          setScore({ right: 0, asked: 0, streak: 0, best: 0 });
        }}
      >
        {T("Reset score and progress")}
      </button>
    </>
  );

  return <Card className="mt-ear-card" stage={stage} side={side} />;
}
