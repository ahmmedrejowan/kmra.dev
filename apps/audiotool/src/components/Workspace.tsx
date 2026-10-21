import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { downloadZip } from "@kmra/ui/components/kit";
import { downloadBlob, formatBytes } from "@kmra/ui/lib/files";
import { useT } from "@kmra/ui/lib/i18n-react";
import { toast } from "@kmra/ui/lib/toast";
import {
  AUDIO_ACCEPT,
  codecLabel,
  containerLabel,
  fmtTime,
  isAbort,
  plan,
  probe,
  run,
  sizeWarning,
  type AudioContainer,
  type Job,
  type MediaInfo,
  type Output,
  type Plan,
  type Progress,
  uniqueNames,
} from "@kmra/media/engine";
import {
  EngineBadge,
  MediaDrop,
  MediaInput,
  useMediaFiles,
} from "@kmra/media/components/MediaDrop";
import { WavePlayer } from "@kmra/media/components/WavePlayer";

/** Props every audiotool tool component takes (from the router) */
export interface ToolProps {
  preset?: Preset;
}

interface Item {
  key: number;
  file: File;
  info?: MediaInfo;
  probeError?: string;
  plan?: Plan;
  planKey?: string;
  status: "idle" | "running" | "done" | "error";
  progress?: Progress;
  out?: Output;
  doneKey?: string;
  error?: string;
}

export interface StageCtx {
  file: File;
  info: MediaInfo;
  /** Playhead of the preview, seconds */
  time: number;
  /** Move the preview's playhead */
  seek: (t: number) => void;
}

let nextKey = 1;

/** `?engine=ffmpeg` (or webcodecs) forces an engine: for tests and speed comparisons */
function forcedEngine(): "webcodecs" | "ffmpeg" | undefined {
  if (typeof location === "undefined") return undefined;
  const e = new URLSearchParams(location.search).get("engine");
  return e === "ffmpeg" || e === "webcodecs" ? e : undefined;
}

/**
 * The shared audio workspace: file info and the tool's settings on the left, the waveform player
 * in the middle (with the tool's own controls under it, e.g. a cut range), and the output on the
 * right (engine, estimated size, progress, before/after sizes, downloads). Every loaded file gets
 * the same settings; results download one by one or as a zip.
 */
export function Workspace({
  tool,
  multiple = true,
  dropTitle,
  chooseLabel,
  formats,
  accept,
  settings,
  job,
  suffix,
  action,
  stage,
  onFile,
  note,
  idle,
  inputAccept,
  reject,
  preview: customPreview,
  estimate,
  unknownSize,
  rename,
}: {
  /** Tool slug, used as a CSS hook */
  tool: string;
  multiple?: boolean;
  dropTitle?: string;
  /** The drop box button label */
  chooseLabel?: string;
  formats?: string[];
  accept?: (f: File) => boolean;
  /** The tool's settings (left column, under the file details) */
  settings: (ctx: { info: MediaInfo | null; file: File | null }) => ReactNode;
  /** The job for one file with the current settings (null = can't run yet) */
  job: (info: MediaInfo, file: File) => Job | null;
  /** Added to output names: "clip-compressed.mp4" */
  suffix: string;
  /** Run button label, e.g. "Compress" */
  action: string;
  /** Under the player (cut range …) */
  stage?: (ctx: StageCtx) => ReactNode;
  /** Called once per file when its details are known (or when it becomes the selected one) */
  onFile?: (file: File, info: MediaInfo) => void;
  /** Extra note in the output column */
  note?: (info: MediaInfo, file: File) => ReactNode;
  /**
   * Shown in the output column while the settings make no job (job() returns null); a function
   * says why for this file
   */
  idle?: string | ((info: MediaInfo, file: File) => string | undefined);
  /** File picker filter (default: audio and video files) */
  inputAccept?: string;
  /** Message when a dropped file isn't accepted */
  reject?: string;
  /**
   * Show the original or the result some other way (e.g. a GIF as an image); return undefined
   * for the usual player.
   */
  preview?: (blob: Blob, which: "original" | "result") => ReactNode | undefined;
  /**
   * A better size estimate than plan()'s (e.g. measured on a sample). Called after each plan;
   * a result for settings that changed meanwhile is dropped.
   */
  estimate?: (info: MediaInfo, file: File, job: Job) => Promise<number | null>;
  /**
   * The estimated size when it can't be worked out yet (e.g. Trim: "Depends on the cut");
   * without it the row is left out
   */
  unknownSize?: string;
  /** Change the output's file name (e.g. "song-cut.m4a" → "song-cut.m4r") */
  rename?: (name: string) => string;
}) {
  const T = useT();
  const [items, setItems] = useState<Item[]>([]);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  /** Place in the batch while running: file `i` (from 1) of `n` */
  const [batch, setBatch] = useState<{ i: number; n: number } | null>(null);
  const [view, setView] = useState<"original" | "result">("original");
  const [time, setTime] = useState(0);
  const [seek, setSeek] = useState<{ t: number; n: number }>({ t: 0, n: 0 });
  const ctrl = useRef<AbortController | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const jobRef = useRef(job);
  jobRef.current = job;
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;
  const estimateRef = useRef(estimate);
  estimateRef.current = estimate;

  const patch = (key: number, p: Partial<Item>) =>
    setItems((list) =>
      list.map((it) => (it.key === key ? { ...it, ...p } : it)),
    );

  const add = (files: File[]) => {
    if (busy)
      return toast(T("Wait for the current job to finish, or cancel it."));
    const list = (multiple ? files : files.slice(0, 1)).map<Item>((file) => ({
      key: nextKey++,
      file,
      status: "idle",
    }));
    setItems((cur) => (multiple ? [...cur, ...list] : list));
    if (!multiple || !itemsRef.current.length) {
      setSel(multiple ? itemsRef.current.length : 0);
      setView("original");
    }
    void (async () => {
      for (const it of list) {
        try {
          const info = await probe(it.file);
          // Nothing to play (no picture, no sound): a damaged or unrelated file
          if (!info.video && !info.audio)
            throw new Error("No picture or sound found");
          patch(it.key, { info });
        } catch (e) {
          patch(it.key, {
            probeError: e instanceof Error ? e.message : String(e),
            status: "error",
          });
        }
      }
    })();
  };
  const { dragging, pickRef, pick, take } = useMediaFiles(add, accept, reject);

  const cur = items[sel] ?? items[0];

  // When the selected file's details arrive, let the tool set itself up (e.g. trim range)
  const announced = useRef<number | null>(null);
  useEffect(() => {
    if (cur?.info && announced.current !== cur.key) {
      announced.current = cur.key;
      setTime(0);
      onFileRef.current?.(cur.file, cur.info);
    }
  }, [cur?.key, cur?.info]);

  // Jobs for the current settings; a change re-plans and clears results made with other settings
  const jobs = items.map((it) => (it.info ? job(it.info, it.file) : null));
  const keys = jobs.map((j) => (j ? JSON.stringify(j) : ""));
  const keySig = keys.join("|");
  useEffect(() => {
    items.forEach((it, i) => {
      const k = keys[i]!;
      const j = jobs[i];
      if (!it.info || !j) return;
      if (it.planKey !== k) {
        patch(it.key, { planKey: k });
        const info = it.info;
        void plan(it.file, j, info)
          .then(async (p) => {
            patch(it.key, { plan: p });
            const est = estimateRef.current;
            if (!est) return;
            const bytes = await est(info, it.file, j);
            const now = itemsRef.current.find((x) => x.key === it.key);
            if (bytes !== null && now?.planKey === k)
              patch(it.key, { plan: { ...p, estimatedBytes: bytes } });
          })
          .catch(() => {});
      }
      if (it.doneKey && it.doneKey !== k && it.status !== "running")
        patch(it.key, {
          out: undefined,
          doneKey: undefined,
          status: "idle",
          error: undefined,
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keySig]);
  useEffect(() => {
    if (view === "result" && !cur?.out) setView("original");
  }, [cur?.out, view]);

  const pending = items.filter(
    (it, i) =>
      it.info && jobs[i] && !(it.status === "done" && it.doneKey === keys[i]),
  );
  const done = items.filter((it) => it.status === "done" && it.out);

  async function start() {
    if (busy) return;
    const ac = new AbortController();
    ctrl.current = ac;
    setBusy(true);
    let failed = 0;
    // The files this run makes, so the batch progress can say "file 2 of 5"
    const queue: { it: Item; j: Job; k: string }[] = [];
    for (const it of itemsRef.current) {
      if (!it.info) continue;
      const j = jobRef.current(it.info, it.file);
      if (!j) continue;
      const k = JSON.stringify(j);
      if (it.status === "done" && it.doneKey === k) continue;
      queue.push({ it, j, k });
    }
    for (const [qi, { it, j, k }] of queue.entries()) {
      if (ac.signal.aborted) break;
      setBatch({ i: qi + 1, n: queue.length });
      patch(it.key, {
        status: "running",
        error: undefined,
        progress: { ratio: 0, stage: "Reading the file" },
      });
      try {
        const out = await run(it.file, j, {
          signal: ac.signal,
          suffix,
          engine: forcedEngine(),
          onProgress: (p) => patch(it.key, { progress: p }),
        });
        if (rename) out.name = rename(out.name);
        patch(it.key, { status: "done", out, doneKey: k, progress: undefined });
        if (it.key === (itemsRef.current[sel] ?? itemsRef.current[0])?.key)
          setView("result");
      } catch (e) {
        if (isAbort(e)) {
          patch(it.key, { status: "idle", progress: undefined });
          break;
        }
        failed++;
        console.error(e);
        patch(it.key, {
          status: "error",
          progress: undefined,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    ctrl.current = null;
    setBusy(false);
    setBatch(null);
    if (ac.signal.aborted) toast(T("Cancelled"));
    else if (failed) toast(T("Some files couldn't be processed"));
  }

  /**
   * Remove a file. The selection stays on the same file; when the selected one goes, its
   * neighbour (the next one, or the one before at the end) is selected.
   */
  const remove = (key: number) => {
    if (busy) return;
    const list = itemsRef.current;
    const at = list.findIndex((it) => it.key === key);
    if (at < 0) return;
    const selKey = (list[sel] ?? list[0])?.key;
    const rest = list.filter((it) => it.key !== key);
    setItems(rest);
    if (selKey === key) {
      const next = Math.max(0, Math.min(at, rest.length - 1));
      setSel(next);
      setView(rest[next]?.out ? "result" : "original");
    } else
      setSel(
        Math.max(
          0,
          rest.findIndex((it) => it.key === selKey),
        ),
      );
  };

  // Output names, unique in the batch: "clip.mov" and "clip.mkv" → "clip-convert.mp4",
  // "clip-convert-2.mp4"
  const named = items.filter((it) => it.out);
  const outNames = new Map(
    uniqueNames(named.map((it) => it.out!.name)).map((n, i) => [
      named[i]!.key,
      n,
    ]),
  );
  const nameOf = (it: Item) => outNames.get(it.key) ?? it.out?.name ?? "";

  const saveAll = () =>
    void downloadZip(
      done.map((it) => ({ name: nameOf(it), blob: it.out!.blob })),
      `audio-${suffix}.zip`,
    );
  const saveEach = () =>
    done.forEach((it, i) =>
      setTimeout(() => downloadBlob(it.out!.blob, nameOf(it)), i * 600),
    );

  const preview =
    view === "result" && cur?.out ? cur.out.blob : (cur?.file ?? null);
  const warn = cur ? sizeWarning(cur.file, cur.plan?.engine) : null;
  const j = cur ? jobs[items.indexOf(cur)] : null;

  const input = (
    <MediaInput
      inputRef={pickRef}
      onFiles={take}
      multiple={multiple}
      accept={inputAccept ?? AUDIO_ACCEPT}
    />
  );

  if (!cur)
    return (
      <div className={`toolcard solo vt-ws vt-${tool}`}>
        {input}
        <div className="stage">
          <MediaDrop
            title={dropTitle}
            formats={formats}
            dragging={dragging}
            onPick={pick}
            button={
              chooseLabel ??
              (multiple ? T("Choose audio files") : T("Choose an audio file"))
            }
          />
        </div>
      </div>
    );

  return (
    <div className={`toolcard tri vt-ws vt-${tool}${dragging ? " over" : ""}`}>
      {input}
      <aside className="controls side-l">
        {(multiple || items.length > 1) && (
          <div className="ctl vt-files">
            <span className="lbl">
              {T("Files")}
              <span>{items.length}</span>
            </span>
            <ul>
              {items.map((it, i) => (
                <li key={it.key} className={it === cur ? "on" : undefined}>
                  <button
                    type="button"
                    className="vt-file"
                    aria-pressed={it === cur}
                    onClick={() => {
                      setSel(i);
                      setView(it.out ? "result" : "original");
                    }}
                  >
                    <span className="nm" title={it.file.name}>
                      {it.file.name}
                    </span>
                    <span className="st">
                      {it.status === "running"
                        ? `${Math.round((it.progress?.ratio ?? 0) * 100)}%`
                        : it.status === "done" && it.out
                          ? formatBytes(it.out.blob.size)
                          : it.status === "error"
                            ? T("Failed")
                            : formatBytes(it.file.size)}
                    </span>
                  </button>
                  {it.status === "done" && it.out && (
                    <button
                      type="button"
                      className="btn xs"
                      aria-label={T("Download {name}", { name: nameOf(it) })}
                      onClick={() => downloadBlob(it.out!.blob, nameOf(it))}
                    >
                      <Icon name="download" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn xs"
                    aria-label={T("Remove {name}", { name: it.file.name })}
                    disabled={busy}
                    onClick={() => remove(it.key)}
                  >
                    <Icon name="x" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn sm"
              onClick={pick}
              disabled={busy}
            >
              <Icon name="plus" />
              {T("Add files")}
            </button>
          </div>
        )}
        <FileDetails
          item={cur}
          onReplace={multiple ? undefined : pick}
          onRemove={
            multiple || items.length > 1 ? undefined : () => remove(cur.key)
          }
          busy={busy}
        />
        {settings({ info: cur.info ?? null, file: cur.file })}
      </aside>

      <div className="stage vt-stage">
        <div className="vt-stage-head">
          <span className="vt-name" title={cur.file.name}>
            {view === "result" && cur.out ? nameOf(cur) : cur.file.name}
          </span>
          {cur.out && (
            <div className="seg sm" role="group" aria-label={T("Show")}>
              <button
                type="button"
                aria-pressed={view === "original"}
                onClick={() => setView("original")}
              >
                {T("Original")}
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
        {(preview &&
          customPreview?.(
            preview,
            view === "result" ? "result" : "original",
          )) ?? (
          <WavePlayer
            file={preview}
            seek={view === "original" ? seek : undefined}
            onTime={view === "original" ? setTime : undefined}
            label={view === "result" ? T("Result") : T("Original")}
          />
        )}
        {cur.info && stage && view === "original" && (
          <div className="vt-under">
            {stage({
              file: cur.file,
              info: cur.info,
              time,
              seek: (t) => setSeek((s) => ({ t, n: s.n + 1 })),
            })}
          </div>
        )}
      </div>

      <aside className="controls side-r vt-out" aria-live="polite">
        <div className="ctl">
          <span className="lbl">{T("Output")}</span>
          {cur.plan && j ? (
            <dl className="kv vt-plan">
              <div>
                <dt>{T("Format")}</dt>
                <dd>{containerLabel(j.to)}</dd>
              </div>
              {cur.plan.audioBitrate > 0 && (
                <div>
                  <dt>{T("Bitrate")}</dt>
                  <dd>{Math.round(cur.plan.audioBitrate / 1000)} kbps</dd>
                </div>
              )}
              {(cur.plan.estimatedBytes !== null || unknownSize) && (
                <div>
                  <dt>{T("Estimated size")}</dt>
                  <dd
                    className="vt-est"
                    data-bytes={cur.plan.estimatedBytes ?? undefined}
                  >
                    {cur.plan.estimatedBytes !== null
                      ? `≈ ${formatBytes(cur.plan.estimatedBytes)}`
                      : unknownSize}
                  </dd>
                </div>
              )}
              <div>
                <dt>{T("Engine")}</dt>
                <dd>
                  <EngineBadge
                    engine={cur.out?.engine ?? cur.plan.engine}
                    reason={cur.plan.reason}
                  />
                </dd>
              </div>
            </dl>
          ) : cur.probeError ? null : cur.info && !j ? (
            <p className="muted vt-wait">
              {(typeof idle === "function" ? idle(cur.info, cur.file) : idle) ??
                T("Change a setting to make a new file.")}
            </p>
          ) : (
            <p className="muted vt-wait">{T("Reading the file")}</p>
          )}
        </div>

        {cur.probeError && (
          <p className="note warn" role="alert">
            {T(
              "This file couldn't be read. It may be damaged or not an audio file.",
            )}
          </p>
        )}
        {warn && <p className="note warn">{T(warn)}</p>}
        {cur.info && note?.(cur.info, cur.file)}

        {busy ? (
          <div className="vt-progress" role="status">
            {batch && batch.n > 1 && (
              <div className="vt-batch">
                <div className="vt-pline">
                  <span>{T("File {i} of {n}", batch)}</span>
                  <b>
                    {Math.round(
                      ((batch.i -
                        1 +
                        (items.find((it) => it.status === "running")?.progress
                          ?.ratio ?? 0)) /
                        batch.n) *
                        100,
                    )}
                    %
                  </b>
                </div>
                <span className="mp-bar">
                  <i
                    style={{
                      width: `${Math.round(
                        ((batch.i -
                          1 +
                          (items.find((it) => it.status === "running")?.progress
                            ?.ratio ?? 0)) /
                          batch.n) *
                          100,
                      )}%`,
                    }}
                  />
                </span>
              </div>
            )}
            {items
              .filter((it) => it.status === "running")
              .map((it) => (
                <div key={it.key}>
                  <div className="vt-pline">
                    <span>{T(it.progress?.stage ?? "Encoding")}</span>
                    <b>{Math.round((it.progress?.ratio ?? 0) * 100)}%</b>
                  </div>
                  <span className="mp-bar">
                    <i
                      style={{
                        width: `${Math.round((it.progress?.ratio ?? 0) * 100)}%`,
                      }}
                    />
                  </span>
                  {items.length > 1 && (
                    <span className="muted vt-pfile">{it.file.name}</span>
                  )}
                </div>
              ))}
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
            disabled={!pending.length}
            onClick={() => void start()}
          >
            {pending.length > 1
              ? T("{action} {n} files", { action, n: pending.length })
              : action}
          </button>
        )}

        {cur.status === "error" && cur.error && !cur.probeError && (
          <p className="note warn" role="alert">
            {T("This file couldn't be processed.")}{" "}
            <span className="muted">{cur.error}</span>
          </p>
        )}

        {cur.out && (
          <div
            className="vt-result"
            data-engine={cur.out.engine}
            data-bytes={cur.out.blob.size}
          >
            <div className="vt-sizes">
              <span>
                <small>{T("Before")}</small>
                {formatBytes(cur.file.size)}
              </span>
              <Icon name="right" />
              <span>
                <small>{T("After")}</small>
                <b>{formatBytes(cur.out.blob.size)}</b>
              </span>
              <em
                className={cur.out.blob.size <= cur.file.size ? "down" : "up"}
              >
                {cur.out.blob.size <= cur.file.size ? "−" : "+"}
                {Math.abs(
                  Math.round((1 - cur.out.blob.size / cur.file.size) * 100),
                )}
                %
              </em>
            </div>
            {cur.out.info && (
              <p className="muted vt-outinfo">
                {[
                  fmtTime(cur.out.info.durationSec),
                  cur.out.info.audio?.bitrate
                    ? `${Math.round(cur.out.info.audio.bitrate / 1000)} kbps`
                    : "",
                  T("made in {s} s", { s: (cur.out.ms / 1000).toFixed(1) }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <button
              type="button"
              className="btn primary vt-download"
              onClick={() => downloadBlob(cur.out!.blob, nameOf(cur))}
            >
              <Icon name="download" />
              {T("Download {ext}", {
                ext: cur.out.name.split(".").pop()!.toUpperCase(),
              })}
            </button>
          </div>
        )}
        {done.length > 1 && (
          // Shown whenever two or more files are done, even when the selected one failed
          <div className="vt-all">
            <button type="button" className="btn vt-zip" onClick={saveAll}>
              <Icon name="download" />
              {T("Download all ({n}) as zip", { n: done.length })}
            </button>
            <button type="button" className="btn sm" onClick={saveEach}>
              {T("Download each file")}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

export function FileDetails({
  item,
  onReplace,
  onRemove,
  busy,
}: {
  item: Pick<Item, "file" | "info" | "probeError">;
  onReplace?: () => void;
  /** Single-file tools hide the file list: this takes the file away (back to the drop box) */
  onRemove?: () => void;
  busy: boolean;
}) {
  const T = useT();
  const i = item.info;
  const rows = useMemo(() => {
    if (!i) return [];
    const r: [string, string][] = [
      [T("Format"), containerLabel(i.container)],
      [T("Length"), fmtTime(i.durationSec)],
      [T("Size"), formatBytes(item.file.size)],
    ];
    if (i.audio) {
      r.push([
        T("Sound"),
        [
          codecLabel(i.audio.codec),
          i.audio.channels === 1
            ? T("mono")
            : i.audio.channels === 2
              ? T("stereo")
              : `${i.audio.channels} ch`,
          i.audio.sampleRate
            ? `${Math.round(i.audio.sampleRate / 100) / 10} kHz`
            : "",
        ]
          .filter(Boolean)
          .join(", "),
      ]);
      if (i.audio.bitrate)
        r.push([T("Bitrate"), `${Math.round(i.audio.bitrate / 1000)} kbps`]);
    } else r.push([T("Sound"), T("None")]);
    if (i.video) r.push([T("Picture"), T("Left out (sound only)")]);
    return r;
  }, [i, item.file.size, T]);
  return (
    <div className="ctl vt-details">
      <span className="lbl">
        {T("Audio details")}
        {(onReplace || onRemove) && (
          <span style={{ display: "flex", gap: 6 }}>
            {onReplace && (
              <button
                type="button"
                className="btn xs"
                onClick={onReplace}
                disabled={busy}
              >
                {T("Change file")}
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                className="btn xs vt-remove"
                aria-label={T("Remove {name}", { name: item.file.name })}
                onClick={onRemove}
                disabled={busy}
              >
                {T("Remove")}
              </button>
            )}
          </span>
        )}
      </span>
      {i ? (
        <dl className="kv">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : !item.probeError ? (
        <p className="muted">{T("Reading the file")}</p>
      ) : null}
    </div>
  );
}

/** Output format for tools that keep the input's format when they can */
export function sameAudio(info: MediaInfo): AudioContainer {
  const c = info.container;
  const codec = info.audio?.codec ?? "";
  if (c === "mp3") return "mp3";
  if (c === "wav") return "wav";
  if (c === "flac") return "flac";
  if (c === "ogg") return codec === "opus" ? "opus" : "ogg";
  if (c === "mp4" || c === "mov" || c === "aac") return "m4a";
  return "mp3";
}
