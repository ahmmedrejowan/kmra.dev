import { useEffect, useMemo, useRef, useState } from "react";
import { Seg, Slider, Toggle } from "@kmra/ui/components/controls";
import { Icon } from "@kmra/ui/components/Icon";
import { downloadZip } from "@kmra/ui/components/kit";
import { downloadBlob, formatBytes } from "@kmra/ui/lib/files";
import { useT } from "@kmra/ui/lib/i18n-react";
import { toast } from "@kmra/ui/lib/toast";
import {
  baseName,
  fmtTime,
  frameAt,
  frames,
  isAbort,
  probe,
  sceneChanges,
  thumbnails,
  type MediaInfo,
  type Progress,
} from "@kmra/media/engine";
import {
  MediaDrop,
  MediaInput,
  useMediaFiles,
} from "@kmra/media/components/MediaDrop";
import { Timeline } from "@kmra/media/components/Timeline";
import { VideoPreview } from "@kmra/media/components/VideoPreview";
import { BlobImage } from "./Pictures";
import { FileDetails, type ToolProps } from "./Workspace";

type Mode = "still" | "interval" | "frames" | "scenes";
type Kind = "png" | "jpg";

/** Most images one export makes (a zip of thousands of full-size frames would fill the memory) */
const LIMIT = 500;
/** Most tiles on a contact sheet */
const SHEET_LIMIT = 120;
/** Thumbnails shown in the preview strip */
const STRIP = 36;
const SECONDS = [0.5, 1, 2, 5, 10];
const NTH = [1, 10, 30, 60];
const SENS: [number, string][] = [
  [0.45, "Low"],
  [0.3, "Medium"],
  [0.18, "High"],
];

interface Result {
  key: string;
  files: { name: string; blob: Blob; t: number }[];
  sheet?: boolean;
}

/** 5.25 → "0m05.2s" (for file names) */
const stamp = (t: number) => `${fmtTime(t).replace(":", "m")}s`;

/**
 * Extract frames: save the frame on screen, or frames every N seconds, every N frames or at each
 * scene change (in the part chosen on the timeline), as PNG or JPG in a zip, or all on one
 * contact sheet. The strip under the video shows what will be saved.
 */
export default function ExtractFrames(_: ToolProps) {
  const T = useT();
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [probeError, setProbeError] = useState<string>();
  const [mode, setMode] = useState<Mode>("still");
  const [time, setTime] = useState(0);
  const [seek, setSeek] = useState({ t: 0, n: 0 });
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [every, setEvery] = useState(1);
  const [everyText, setEveryText] = useState("1");
  const [nth, setNth] = useState(30);
  const [sens, setSens] = useState(0.3);
  const [scenes, setScenes] = useState<{ key: string; times: number[] } | null>(
    null,
  );
  const [scan, setScan] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>("png");
  const [quality, setQuality] = useState(90);
  const [width, setWidth] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [cols, setCols] = useState(4);
  const [labels, setLabels] = useState(true);
  const [busy, setBusy] = useState<Progress | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string>();
  const ctrl = useRef<AbortController | null>(null);

  const add = (files: File[]) => {
    if (busy)
      return toast(T("Wait for the current job to finish, or cancel it."));
    const f = files[0]!;
    setFile(f);
    setInfo(null);
    setProbeError(undefined);
    setResult(null);
    setScenes(null);
    setError(undefined);
    void probe(f)
      .then((i) => {
        setInfo(i);
        setRange([0, i.durationSec]);
        setTime(0);
      })
      .catch((e) => setProbeError(e instanceof Error ? e.message : String(e)));
  };
  const { dragging, pickRef, pick, take } = useMediaFiles(add);

  const D = info?.durationSec ?? 0;
  const [a, b] = [range[0], Math.min(range[1] || D, D)];
  const fps = info?.video?.fps || 30;
  const sceneKey = file ? `${file.name}|${file.size}|${a}|${b}|${sens}` : "";

  // What will be saved: the times, capped
  const planned = useMemo(() => {
    if (!info?.video) return { times: [] as number[], over: false };
    const list: number[] = [];
    if (mode === "still") list.push(Math.min(time, Math.max(0, D - 0.001)));
    else if (mode === "interval")
      // From the start, every N seconds, up to (not including) the end
      for (
        let k = 0, t = a;
        (t < b - 1e-6 || !k) && list.length <= LIMIT;
        t = a + ++k * every
      )
        list.push(t);
    else if (mode === "frames")
      for (
        let t = a + 0.25 / fps;
        t < b && list.length <= LIMIT;
        t += nth / fps
      )
        list.push(t);
    else if (scenes?.key === sceneKey) list.push(...scenes.times);
    const cap = sheet && mode !== "still" ? SHEET_LIMIT : LIMIT;
    return { times: list.slice(0, cap), over: list.length > cap };
  }, [info, mode, time, D, a, b, every, nth, fps, scenes, sceneKey, sheet]);

  const key = JSON.stringify([
    file?.name,
    file?.size,
    planned.times,
    kind,
    kind === "jpg" ? quality : 0,
    width,
    mode !== "still" && sheet ? [cols, labels] : 0,
  ]);
  useEffect(() => {
    if (result && result.key !== key) setResult(null);
  }, [key, result]);

  // Scene changes: found again (debounced) when the part or the sensitivity changes
  useEffect(() => {
    if (mode !== "scenes" || !file || !info?.video) return;
    if (scenes?.key === sceneKey) return;
    const ac = new AbortController();
    const timer = setTimeout(() => {
      setScan(0);
      void sceneChanges(file, {
        threshold: sens,
        start: a,
        end: b,
        max: LIMIT + 1,
        signal: ac.signal,
        onProgress: (p) => setScan(p.ratio),
      })
        .then((times) => setScenes({ key: sceneKey, times }))
        .catch((e) => {
          if (!isAbort(e)) setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => !ac.signal.aborted && setScan(null));
    }, 350);
    return () => {
      clearTimeout(timer);
      ac.abort();
      setScan(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sceneKey, info]);

  async function save() {
    if (!file || !info || busy || !planned.times.length) return;
    const ac = new AbortController();
    ctrl.current = ac;
    setError(undefined);
    setBusy({ ratio: 0, stage: "Saving frames" });
    const type = kind === "jpg" ? "image/jpeg" : "image/png";
    const q = quality / 100;
    // "clip.mp4" → "clip-extract-frames-001.png" (an earlier "-kmra" tag is dropped)
    const base = `${baseName(file.name)}-extract-frames`;
    const w =
      width && info.video && width < info.video.width ? width : undefined;
    try {
      if (mode === "still") {
        const t = planned.times[0]!;
        const blob = await frameAt(file, t, { width: w, type, quality: q });
        setResult({
          key,
          files: [{ name: `${base}-${stamp(t)}.${kind}`, blob, t }],
        });
      } else if (sheet) {
        const blob = await contactSheet(file, info, planned.times, {
          cols,
          labels,
          type,
          quality: q,
          signal: ac.signal,
          onProgress: setBusy,
          title: file.name,
          subtitle: [
            fmtTime(info.durationSec),
            info.video ? `${info.video.width} × ${info.video.height}` : "",
            T("{n} frames", { n: planned.times.length }),
          ]
            .filter(Boolean)
            .join("  ·  "),
        });
        setResult({
          key,
          sheet: true,
          files: [{ name: `${base}-contact-sheet.${kind}`, blob, t: 0 }],
        });
      } else {
        const digits = Math.max(3, String(planned.times.length).length);
        const files: Result["files"] = [];
        await frames(file, planned.times, {
          width: w,
          type,
          quality: q,
          signal: ac.signal,
          onProgress: setBusy,
          onFrame: (i, blob, t) =>
            (files[i] = {
              name: `${base}-${String(i + 1).padStart(digits, "0")}.${kind}`,
              blob,
              t,
            }),
        });
        setResult({ key, files: files.filter(Boolean) });
      }
    } catch (e) {
      if (isAbort(e)) toast(T("Cancelled"));
      else {
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      ctrl.current = null;
      setBusy(null);
    }
  }

  const input = (
    <MediaInput inputRef={pickRef} onFiles={take} multiple={false} />
  );
  if (!file)
    return (
      <div className="toolcard solo vt-ws vt-extract-frames">
        {input}
        <div className="stage">
          <MediaDrop
            title={T("Drop a video to save frames from it")}
            dragging={dragging}
            onPick={pick}
          />
        </div>
      </div>
    );

  const total = result?.files.reduce((s, f) => s + f.blob.size, 0) ?? 0;
  const n = planned.times.length;
  const action =
    mode === "still"
      ? T("Save this frame")
      : sheet
        ? T("Make contact sheet")
        : n === 1
          ? T("Save 1 frame")
          : T("Save {n} frames", { n });

  return (
    <div
      className={`toolcard tri vt-ws vt-extract-frames${dragging ? " over" : ""}`}
    >
      {input}
      <aside className="controls side-l">
        <FileDetails
          item={{ file, info: info ?? undefined, probeError }}
          onReplace={pick}
          busy={!!busy}
        />
        <div className="ctl">
          <span className="lbl">{T("Save")}</span>
          <div className="seg vt-seg2" role="group" aria-label={T("Save")}>
            {(
              [
                ["still", T("This frame")],
                ["interval", T("Every few seconds")],
                ["frames", T("Every few frames")],
                ["scenes", T("Scene changes")],
              ] as [Mode, string][]
            ).map(([m, l]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {mode === "interval" && (
          <div className="ctl vt-target">
            <label htmlFor="vt-every">
              {T("Every")}
              <span>{T("{s} s", { s: every })}</span>
            </label>
            <div className="vt-mb">
              <input
                id="vt-every"
                className="num"
                inputMode="decimal"
                value={everyText}
                onChange={(e) => {
                  setEveryText(e.target.value);
                  const v = parseFloat(e.target.value.replace(",", "."));
                  if (Number.isFinite(v) && v >= 0.01 && v <= 3600) setEvery(v);
                }}
                onBlur={() => setEveryText(String(every))}
              />
              <span>{T("seconds")}</span>
            </div>
            <div
              className="chips vt-chips"
              role="group"
              aria-label={T("Every")}
            >
              {SECONDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  aria-pressed={every === s}
                  onClick={() => {
                    setEvery(s);
                    setEveryText(String(s));
                  }}
                >
                  {T("{s} s", { s })}
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === "frames" && (
          <Seg
            label={T("Every")}
            options={NTH.map(
              (k) =>
                [k, k === 1 ? T("Each frame") : T("{n} frames", { n: k })] as [
                  number,
                  string,
                ],
            )}
            value={nth}
            onPick={setNth}
          />
        )}
        {mode === "scenes" && (
          <>
            <Seg
              label={T("Sensitivity")}
              options={SENS.map(([v, l]) => [v, T(l)] as [number, string])}
              value={sens}
              onPick={setSens}
            />
            <p className="note vt-hint">
              {T(
                "Finds the cuts between shots. Higher sensitivity also catches big movements.",
              )}
            </p>
          </>
        )}
        <Seg
          label={T("Format")}
          options={[
            ["png", "PNG"],
            ["jpg", "JPG"],
          ]}
          value={kind}
          onPick={setKind}
        />
        {kind === "jpg" && (
          <Slider
            label={T("Quality")}
            value={quality}
            min={40}
            max={100}
            onChange={setQuality}
            reset={90}
          />
        )}
        {!(mode !== "still" && sheet) && (
          <Seg
            label={T("Width")}
            options={[
              [0, T("Original")],
              [1280, "1280"],
              [640, "640"],
              [320, "320"],
            ]}
            value={width}
            onPick={setWidth}
          />
        )}
        {mode !== "still" && (
          <div className="ctl">
            <span className="lbl">{T("Output")}</span>
            <div className="seg" role="group" aria-label={T("Output")}>
              <button
                type="button"
                aria-pressed={!sheet}
                onClick={() => setSheet(false)}
              >
                {T("Images in a zip")}
              </button>
              <button
                type="button"
                aria-pressed={sheet}
                onClick={() => setSheet(true)}
              >
                {T("Contact sheet")}
              </button>
            </div>
          </div>
        )}
        {mode !== "still" && sheet && (
          <>
            <Seg
              label={T("Columns")}
              options={[3, 4, 5, 6].map(
                (c) => [c, String(c)] as [number, string],
              )}
              value={cols}
              onPick={setCols}
            />
            <Toggle
              label={T("Show the times")}
              on={labels}
              onChange={setLabels}
            />
          </>
        )}
      </aside>

      <div className="stage vt-stage">
        <div className="vt-stage-head">
          <span className="vt-name" title={file.name}>
            {file.name}
          </span>
        </div>
        <VideoPreview
          file={file}
          aspect={
            info?.video ? info.video.width / info.video.height : undefined
          }
          seek={seek}
          onTime={setTime}
          label={T("Original")}
        />
        {info?.video && (
          <div className="vt-under">
            <Timeline
              file={file}
              duration={D}
              single={mode === "still"}
              start={mode === "still" ? time : a}
              end={mode === "still" ? time : b}
              time={time}
              onSeek={(t) => setSeek((s) => ({ t, n: s.n + 1 }))}
              onChange={(x, y) => {
                if (mode === "still") setSeek((s) => ({ t: x, n: s.n + 1 }));
                else setRange([x, y]);
              }}
            />
          </div>
        )}
        {info?.video && mode !== "still" && (
          <FrameStrip
            file={file}
            times={planned.times}
            scanning={scan}
            onPick={(t) => setSeek((s) => ({ t, n: s.n + 1 }))}
          />
        )}
      </div>

      <aside className="controls side-r vt-out" aria-live="polite">
        <div className="ctl">
          <span className="lbl">{T("Output")}</span>
          {info?.video ? (
            <dl className="kv vt-plan">
              <div>
                <dt>{T("Images")}</dt>
                <dd className="vt-count">
                  {mode === "scenes" && scan !== null
                    ? "…"
                    : sheet && mode !== "still"
                      ? 1
                      : n}
                </dd>
              </div>
              {mode !== "still" && (
                <div>
                  <dt>{sheet ? T("Frames on the sheet") : T("Part")}</dt>
                  <dd>{sheet ? n : `${fmtTime(a)} – ${fmtTime(b)}`}</dd>
                </div>
              )}
              <div>
                <dt>{T("Format")}</dt>
                <dd>{kind.toUpperCase()}</dd>
              </div>
            </dl>
          ) : probeError ? null : info ? (
            <p className="muted vt-wait">
              {T("This file has no picture to save.")}
            </p>
          ) : (
            <p className="muted vt-wait">{T("Reading the video")}</p>
          )}
        </div>
        {probeError && (
          <p className="note warn" role="alert">
            {T("This file couldn't be read. It may be damaged or not a video.")}
          </p>
        )}
        {planned.over && (
          <p className="note warn vt-limit">
            {sheet && mode !== "still"
              ? T(
                  "A contact sheet holds up to {n} frames. Pick a longer interval or a shorter part.",
                  { n: SHEET_LIMIT },
                )
              : T(
                  "Only the first {n} frames are saved. Pick a longer interval or a shorter part.",
                  { n: LIMIT },
                )}
          </p>
        )}
        {mode === "scenes" &&
          scan === null &&
          scenes?.key === sceneKey &&
          n <= 1 && (
            <p className="note vt-hint">
              {T("No cuts found in this part. Try a higher sensitivity.")}
            </p>
          )}

        {busy ? (
          <div className="vt-progress" role="status">
            <div className="vt-pline">
              <span>{T(busy.stage)}</span>
              <b>{Math.round(busy.ratio * 100)}%</b>
            </div>
            <span className="mp-bar">
              <i style={{ width: `${Math.round(busy.ratio * 100)}%` }} />
            </span>
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
            disabled={!n || !info?.video || scan !== null}
            onClick={() => void save()}
          >
            {action}
          </button>
        )}
        {error && (
          <p className="note warn" role="alert">
            {T("The frames couldn't be saved.")}{" "}
            <span className="muted">{error}</span>
          </p>
        )}

        {result && (
          <div
            className="vt-result"
            data-count={result.files.length}
            data-bytes={total}
          >
            {result.files.length === 1 ? (
              <>
                <BlobImage
                  blob={result.files[0]!.blob}
                  alt={result.files[0]!.name}
                  className="vt-still"
                />
                <p className="muted vt-outinfo">
                  {result.files[0]!.name} · {formatBytes(total)}
                </p>
                <button
                  type="button"
                  className="btn primary vt-download"
                  onClick={() =>
                    downloadBlob(result.files[0]!.blob, result.files[0]!.name)
                  }
                >
                  <Icon name="download" />
                  {T("Download {ext}", { ext: kind.toUpperCase() })}
                </button>
              </>
            ) : (
              <>
                <p className="vt-outinfo">
                  <b>{T("{n} images", { n: result.files.length })}</b>
                  <span className="muted"> · {formatBytes(total)}</span>
                </p>
                <button
                  type="button"
                  className="btn primary vt-zip"
                  onClick={() =>
                    void downloadZip(
                      result.files,
                      `${baseName(file.name)}-extract-frames.zip`,
                    )
                  }
                >
                  <Icon name="download" />
                  {T("Download all ({n}) as zip", { n: result.files.length })}
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() =>
                    result.files.forEach((f, i) =>
                      setTimeout(() => downloadBlob(f.blob, f.name), i * 600),
                    )
                  }
                >
                  {T("Download each file")}
                </button>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

/** Thumbnails of the frames that will be saved (the first few dozen), with their times */
function FrameStrip({
  file,
  times,
  scanning,
  onPick,
}: {
  file: File;
  times: number[];
  scanning: number | null;
  onPick: (t: number) => void;
}) {
  const T = useT();
  const shown = times.slice(0, STRIP);
  const sig = shown.map((t) => t.toFixed(3)).join(",");
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  useEffect(() => {
    if (!shown.length) return;
    const ac = new AbortController();
    const timer = setTimeout(() => {
      void thumbnails(file, {
        count: shown.length,
        times: shown,
        height: 120,
        signal: ac.signal,
        onThumb: (i, bmp) => {
          const c = refs.current[i];
          if (!c || ac.signal.aborted) return bmp.close();
          c.width = bmp.width;
          c.height = bmp.height;
          c.getContext("2d")!.drawImage(bmp, 0, 0);
          bmp.close();
        },
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, sig]);

  if (scanning !== null)
    return (
      <div className="vt-strip-wait" role="status">
        <span>
          {T("Finding scene changes")} {Math.round(scanning * 100)}%
        </span>
        <span className="mp-bar">
          <i style={{ width: `${Math.round(scanning * 100)}%` }} />
        </span>
      </div>
    );
  if (!times.length) return null;
  return (
    <div className="vt-strip">
      <span className="lbl">
        {T("Frames to save")}
        <span>{times.length}</span>
      </span>
      <ol>
        {shown.map((t, i) => (
          <li key={`${i}-${t}`}>
            <button
              type="button"
              onClick={() => onPick(t)}
              aria-label={T("Go to {t}", { t: fmtTime(t) })}
            >
              <canvas ref={(el) => void (refs.current[i] = el)} />
              <span>{fmtTime(t)}</span>
            </button>
          </li>
        ))}
        {times.length > shown.length && (
          <li className="more">
            {T("+ {n} more", { n: times.length - shown.length })}
          </li>
        )}
      </ol>
    </div>
  );
}

/**
 * All frames on one picture: a title line (name, length, size, count), then a grid of the frames
 * with their times. Built on a canvas on this device.
 */
async function contactSheet(
  file: File,
  info: MediaInfo,
  times: number[],
  o: {
    cols: number;
    labels: boolean;
    type: string;
    quality: number;
    title: string;
    subtitle: string;
    signal: AbortSignal;
    onProgress: (p: Progress) => void;
  },
): Promise<Blob> {
  const v = info.video!;
  const tileW =
    o.cols <= 3 ? 480 : o.cols === 4 ? 400 : o.cols === 5 ? 340 : 300;
  const tileH = Math.round((tileW * v.height) / v.width);
  const gap = 10;
  const pad = 24;
  const head = 64;
  const cols = Math.min(o.cols, times.length);
  const rows = Math.ceil(times.length / o.cols);
  const W = pad * 2 + cols * tileW + (cols - 1) * gap;
  const H = pad * 2 + head + rows * tileH + (rows - 1) * gap;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const font = '"Geist Variable", "Geist", system-ui, sans-serif';
  ctx.fillStyle = "#18181b";
  ctx.font = `600 22px ${font}`;
  ctx.textBaseline = "top";
  ctx.fillText(o.title, pad, pad, W - pad * 2);
  ctx.fillStyle = "#71717a";
  ctx.font = `400 16px ${font}`;
  ctx.fillText(o.subtitle, pad, pad + 32, W - pad * 2);
  const jobs: Promise<void>[] = [];
  await frames(file, times, {
    width: tileW * 2 <= v.width ? tileW * 2 : undefined,
    type: "image/png",
    signal: o.signal,
    onProgress: (p) => o.onProgress({ ...p, ratio: p.ratio * 0.95 }),
    onFrame: (i, blob, t) =>
      jobs.push(
        createImageBitmap(blob).then((bmp) => {
          const x = pad + (i % o.cols) * (tileW + gap);
          const y = pad + head + Math.floor(i / o.cols) * (tileH + gap);
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(bmp, x, y, tileW, tileH);
          bmp.close();
          if (!o.labels) return;
          const text = fmtTime(t);
          ctx.font = `500 14px ${font}`;
          const tw = ctx.measureText(text).width;
          ctx.fillStyle = "rgb(0 0 0 / 0.66)";
          ctx.beginPath();
          ctx.roundRect(x + 8, y + tileH - 30, tw + 14, 22, 6);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.textBaseline = "middle";
          ctx.fillText(text, x + 15, y + tileH - 19);
          ctx.textBaseline = "top";
        }),
      ),
  });
  await Promise.all(jobs);
  return new Promise((ok, bad) =>
    canvas.toBlob(
      (b) => (b ? ok(b) : bad(new Error("The sheet is too large"))),
      o.type,
      o.quality,
    ),
  );
}
