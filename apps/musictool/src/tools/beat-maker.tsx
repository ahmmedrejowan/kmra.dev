import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { downloadBlob } from "@kmra/ui/lib/files";
import type { ToolProps } from ".";
import { Card, Choice, Keys, NumInput, Pills, Range, busyTarget, load, save, useNum } from "../lib/ui";
import {
  DRUMS,
  DRUM_NAMES,
  LENGTHS,
  MAX_BPM,
  MIN_BPM,
  STARTERS,
  STEPS_PER_BEAT,
  clampBpm,
  emptyPattern,
  fromHash,
  fromStarter,
  hits,
  resize,
  sane,
  starter,
  toHash,
  type DrumId,
  type Pattern,
  type Vel,
} from "../lib/drums";
import { Sequencer, type Step } from "../lib/sequencer";
import type { ExportJob } from "../lib/beat-export.worker";

const STORE = "kmra-music-beat";
const PREFS = "kmra-music-beat-prefs";
const HISTORY = 100;

/** Row labels (the full names are in the mixer and the screen-reader labels) */
const SHORT: Record<DrumId, string> = {
  kick: "Kick",
  snare: "Snare",
  clap: "Clap",
  hat: "Hat",
  open: "Open hat",
  tomLow: "Low tom",
  tomHigh: "High tom",
  rim: "Rim",
};

function initial(preset: ToolProps["preset"]): { p: Pattern; from: string | null } {
  try {
    const h = fromHash(location.hash);
    if (h) return { p: h, from: "link" };
  } catch {
    // no location (prerender)
  }
  const s = starter(preset?.pattern);
  if (s) return { p: fromStarter(s), from: s.id };
  const stored = sane(load<unknown>(STORE, null));
  if (stored) return { p: stored, from: null };
  return { p: fromStarter(STARTERS[0]!), from: STARTERS[0]!.id };
}

/** The player for a component, and the step that is sounding now */
function useSequencer(p: Pattern) {
  const ref = useRef<Sequencer | null>(null);
  if (!ref.current) ref.current = new Sequencer(p);
  const seq = ref.current;
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState<Step | null>(null);

  useEffect(() => seq.set(p), [p]);
  useEffect(() => {
    if (!running) {
      setNow(null);
      return;
    }
    let raf = 0;
    const loop = () => {
      const s = seq.heard();
      if (s) setNow(s);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  useEffect(() => () => seq.dispose(), []);

  return {
    seq,
    running,
    now,
    toggle() {
      if (seq.running) {
        seq.stop();
        setRunning(false);
      } else {
        seq.start();
        setRunning(true);
      }
    },
    stop() {
      seq.stop();
      setRunning(false);
    },
  };
}

export default function BeatMaker({ preset }: ToolProps) {
  const T = useT();
  const num = useNum();
  const first = useMemo(() => initial(preset), []);
  const [p, setP] = useState<Pattern>(first.p);
  const [from, setFrom] = useState<string | null>(first.from);
  const past = useRef<Pattern[]>([]);
  const future = useRef<Pattern[]>([]);
  const [, bump] = useState(0);
  const prefs = load(PREFS, { draw: 1 as Vel, format: "wav" as "wav" | "mp3", loops: 4 });
  const [draw, setDraw] = useState<Vel>(prefs.draw === 2 ? 2 : 1);
  const [format, setFormat] = useState<"wav" | "mp3">(prefs.format === "mp3" ? "mp3" : "wav");
  const [loops, setLoops] = useState([1, 2, 4, 8].includes(prefs.loops) ? prefs.loops : 4);
  const [page, setPage] = useState(0);
  const [follow, setFollow] = useState(true);
  const [narrow, setNarrow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const player = useSequencer(p);

  useEffect(() => save(STORE, p), [p]);
  useEffect(() => save(PREFS, { draw, format, loops }), [draw, format, loops]);

  // Narrow screens show eight steps at a time
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setNarrow((e?.contentRect.width ?? 999) < 520));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const perPage = p.steps === 12 ? 12 : narrow ? 8 : 16;
  const pages = Math.ceil(p.steps / perPage);
  const cur = player.now?.step ?? -1;
  // Follow the playhead across pages while playing
  useEffect(() => {
    if (player.running && follow && cur >= 0) setPage(Math.floor(cur / perPage));
  }, [cur, follow, perPage, player.running]);
  useEffect(() => {
    if (page >= pages) setPage(0);
  }, [pages]);

  /** A change that undo can take back */
  function commit(next: Pattern, label: string | null = from) {
    past.current.push(p);
    if (past.current.length > HISTORY) past.current.shift();
    future.current = [];
    setP(next);
    setFrom(label);
    bump((n) => n + 1);
  }
  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(p);
    setP(prev);
    setFrom(null);
    bump((n) => n + 1);
  }
  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(p);
    setP(next);
    setFrom(null);
    bump((n) => n + 1);
  }
  /** Tempo, swing and the mix change live and aren't undo steps */
  const tweak = (patch: Partial<Pattern>) => setP((x) => ({ ...x, ...patch }));

  // Painting: the first cell decides on or off, dragging applies the same to every cell crossed
  const paint = useRef<{ value: Vel; base: Pattern; touched: Set<string> } | null>(null);
  function setCell(d: DrumId, i: number, value: Vel) {
    const s = paint.current;
    const key = `${d}:${i}`;
    if (!s || s.touched.has(key)) return;
    s.touched.add(key);
    setP((x) => {
      if (x.grid[d][i] === value) return x;
      const row = x.grid[d].slice();
      row[i] = value;
      return { ...x, grid: { ...x.grid, [d]: row } };
    });
  }
  function down(e: RPointerEvent, d: DrumId, i: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    const was = p.grid[d][i] ?? 0;
    paint.current = { value: was ? 0 : draw, base: p, touched: new Set() };
    setCell(d, i, paint.current.value);
    if (!was && !player.running) player.seq.preview(d);
  }
  function move(e: RPointerEvent) {
    if (!paint.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-cell]");
    if (!el) return;
    setCell(el.dataset.drum as DrumId, Number(el.dataset.step), paint.current.value);
  }
  useEffect(() => {
    const up = () => {
      const s = paint.current;
      if (!s) return;
      paint.current = null;
      // One undo step per stroke
      past.current.push(s.base);
      if (past.current.length > HISTORY) past.current.shift();
      future.current = [];
      setFrom(null);
      bump((n) => n + 1);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  /** Enter or Space on a focused cell (or a screen reader) toggles it */
  function key(d: DrumId, i: number) {
    const was = p.grid[d][i] ?? 0;
    const row = p.grid[d].slice();
    row[i] = was ? 0 : draw;
    commit({ ...p, grid: { ...p.grid, [d]: row } }, null);
    if (!was && !player.running) player.seq.preview(d);
  }

  const flag = (k: "mute" | "solo", d: DrumId) => tweak({ [k]: { ...p[k], [d]: !p[k][d] } });

  // Space plays, arrows change the tempo, ⌘/Ctrl+Z undoes
  const keys = useRef({ toggle: player.toggle, undo, redo });
  keys.current = { toggle: player.toggle, undo, redo };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "z") {
        const t = e.target as HTMLElement | null;
        if (t instanceof HTMLInputElement && t.type === "text") return;
        e.preventDefault();
        if (e.shiftKey) keys.current.redo();
        else keys.current.undo();
      } else if ((e.metaKey || e.ctrlKey) && k === "y") {
        e.preventDefault();
        keys.current.redo();
      } else if (e.key === " " || e.code === "Space") {
        if (e.repeat || busyTarget(e, true)) return;
        e.preventDefault();
        keys.current.toggle();
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (busyTarget(e, true)) return;
        e.preventDefault();
        const d = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1);
        setP((x) => ({ ...x, bpm: clampBpm(x.bpm + d) }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function copyLink() {
    const url = `${location.origin}${location.pathname}#${toHash(p)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNote(T("Link copied. Anyone who opens it hears this beat."));
    } catch {
      history.replaceState(null, "", `#${toHash(p)}`);
      setNote(T("The link is in the address bar: copy it from there."));
    }
  }

  function download() {
    setBusy(true);
    setNote(null);
    const w = new Worker(new URL("../lib/beat-export.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<{ ok: boolean; data?: ArrayBuffer; error?: string }>) => {
      w.terminate();
      setBusy(false);
      if (!e.data.ok || !e.data.data) {
        setNote(T("The file couldn't be made in this browser. Try WAV."));
        return;
      }
      const type = format === "mp3" ? "audio/mpeg" : "audio/wav";
      downloadBlob(new Blob([e.data.data], { type }), `beat-${p.bpm}bpm.${format}`);
    };
    w.onerror = () => {
      w.terminate();
      setBusy(false);
      setNote(T("The file couldn't be made in this browser. Try WAV."));
    };
    const job: ExportJob = { pattern: p, loops, format };
    w.postMessage(job);
  }

  const start = page * perPage;
  const shown = Array.from({ length: Math.min(perPage, p.steps - start) }, (_, k) => start + k);
  const beatOf = (i: number) => Math.floor(i / STEPS_PER_BEAT);
  const seconds = ((p.steps * 60) / p.bpm / STEPS_PER_BEAT) * loops;
  const velName = (v: Vel) => (v === 2 ? T("accent") : v === 1 ? T("on") : T("off"));
  const count = hits(p);

  const stage = (
    <div className={`mt-beat${player.running ? " on" : ""}`}>
      <div className="mt-beat-top">
        <button
          type="button"
          className={`btn lg mt-beat-play ${player.running ? "" : "acc"}`}
          onClick={() => {
            setFollow(true);
            player.toggle();
          }}
        >
          <Icon name={player.running ? "stop" : "play"} />
          {player.running ? T("Stop") : T("Play")}
        </button>
        <div className="mt-beat-tempo">
          <button type="button" className="mt-round sm" aria-label={T("Slower")} onClick={() => tweak({ bpm: clampBpm(p.bpm - 1) })}>
            <Icon name="minus" />
          </button>
          <div className="mt-beat-bpm" data-value={p.bpm}>
            <output aria-live="polite">{num(p.bpm)}</output>
            <span>BPM</span>
          </div>
          <button type="button" className="mt-round sm" aria-label={T("Faster")} onClick={() => tweak({ bpm: clampBpm(p.bpm + 1) })}>
            <Icon name="plus" />
          </button>
        </div>
        <div className="mt-beat-tools">
          <button type="button" className="btn" onClick={undo} disabled={!past.current.length} aria-label={T("Undo")} title={T("Undo")}>
            <Icon name="undo" />
          </button>
          <button type="button" className="btn" onClick={redo} disabled={!future.current.length} aria-label={T("Redo")} title={T("Redo")}>
            <Icon name="redo" />
          </button>
          <button
            type="button"
            className="btn"
            disabled={!count}
            onClick={() => commit({ ...emptyPattern(p.steps, p.bpm, p.swing), vol: p.vol, mute: p.mute, solo: p.solo }, null)}
          >
            <Icon name="trash" />
            {T("Clear")}
          </button>
        </div>
      </div>

      {pages > 1 && (
        <div className="seg mt-seg mt-beat-pages" role="group" aria-label={T("Steps shown")}>
          {Array.from({ length: pages }, (_, k) => (
            <button
              key={k}
              type="button"
              aria-pressed={page === k}
              onClick={() => {
                setPage(k);
                if (player.running) setFollow(false);
              }}
            >
              {T("Steps {a}–{b}", { a: num(k * perPage + 1), b: num(Math.min(p.steps, (k + 1) * perPage)) })}
              {player.running && Math.floor(cur / perPage) === k && <i className="mt-beat-here" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}

      <div
        ref={gridRef}
        className="mt-beat-grid"
        style={{ ["--cols" as string]: shown.length }}
        onPointerMove={move}
        data-steps={p.steps}
      >
        <div className="mt-beat-row mt-beat-head" aria-hidden="true">
          <span />
          {shown.map((i) => (
            <span key={i} className={`mt-beat-n${i % STEPS_PER_BEAT === 0 ? " beat" : ""}${i === cur ? " now" : ""}`}>
              {i % STEPS_PER_BEAT === 0 ? num(beatOf(i) + 1) : "·"}
            </span>
          ))}
        </div>
        {DRUMS.map((d) => {
          const heard = !p.mute[d] && (!DRUMS.some((x) => p.solo[x]) || p.solo[d]);
          return (
            <div
              key={d}
              className={`mt-beat-row${heard ? "" : " quiet"}`}
              role="group"
              aria-label={T(DRUM_NAMES[d])}
              data-drum={d}
            >
              <div className="mt-beat-name">
                <button
                  type="button"
                  className="mt-beat-drum"
                  title={T("Hear the {drum}", { drum: T(DRUM_NAMES[d]).toLowerCase() })}
                  onClick={() => player.seq.preview(d)}
                >
                  {T(SHORT[d])}
                </button>
                <button
                  type="button"
                  className="mt-beat-flag"
                  aria-pressed={p.mute[d]}
                  aria-label={T("Mute {drum}", { drum: T(DRUM_NAMES[d]) })}
                  title={T("Mute")}
                  onClick={() => flag("mute", d)}
                >
                  M
                </button>
                <button
                  type="button"
                  className="mt-beat-flag solo"
                  aria-pressed={p.solo[d]}
                  aria-label={T("Solo {drum}", { drum: T(DRUM_NAMES[d]) })}
                  title={T("Solo")}
                  onClick={() => flag("solo", d)}
                >
                  S
                </button>
              </div>
              {shown.map((i) => {
                const v = p.grid[d][i] ?? 0;
                return (
                  <button
                    key={i}
                    type="button"
                    data-cell=""
                    data-drum={d}
                    data-step={i}
                    data-v={v}
                    className={`mt-cell v${v}${beatOf(i) % 2 ? " odd" : ""}${i === cur ? " now" : ""}${
                      i === cur && v ? " hit" : ""
                    }`}
                    aria-pressed={v > 0}
                    aria-label={T("{drum}, step {n}: {state}", {
                      drum: T(DRUM_NAMES[d]),
                      n: num(i + 1),
                      state: velName(v),
                    })}
                    onPointerDown={(e) => down(e, d, i)}
                    onClick={(e) => {
                      // Pointer presses are handled on pointerdown; keyboard and screen-reader activation arrive here
                      if (e.detail === 0) key(d, i);
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <Keys
        items={[
          [["Space"], T("play or stop")],
          [["↑", "↓"], T("tempo ±1 (Shift ±10)")],
          [["⌘/Ctrl", "Z"], T("undo")],
        ]}
      />
    </div>
  );

  const side = (
    <>
      <div className="mt-group">
        <Pills
          label={T("Starter patterns")}
          value={from}
          options={STARTERS.map((s) => [s.id, T(s.name)] as [string, string])}
          onPick={(id) => commit(fromStarter(starter(id)!, p), id)}
        />
        <p className="mt-hint">{T("Pick one to start from, then change it. Your beat is kept on this device.")}</p>
      </div>
      <div className="mt-group">
        <NumInput
          label={T("Tempo")}
          name="bpm"
          unit="BPM"
          value={p.bpm}
          min={MIN_BPM}
          max={MAX_BPM}
          onChange={(bpm) => tweak({ bpm: clampBpm(bpm) })}
        />
        <Range
          label={T("Swing")}
          name="swing"
          value={p.swing}
          min={0}
          max={100}
          display={p.swing === 0 ? T("Straight") : `${num(p.swing)}%`}
          onChange={(swing) => tweak({ swing })}
        />
        <Choice
          label={T("Length")}
          value={p.steps}
          options={LENGTHS.map((n) => [n, n === 12 ? T("3/4 bar") : n === 16 ? T("4/4 bar") : T("2 bars")] as [number, string])}
          onPick={(n) => n !== p.steps && commit(resize(p, n), null)}
        />
        <Choice
          label={T("New steps")}
          value={draw}
          options={[
            [1 as Vel, T("Normal")],
            [2 as Vel, T("Accent")],
          ]}
          onPick={setDraw}
        />
      </div>
      <div className="mt-group mt-beat-mix">
        <span className="mt-label">{T("Mix")}</span>
        {DRUMS.map((d) => (
          <Range
            key={d}
            label={T(DRUM_NAMES[d])}
            name={`vol-${d}`}
            value={Math.round(p.vol[d] * 100)}
            min={0}
            max={100}
            display={`${num(Math.round(p.vol[d] * 100))}%`}
            onChange={(v) => tweak({ vol: { ...p.vol, [d]: v / 100 } })}
          />
        ))}
      </div>
      <div className="mt-group">
        <Choice
          label={T("File")}
          value={format}
          options={[
            ["wav", "WAV"],
            ["mp3", "MP3"],
          ]}
          onPick={setFormat}
        />
        <Choice
          label={T("Times through the loop")}
          value={loops}
          options={[1, 2, 4, 8].map((n) => [n, num(n)] as [number, string])}
          onPick={setLoops}
        />
        <p className="mt-hint">
          {T("{s} seconds. The file loops without a gap.", { s: num(seconds, seconds < 10 ? 1 : 0) })}
        </p>
        {format === "mp3" && (
          <p className="mt-hint">
            {T("MP3s are made with the")}{" "}
            <a href="https://lame.sourceforge.io/" target="_blank" rel="noopener noreferrer">
              {T("LAME encoder")}
            </a>
            .
          </p>
        )}
        <div className="mt-side-actions">
          <button type="button" className="btn acc" onClick={download} disabled={busy || !count} aria-busy={busy || undefined}>
            <Icon name="download" />
            {busy ? T("Making the file…") : T("Download {format}", { format: format.toUpperCase() })}
          </button>
          <button type="button" className="btn" onClick={() => void copyLink()} disabled={!count}>
            <Icon name="link" />
            {T("Copy link")}
          </button>
        </div>
        {note && (
          <p className="mt-hint" role="status">
            {note}
          </p>
        )}
      </div>
    </>
  );

  return <Card className="mt-beat-card" stage={stage} side={side} />;
}
