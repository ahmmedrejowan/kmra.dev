import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Seg } from "@kmra/ui/components/controls";
import { Icon } from "@kmra/ui/components/Icon";
import { downloadBlob, formatBytes } from "@kmra/ui/lib/files";
import { useT } from "@kmra/ui/lib/i18n-react";
import { toast } from "@kmra/ui/lib/toast";
import {
  codecLabel,
  containerLabel,
  fmtTime,
  frameAt,
  isAbort,
  plan,
  probe,
  run,
  type Job,
  type MediaInfo,
  type Output,
  type Plan,
  type Progress,
} from "@kmra/media/engine";
import {
  EngineBadge,
  MediaDrop,
  MediaInput,
  useMediaFiles,
} from "@kmra/media/components/MediaDrop";
import { VideoPreview } from "@kmra/media/components/VideoPreview";
import type { ToolProps } from "./Workspace";

interface Clip {
  key: number;
  file: File;
  info?: MediaInfo;
  error?: boolean;
  thumb?: string;
}

let nextKey = 1;

function forcedEngine(): "webcodecs" | "ffmpeg" | undefined {
  if (typeof location === "undefined") return undefined;
  const e = new URLSearchParams(location.search).get("engine");
  return e === "ffmpeg" || e === "webcodecs" ? e : undefined;
}

const sizeOf = (i?: MediaInfo) =>
  i?.video ? `${i.video.width} × ${i.video.height}` : "";

/**
 * Merge: two or more clips joined in the order shown (drag the cards, or use the arrow buttons /
 * Alt + arrow keys). Clips encoded alike (same codec, size, frame rate, sound) are copied one
 * after another: instant and lossless. Others are fitted to the first clip's size and frame rate
 * (black bars or a blurred background) and encoded again. Always MP4.
 */
export default function Merge(_: ToolProps) {
  const T = useT();
  const [clips, setClips] = useState<Clip[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [fit, setFit] = useState<"contain" | "pad-blur">("contain");
  const [p, setPlan] = useState<{ key: string; plan: Plan } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [out, setOut] = useState<{ key: string; out: Output } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"clip" | "result">("clip");
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const clipsRef = useRef(clips);
  clipsRef.current = clips;

  const patch = (key: number, c: Partial<Clip>) =>
    setClips((l) => l.map((x) => (x.key === key ? { ...x, ...c } : x)));

  const add = (files: File[]) => {
    if (busy)
      return toast(T("Wait for the current job to finish, or cancel it."));
    const list = files.map<Clip>((file) => ({ key: nextKey++, file }));
    setClips((l) => [...l, ...list]);
    setSel((s) => s ?? list[0]?.key ?? null);
    void (async () => {
      for (const c of list) {
        try {
          const info = await probe(c.file);
          patch(c.key, { info });
          if (info.video) {
            const blob = await frameAt(
              c.file,
              Math.min(1, info.durationSec / 2),
              { width: 240, type: "image/jpeg", quality: 0.8 },
            ).catch(() => null);
            if (blob) patch(c.key, { thumb: URL.createObjectURL(blob) });
          }
        } catch {
          patch(c.key, { error: true });
        }
      }
    })();
  };
  const { dragging, pickRef, pick, take } = useMediaFiles(add);

  useEffect(
    () => () => {
      for (const c of clipsRef.current)
        if (c.thumb) URL.revokeObjectURL(c.thumb);
    },
    [],
  );

  const ready = clips.filter((c) => c.info?.video);
  const waiting = clips.some((c) => !c.info && !c.error);
  const files = ready.map((c) => c.file);
  const job: Job = { to: "mp4", copyWhenPossible: true, video: { fit } };
  const key = `${ready.map((c) => c.key).join(",")}|${fit}`;
  const total = ready.reduce((s, c) => s + c.info!.durationSec, 0);
  const sizes = new Set(ready.map((c) => sizeOf(c.info)));
  const silent = ready.filter((c) => !c.info!.audio).length;

  useEffect(() => {
    if (ready.length < 2 || waiting) return;
    let live = true;
    void plan(files, job)
      .then((pl) => live && setPlan({ key, plan: pl }))
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, waiting]);

  const result = out && out.key === key ? out.out : null;
  useEffect(() => {
    if (!result && view === "result") setView("clip");
  }, [result, view]);

  async function start() {
    if (busy || ready.length < 2) return;
    const ac = new AbortController();
    ctrl.current = ac;
    setBusy(true);
    setError(null);
    setProgress({ ratio: 0, stage: "Reading the video" });
    try {
      const o = await run(files, job, {
        signal: ac.signal,
        // Named after the first file: "intro.mp4" + others → "intro-merge-kmra.mp4"
        suffix: "merge",
        engine: forcedEngine(),
        onProgress: setProgress,
      });
      setOut({ key, out: o });
      setView("result");
    } catch (e) {
      if (isAbort(e)) toast(T("Cancelled"));
      else {
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      ctrl.current = null;
      setBusy(false);
      setProgress(null);
    }
  }

  const move = (from: number, to: number) => {
    if (busy || to < 0 || to >= clips.length || from === to) return;
    setClips((l) => {
      const n = [...l];
      const [c] = n.splice(from, 1);
      n.splice(to, 0, c!);
      return n;
    });
  };
  const remove = (k: number) => {
    if (busy) return;
    const c = clips.find((x) => x.key === k);
    if (c?.thumb) URL.revokeObjectURL(c.thumb);
    const rest = clips.filter((x) => x.key !== k);
    setClips(rest);
    if (sel === k) setSel(rest[0]?.key ?? null);
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    if (!e.altKey) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(i, i - 1);
      focusCard(i - 1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(i, i + 1);
      focusCard(i + 1);
    }
  };
  const focusCard = (i: number) =>
    requestAnimationFrame(() =>
      document
        .querySelectorAll<HTMLElement>(".vt-clip .vt-clip-pick")
        [i]?.focus(),
    );

  const input = <MediaInput inputRef={pickRef} onFiles={take} multiple />;

  if (!clips.length)
    return (
      <div className="toolcard solo vt-ws vt-merge">
        {input}
        <div className="stage">
          <MediaDrop
            title={T("Drop two or more videos to join them")}
            dragging={dragging}
            onPick={pick}
            button={T("Choose videos")}
          />
        </div>
      </div>
    );

  const cur = clips.find((c) => c.key === sel) ?? clips[0]!;
  const curIndex = clips.indexOf(cur);
  const pl = p && p.key === key ? p.plan : null;
  const first = ready[0]?.info;

  return (
    <div className={`toolcard tri vt-ws vt-merge${dragging ? " over" : ""}`}>
      {input}
      <aside className="controls side-l">
        <div className="ctl vt-details">
          <span className="lbl">{T("Clips")}</span>
          <dl className="kv">
            <div>
              <dt>{T("Clips")}</dt>
              <dd>{clips.length}</dd>
            </div>
            <div>
              <dt>{T("Total length")}</dt>
              <dd className="vt-total">{fmtTime(total)}</dd>
            </div>
            <div>
              <dt>{T("Total size")}</dt>
              <dd>{formatBytes(ready.reduce((s, c) => s + c.file.size, 0))}</dd>
            </div>
          </dl>
        </div>
        {sizes.size > 1 && (
          <>
            <Seg
              label={T("Fit other sizes")}
              options={[
                ["contain", T("Black bars")],
                ["pad-blur", T("Blur")],
              ]}
              value={fit}
              onPick={setFit}
            />
            <p className="note">
              {T(
                "The clips have different sizes. Each is fitted into {size}, the first clip's size, without cropping. Put the clip whose size you want first.",
                { size: sizeOf(first) },
              )}
            </p>
          </>
        )}
        {silent > 0 && silent < ready.length && (
          <p className="note">
            {T("Clips without sound get silence, so the sound stays in step.")}
          </p>
        )}
      </aside>

      <div className="stage vt-stage">
        <div className="vt-stage-head">
          <span className="vt-name" title={cur.file.name}>
            {view === "result" && result
              ? result.name
              : T("Clip {n}: {name}", { n: curIndex + 1, name: cur.file.name })}
          </span>
          {result && (
            <div className="seg sm" role="group" aria-label={T("Show")}>
              <button
                type="button"
                aria-pressed={view === "clip"}
                onClick={() => setView("clip")}
              >
                {T("Clips")}
              </button>
              <button
                type="button"
                aria-pressed={view === "result"}
                onClick={() => setView("result")}
              >
                {T("Result")}
              </button>
            </div>
          )}
        </div>
        <VideoPreview
          file={view === "result" && result ? result.blob : cur.file}
          aspect={(() => {
            const v = (view === "result" ? result?.info : cur.info)?.video;
            return v ? v.width / v.height : undefined;
          })()}
          label={view === "result" ? T("Result") : T("Original")}
        />
        <div className="vt-under">
          <ol className="vt-clips" aria-label={T("Order")}>
            {clips.map((c, i) => (
              <li
                key={c.key}
                className={`vt-clip${c === cur ? " on" : ""}${
                  drag && drag.to === i && drag.from !== i
                    ? drag.from < i
                      ? " drop-after"
                      : " drop-before"
                    : ""
                }${c.error ? " bad" : ""}`}
                draggable={!busy}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(i));
                  setDrag({ from: i, to: i });
                }}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  if (drag.to !== i) setDrag({ ...drag, to: i });
                }}
                onDrop={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  move(drag.from, i);
                  setDrag(null);
                }}
                onDragEnd={() => setDrag(null)}
              >
                <button
                  type="button"
                  className="vt-clip-pick"
                  aria-pressed={c === cur}
                  aria-label={T("Clip {n}: {name}", {
                    n: i + 1,
                    name: c.file.name,
                  })}
                  aria-describedby="vt-move-hint"
                  onClick={() => {
                    setSel(c.key);
                    setView("clip");
                  }}
                  onKeyDown={(e) => onKey(e, i)}
                >
                  <span className="vt-thumb">
                    {c.thumb ? <img src={c.thumb} alt="" /> : null}
                    <b>{i + 1}</b>
                    {c.info && <em>{fmtTime(c.info.durationSec)}</em>}
                  </span>
                  <span className="vt-clip-name" title={c.file.name}>
                    {c.file.name}
                  </span>
                  <span className="vt-clip-meta muted">
                    {c.error
                      ? T("Can't be read")
                      : c.info
                        ? [
                            sizeOf(c.info),
                            c.info.video?.fps
                              ? `${Math.round(c.info.video.fps)} fps`
                              : "",
                            codecLabel(c.info.video?.codec),
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : T("Reading the video")}
                  </span>
                </button>
                <div className="vt-clip-tools">
                  <button
                    type="button"
                    className="btn xs"
                    aria-label={T("Move {name} earlier", { name: c.file.name })}
                    disabled={busy || i === 0}
                    onClick={() => move(i, i - 1)}
                  >
                    <Icon name="back" />
                  </button>
                  <button
                    type="button"
                    className="btn xs"
                    aria-label={T("Move {name} later", { name: c.file.name })}
                    disabled={busy || i === clips.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <Icon name="back" className="ico vt-mirror" />
                  </button>
                  <button
                    type="button"
                    className="btn xs"
                    aria-label={T("Remove {name}", { name: c.file.name })}
                    disabled={busy}
                    onClick={() => remove(c.key)}
                  >
                    <Icon name="x" />
                  </button>
                </div>
              </li>
            ))}
            <li className="vt-clip vt-clip-add">
              <button type="button" onClick={pick} disabled={busy}>
                <Icon name="plus" />
                {T("Add videos")}
              </button>
            </li>
          </ol>
          <p className="muted vt-move-hint" id="vt-move-hint">
            {T(
              "Drag the clips to change the order, or press Alt and an arrow key.",
            )}
          </p>
        </div>
      </div>

      <aside className="controls side-r vt-out" aria-live="polite">
        <div className="ctl">
          <span className="lbl">{T("Output")}</span>
          {pl && ready.length >= 2 ? (
            <dl className="kv vt-plan">
              <div>
                <dt>{T("Format")}</dt>
                <dd>{containerLabel("mp4")}</dd>
              </div>
              <div>
                <dt>{T("Resolution")}</dt>
                <dd>
                  {pl.width} × {pl.height}
                </dd>
              </div>
              <div>
                <dt>{T("Length")}</dt>
                <dd>{fmtTime(total)}</dd>
              </div>
              <div>
                <dt>{T("Estimated size")}</dt>
                <dd className="vt-est">
                  {pl.estimatedBytes !== null
                    ? `≈ ${formatBytes(pl.estimatedBytes)}`
                    : "–"}
                </dd>
              </div>
              <div>
                <dt>{T("Engine")}</dt>
                <dd>
                  <EngineBadge
                    engine={result?.engine ?? pl.engine}
                    reason={pl.reason}
                  />
                </dd>
              </div>
            </dl>
          ) : (
            <p className="muted vt-wait">
              {ready.length < 2 && !waiting
                ? T("Add at least two videos to join them.")
                : T("Reading the video")}
            </p>
          )}
        </div>
        {pl?.engine === "copy" && (
          <p className="note">
            {T(
              "These clips were encoded alike, so they're joined as they are: instant and lossless.",
            )}
          </p>
        )}

        {busy ? (
          <div className="vt-progress" role="status">
            <div>
              <div className="vt-pline">
                <span>{T(progress?.stage ?? "Joining")}</span>
                <b>{Math.round((progress?.ratio ?? 0) * 100)}%</b>
              </div>
              <span className="mp-bar">
                <i
                  style={{
                    width: `${Math.round((progress?.ratio ?? 0) * 100)}%`,
                  }}
                />
              </span>
            </div>
            <button
              type="button"
              className="btn vt-cancel"
              onClick={() => ctrl.current?.abort()}
            >
              <Icon name="x" />
              {T("Cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn acc lg vt-run"
            disabled={ready.length < 2 || waiting || !!result}
            onClick={() => void start()}
          >
            {T("Merge {n} videos", { n: ready.length })}
          </button>
        )}

        {error && (
          <p className="note warn" role="alert">
            {T("These videos couldn't be joined.")}{" "}
            <span className="muted">{error}</span>
          </p>
        )}

        {result && (
          <div
            className="vt-result"
            data-engine={result.engine}
            data-bytes={result.blob.size}
          >
            <p className="muted vt-outinfo">
              {[
                result.info ? fmtTime(result.info.durationSec) : "",
                result.info?.video
                  ? `${result.info.video.width} × ${result.info.video.height}`
                  : "",
                formatBytes(result.blob.size),
                T("made in {s} s", { s: (result.ms / 1000).toFixed(1) }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <button
              type="button"
              className="btn primary vt-download"
              onClick={() => downloadBlob(result.blob, result.name)}
            >
              <Icon name="download" />
              {T("Download {ext}", { ext: "MP4" })}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
