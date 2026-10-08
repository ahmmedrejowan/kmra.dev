import { useEffect, useMemo, useRef, useState } from "react";
import { getApp, type Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import {
  CopyBtn,
  DropCard,
  FileInput,
  useFiles,
} from "@kmra/ui/components/kit";
import { downloadBlob, IMAGE_ACCEPT, isImageFile } from "@kmra/ui/lib/files";
import { stashFiles } from "@kmra/ui/lib/handoff";
import { toast } from "@kmra/ui/lib/toast";
import { useLp, useT } from "@kmra/ui/lib/i18n-react";
import type { EngineId, OcrResult } from "../lib/ocr/types";
import {
  cachedLangs,
  chooseEngine,
  effectiveEngine,
  missingLangs,
  recognize,
} from "../lib/ocr";
import { FORMAT_EXT, formatResult, type OutputFormat } from "../lib/ocr/format";
import { getLanguage } from "../lib/ocr/languages";
import {
  EngineBar,
  LangPicker,
  useLangName,
  useOcrSettings,
  useStageText,
} from "./OcrSettings";

/**
 * Image to text: the picture on the left (zoomable, line boxes on top, unsure words tinted),
 * the editable text on the right, settings in the bar above. Hover a line on the picture to see it
 * in the text; click it to select it. Moving the cursor in the text marks its line on the picture.
 */

const isPdf = (f: File) =>
  f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const accept = (f: File) => isImageFile(f) || isPdf(f);
/** Words below this confidence are tinted on the picture */
const UNSURE = 60;
const ZOOMS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];

const toolReady = (slug: string) =>
  getApp("ocrtool").tools.some((t) => t.slug === slug && t.ready);

export default function ImageToText({ preset }: { preset?: Preset }) {
  const T = useT();
  const L = useLp();
  const name = useLangName();
  const stageText = useStageText();
  const settings = useOcrSettings(preset);
  const { langs, setLangs, recent, engine, setEngine } = settings;

  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [autoEngine, setAutoEngine] = useState<EngineId | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [run, setRun] = useState<{
    p: number;
    status: string;
    missing: string[];
  } | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState<{
    files: File[];
    kind: "pdf" | "many";
  } | null>(null);
  const [cached, setCached] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<OutputFormat>("text");
  const [edits, setEdits] = useState<Partial<Record<OutputFormat, string>>>({});
  const [hover, setHover] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);

  const refreshCached = () => void cachedLangs().then(setCached);
  useEffect(refreshCached, []);

  const { dragging, pickRef, pick, take } = useFiles({
    accept,
    reject: T("That isn't an image. Try JPEG, PNG, WebP, GIF or AVIF."),
    onFiles(files) {
      const images = files.filter(isImageFile);
      const pdfs = files.filter(isPdf);
      if (!images.length) {
        setNote({ files: pdfs, kind: "pdf" });
        return;
      }
      setNote(images.length > 1 ? { files: images, kind: "many" } : null);
      open(images[0]!);
    },
  });

  function open(f: File) {
    setFile(f);
    setResult(null);
    setEdits({});
    setError("");
    setActive(null);
    setAutoEngine(null);
    setSize(null);
    setUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
    void chooseEngine(f).then(setAutoEngine);
  }
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  async function pasteImage() {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await it.getType(type);
          take([
            new File([blob], `pasted.${type.split("/")[1] ?? "png"}`, { type }),
          ]);
          return;
        }
      }
      toast(T("There's no image on the clipboard."));
    } catch {
      toast(T("Couldn't read the clipboard. Paste with Ctrl+V or ⌘V."));
    }
  }

  // Read the file whenever it or the settings change
  const chosen: EngineId =
    engine === "auto" ? (autoEngine ?? "document") : engine;
  const used = effectiveEngine(chosen, langs);
  const waitingForAuto = engine === "auto" && !autoEngine;
  const langKey = langs.join("+");
  useEffect(() => {
    if (!file || waitingForAuto) return;
    const ctl = new AbortController();
    let missing: string[] = [];
    setError("");
    setRun({ p: 0, status: "Loading engine", missing });
    void (async () => {
      try {
        missing = await missingLangs(langs);
        const r = await recognize(file, {
          engine: used,
          langs,
          signal: ctl.signal,
          onProgress: (p, status) => setRun({ p, status, missing }),
        });
        if (ctl.signal.aborted) return;
        setResult(r);
        setEdits({});
        setActive(null);
        setRun(null);
        if (missing.length) refreshCached();
      } catch (err) {
        if (ctl.signal.aborted) return;
        console.error(err);
        setRun(null);
        setError(
          /decode|source image|InvalidStateError/i.test(String(err))
            ? T("This image can't be opened here. Try JPEG, PNG or WebP.")
            : T(
                "Couldn't read the text. Check your connection for the first download, then try again.",
              ),
        );
      }
    })();
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, used, langKey, waitingForAuto]);

  const base = file ? file.name.replace(/\.[^.]+$/, "") || "image" : "image";
  const formatted = useMemo(
    () => (result ? formatResult(result, format, file?.name) : null),
    [result, format, file],
  );
  const value = edits[format] ?? formatted?.text ?? "";
  const mapped =
    formatted?.ranges && value === formatted.text ? formatted.ranges : null;
  const rtl =
    langs.every((c) => getLanguage(c)?.rtl) &&
    format !== "json" &&
    format !== "hocr";

  function download() {
    const [ext, mime] = FORMAT_EXT[format];
    downloadBlob(
      new Blob([value], { type: `${mime};charset=utf-8` }),
      `${base}.${ext}`,
    );
  }

  async function handOff(files: File[], to: string) {
    await stashFiles(files);
    window.location.href = L(to);
  }

  const bar = (
    <div className="dev-bar">
      <LangPicker
        value={langs}
        onChange={setLangs}
        recent={recent}
        cached={cached}
      />
      <EngineBar
        value={engine}
        onPick={setEngine}
        auto={file ? autoEngine : null}
      />
      <div className="bar-item">
        <span className="bar-label">{T("Output")}</span>
        <div className="seg sm" role="group" aria-label={T("Output")}>
          {(
            [
              ["text", T("Text")],
              ["paragraphs", T("Paragraphs")],
              ["json", "JSON"],
              ["hocr", "hOCR"],
            ] as [OutputFormat, string][]
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={v === format}
              onClick={() => setFormat(v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {file && (
        <div className="bar-item bar-push">
          <button type="button" className="btn xs" onClick={pick}>
            <Icon name="upload" />
            {T("Open another image")}
          </button>
        </div>
      )}
    </div>
  );

  const noteBox = note && (
    <div className="oi-note" role="status">
      <Icon name="info" />
      {note.kind === "many" ? (
        <>
          <span>
            {T(
              "{n} images dropped. This tool reads one at a time; Batch OCR reads them all.",
              {
                n: note.files.length,
              },
            )}
          </span>
          <button
            type="button"
            className="btn xs"
            onClick={() => void handOff(note.files, "/batch-ocr")}
          >
            {T("Open them in Batch OCR")}
          </button>
        </>
      ) : toolReady("pdf-to-text") ? (
        <>
          <span>{T("That's a PDF. PDF to text reads every page of it.")}</span>
          <button
            type="button"
            className="btn xs"
            onClick={() => void handOff(note.files.slice(0, 1), "/pdf-to-text")}
          >
            {T("Open in PDF to text")}
          </button>
        </>
      ) : (
        <span>
          {T(
            "That's a PDF. This tool reads images: JPEG, PNG, WebP, GIF or AVIF.",
          )}
        </span>
      )}
      <button
        type="button"
        className="btn xs oi-note-x"
        aria-label={T("Close")}
        onClick={() => setNote(null)}
      >
        <Icon name="x" />
      </button>
    </div>
  );

  return (
    <div className="devcard oi-card">
      <FileInput
        inputRef={pickRef}
        onFiles={take}
        multiple
        accept={`${IMAGE_ACCEPT},application/pdf,.pdf`}
      />
      {bar}
      {noteBox}
      {!file ? (
        <div className="oi-empty">
          <DropCard
            title={T("Drop an image, screenshot or scan")}
            button={T("Choose an image")}
            formats={["JPG", "PNG", "WebP", "GIF", "AVIF"]}
            dragging={dragging}
            onPick={pick}
          >
            <button
              type="button"
              className="btn sm oi-paste"
              onClick={(e) => {
                e.stopPropagation();
                void pasteImage();
              }}
            >
              <Icon name="copy" />
              {T("Paste an image")}
            </button>
          </DropCard>
        </div>
      ) : (
        <>
          <div className="dev-panes c2 oi-panes">
            <Viewer
              url={url}
              name={file.name}
              result={result}
              hover={hover}
              active={active}
              size={size}
              onSize={setSize}
              onHover={setHover}
              onPick={(i) => {
                setActive(i);
                selectLine(i);
              }}
              busy={run ? stageText(run.status, run.p, run.missing) : null}
              progress={run?.p ?? 0}
              error={error}
            />
            <TextPane
              value={value}
              rtl={rtl}
              ranges={mapped}
              mark={hover ?? active}
              readOnly={!result}
              placeholder={run ? T("The text appears here.") : ""}
              onChange={(v) => setEdits({ ...edits, [format]: v })}
              onCaret={(pos) => {
                if (!mapped) return setActive(null);
                const i = mapped.findIndex(
                  (r) => r && pos >= r[0] && pos <= r[1],
                );
                setActive(i >= 0 ? i : null);
              }}
              actions={
                result ? (
                  <>
                    {edits[format] !== undefined && (
                      <button
                        type="button"
                        className="btn xs"
                        onClick={() => {
                          const { [format]: _, ...rest } = edits;
                          setEdits(rest);
                        }}
                      >
                        {T("Undo edits")}
                      </button>
                    )}
                    <CopyBtn text={value} className="btn xs" />
                    <button
                      type="button"
                      className="btn xs acc"
                      onClick={download}
                    >
                      <Icon name="download" />
                      {T("Download {ext}", {
                        ext: `.${FORMAT_EXT[format][0]}`,
                      })}
                    </button>
                  </>
                ) : null
              }
            />
          </div>
          <div className="dev-status" aria-live="polite">
            {result ? (
              <>
                <span>
                  {result.engine === "photo"
                    ? T("Read with the photo engine")
                    : T("Read with the document engine")}
                </span>
                <span>{result.langs.map(name).join(", ")}</span>
                <span>{T("{n} lines", { n: result.lines.length })}</span>
                <span>{T("{n} characters", { n: value.length })}</span>
                <span>
                  {T("Confidence {n}%", { n: Math.round(result.confidence) })}
                </span>
                <span>{T("{s} s", { s: (result.ms / 1000).toFixed(1) })}</span>
                {result.lines.some((l) =>
                  l.words.some((w) => w.confidence < UNSURE),
                ) && (
                  <span className="oi-legend">
                    <i aria-hidden="true" />
                    {T("Tinted words may be wrong")}
                  </span>
                )}
                {chosen === "photo" && result.engine === "document" && (
                  <span>
                    {T(
                      "The photo engine doesn't read these languages yet, so the document engine was used.",
                    )}
                  </span>
                )}
                {!result.lines.length && (
                  <span>{T("No text found in this image.")}</span>
                )}
              </>
            ) : run ? (
              <span>{stageText(run.status, run.p, run.missing)}</span>
            ) : (
              <span>{error || T("Everything runs on your device.")}</span>
            )}
          </div>
        </>
      )}
    </div>
  );

  function selectLine(i: number) {
    const r = mapped?.[i];
    if (!r) return;
    const ta = document.querySelector<HTMLTextAreaElement>(".oi-text textarea");
    if (!ta) return;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(r[0], r[1]);
    requestAnimationFrame(() =>
      document
        .querySelector(".oi-hl mark")
        ?.scrollIntoView({ block: "nearest" }),
    );
  }
}

/* ---------- The picture with its boxes ---------- */

function Viewer({
  url,
  name,
  result,
  hover,
  active,
  size,
  onSize,
  onHover,
  onPick,
  busy,
  progress,
  error,
}: {
  url: string;
  name: string;
  result: OcrResult | null;
  hover: number | null;
  active: number | null;
  size: { w: number; h: number } | null;
  onSize: (s: { w: number; h: number }) => void;
  onHover: (i: number | null) => void;
  onPick: (i: number) => void;
  busy: string | null;
  progress: number;
  error: string;
}) {
  const T = useT();
  const scroll = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fit, setFit] = useState(1);
  const z = zoom === "fit" ? fit : zoom;

  // The picture area is as tall as the picture at full width (within the screen), so a wide
  // picture leaves no empty band; Fit shows the whole picture (small ones up to 2×).
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = scroll.current;
    if (!el || !size) return;
    const measure = () => {
      const w = el.clientWidth - 32;
      const max = Math.min(820, Math.max(420, window.innerHeight - 230));
      const h = Math.round(
        Math.max(320, Math.min(max, size.h * Math.min(2, w / size.w) + 32)),
      );
      setHeight(h);
      setFit(Math.min(2, w / size.w, (h - 32) / size.h) || 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [size]);
  useEffect(() => setZoom("fit"), [url]);

  // Ctrl/⌘ + wheel or pinch zooms
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((cur) => {
        const now = cur === "fit" ? fit : cur;
        return Math.min(4, Math.max(0.1, now * Math.exp(-e.deltaY / 300)));
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [fit]);

  // Keep the marked line in view when it's picked from the text
  useEffect(() => {
    if (active === null) return;
    scroll.current
      ?.querySelector(`[data-line="${active}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const step = (dir: 1 | -1) => {
    const list = dir > 0 ? ZOOMS : [...ZOOMS].reverse();
    setZoom(
      list.find((v) => (dir > 0 ? v > z + 0.001 : v < z - 0.001)) ??
        (dir > 0 ? 4 : 0.1),
    );
  };

  return (
    <section className="pane oi-view">
      <header className="pane-head">
        <span className="pane-label oi-fname" title={name}>
          {name}
        </span>
        <span className="pane-acts oi-zoom" role="group" aria-label={T("Zoom")}>
          <button
            type="button"
            className="btn xs"
            aria-label={T("Zoom out")}
            onClick={() => step(-1)}
          >
            <Icon name="minus" />
          </button>
          <span className="oi-zl">{Math.round(z * 100)}%</span>
          <button
            type="button"
            className="btn xs"
            aria-label={T("Zoom in")}
            onClick={() => step(1)}
          >
            <Icon name="plus" />
          </button>
          <button
            type="button"
            className="btn xs"
            aria-pressed={zoom === "fit"}
            onClick={() => setZoom("fit")}
          >
            {T("Fit")}
          </button>
        </span>
      </header>
      <div
        className="oi-scroll"
        ref={scroll}
        style={height ? { height } : undefined}
      >
        <div
          className="oi-canvas"
          style={size ? { width: size.w * z, height: size.h * z } : undefined}
        >
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) =>
              onSize({
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight,
              })
            }
          />
          {result && (
            <svg
              viewBox={`0 0 ${result.width} ${result.height}`}
              preserveAspectRatio="none"
              onMouseLeave={() => onHover(null)}
            >
              {result.lines.map((l, i) => (
                <g key={i}>
                  {l.words
                    .filter((w) => w.confidence < UNSURE)
                    .map((w, j) => (
                      <rect
                        key={j}
                        className="oi-unsure"
                        x={w.box.x}
                        y={w.box.y}
                        width={w.box.w}
                        height={w.box.h}
                      />
                    ))}
                  <rect
                    data-line={i}
                    className={`oi-line${i === hover || i === active ? " on" : ""}`}
                    x={l.box.x - 2}
                    y={l.box.y - 2}
                    width={l.box.w + 4}
                    height={l.box.h + 4}
                    rx={3}
                    vectorEffect="non-scaling-stroke"
                    onMouseEnter={() => onHover(i)}
                    onClick={() => onPick(i)}
                  >
                    <title>{l.text}</title>
                  </rect>
                </g>
              ))}
            </svg>
          )}
        </div>
        {busy && (
          <div className="oi-busy" role="status">
            <span>{busy}</span>
            <span className="oi-bar">
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </span>
          </div>
        )}
        {error && !busy && (
          <div className="oi-busy bad" role="alert">
            <span>{error}</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- The text, with the hovered line marked ---------- */

function TextPane({
  value,
  rtl,
  ranges,
  mark,
  readOnly,
  placeholder,
  onChange,
  onCaret,
  actions,
}: {
  value: string;
  rtl: boolean;
  ranges: ([number, number] | null)[] | null;
  mark: number | null;
  readOnly: boolean;
  placeholder: string;
  onChange: (v: string) => void;
  onCaret: (pos: number) => void;
  actions: React.ReactNode;
}) {
  const T = useT();
  const r = mark !== null ? ranges?.[mark] : null;
  return (
    <section className="pane">
      <header className="pane-head">
        <span className="pane-label">{T("Text")}</span>
        <span className="pane-acts">{actions}</span>
      </header>
      <div className="oi-text" dir={rtl ? "rtl" : undefined}>
        <div className="oi-stack">
          <div className="oi-hl" aria-hidden="true">
            {r ? (
              <>
                {value.slice(0, r[0])}
                <mark>{value.slice(r[0], r[1])}</mark>
                {value.slice(r[1])}
              </>
            ) : (
              value
            )}
            {"\n "}
          </div>
          <textarea
            value={value}
            readOnly={readOnly}
            placeholder={placeholder}
            spellCheck={false}
            aria-label={T("Recognized text")}
            onChange={(e) => onChange(e.target.value)}
            onSelect={(e) => onCaret(e.currentTarget.selectionStart)}
          />
        </div>
      </div>
    </section>
  );
}
