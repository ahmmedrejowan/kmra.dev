import { useEffect, useRef, useState } from "react";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import {
  CopyBtn,
  DropCard,
  FileInput,
  downloadZip,
  useFiles,
} from "@kmra/ui/components/kit";
import {
  downloadBlob,
  formatBytes,
  IMAGE_ACCEPT,
  isImageFile,
  toolName,
} from "@kmra/ui/lib/files";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { EngineId } from "../lib/ocr/types";
import {
  cachedLangs,
  chooseEngine,
  effectiveEngine,
  missingLangs,
  recognize,
} from "../lib/ocr";
import { getLanguage } from "../lib/ocr/languages";
import {
  EngineBar,
  LangPicker,
  useLangName,
  useOcrSettings,
  useStageText,
} from "./OcrSettings";

/**
 * Batch OCR: many images (and PDFs, page by page) read one after another, with a row per file
 * (status, language, confidence, characters, a preview) and downloads: a zip of .txt files, or one
 * combined .txt or .md with a heading per file.
 */

const isPdf = (f: File) =>
  f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const accept = (f: File) => isImageFile(f) || isPdf(f);

interface Item {
  id: number;
  file: File;
  thumb: string;
  state: "waiting" | "reading" | "done" | "failed";
  p: number;
  status: string;
  missing: string[];
  text: string;
  langs: string[];
  engine: EngineId | null;
  /** Mean confidence of the OCR'd parts; null when all text came from a PDF text layer */
  confidence: number | null;
  pages?: number;
  /** PDF pages whose text came from the text layer */
  layer?: number;
  error?: string;
}

let nextId = 1;

export default function BatchOcr({ preset }: { preset?: Preset }) {
  const T = useT();
  const name = useLangName();
  const stageText = useStageText();
  const { langs, setLangs, recent, engine, setEngine } = useOcrSettings(preset);
  const [items, setItems] = useState<Item[]>([]);
  const [cached, setCached] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const busy = useRef<number | null>(null);
  const ctl = useRef<AbortController | null>(null);
  /** Set by Stop: the aborted file is marked stopped instead of going back in the queue */
  const stopping = useRef(false);
  const settings = useRef({ langs, engine });
  settings.current = { langs, engine };

  useEffect(() => void cachedLangs().then(setCached), []);

  const { dragging, pickRef, pick, take } = useFiles({
    accept,
    reject: T("Those aren't images or PDFs. Try JPEG, PNG, WebP or PDF."),
    onFiles(files) {
      setItems((cur) => [
        ...cur,
        ...files.map<Item>((file) => ({
          id: nextId++,
          file,
          thumb: isPdf(file) ? "" : URL.createObjectURL(file),
          state: "waiting",
          p: 0,
          status: "",
          missing: [],
          text: "",
          langs: [],
          engine: null,
          confidence: null,
        })),
      ]);
    },
  });

  const patch = (id: number, p: Partial<Item>) =>
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...p } : it)));

  // One file at a time: whenever nothing is running, start the next waiting one
  useEffect(() => {
    if (busy.current !== null) return;
    const next = items.find((it) => it.state === "waiting");
    if (!next) return;
    busy.current = next.id;
    const c = new AbortController();
    ctl.current = c;
    void readItem(next, c.signal).finally(() => {
      busy.current = null;
      ctl.current = null;
      // Trigger the effect again for the next file
      setItems((cur) => [...cur]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Thumbnails are object URLs: free them with the list
  const thumbs = useRef(new Set<string>());
  useEffect(() => {
    for (const it of items) if (it.thumb) thumbs.current.add(it.thumb);
  }, [items]);
  useEffect(
    () => () => {
      ctl.current?.abort();
      for (const u of thumbs.current) URL.revokeObjectURL(u);
    },
    [],
  );

  async function readItem(it: Item, signal: AbortSignal) {
    const { langs, engine } = settings.current;
    let missing = await missingLangs(langs);
    patch(it.id, {
      state: "reading",
      p: 0,
      status: "Loading engine",
      missing,
      error: undefined,
    });
    try {
      let out: {
        text: string;
        engine: EngineId;
        confidence: number | null;
        pages?: number;
        layer?: number;
      };
      if (isPdf(it.file))
        out = await readPdf(it, langs, engine, signal, (p, status) =>
          patch(it.id, { p, status, missing }),
        );
      else {
        const chosen = engine === "auto" ? await chooseEngine(it.file) : engine;
        const r = await recognize(it.file, {
          engine: effectiveEngine(chosen, langs),
          langs,
          signal,
          onProgress: (p, status) => patch(it.id, { p, status, missing }),
        });
        out = {
          text: r.text,
          engine: r.engine,
          confidence: r.lines.length ? Math.round(r.confidence) : null,
        };
      }
      if (signal.aborted) return;
      if (missing.length) {
        missing = [];
        void cachedLangs().then(setCached);
      }
      patch(it.id, { state: "done", p: 1, langs, ...out });
    } catch (err) {
      if (signal.aborted) {
        patch(
          it.id,
          stopping.current
            ? { state: "failed", error: T("Stopped") }
            : { state: "waiting", p: 0, status: "" },
        );
        stopping.current = false;
        return;
      }
      console.error(err);
      patch(it.id, {
        state: "failed",
        error: /password/i.test(String(err))
          ? T(
              "This PDF is password-protected. Remove the password in the app that made it, then try again.",
            )
          : /decode|source image|InvalidStateError/i.test(String(err))
            ? T("This image can't be opened here. Try JPEG, PNG or WebP.")
            : T("Couldn't read the text."),
      });
    }
  }

  const done = items.filter((it) => it.state === "done");
  const reading = items.find((it) => it.state === "reading");
  const waiting = items.filter((it) => it.state === "waiting").length;
  /** "scan.png" → "scan-batch-ocr.txt"; the zip numbers files with the same name (-2, -3) */
  const txtName = (f: File) => `${toolName(f.name, "batch-ocr")}.txt`;
  function combined(md: boolean) {
    return (
      done
        .map((it) =>
          md
            ? `## ${it.file.name}\n\n${it.text}`
            : `===== ${it.file.name} =====\n\n${it.text}`,
        )
        .join("\n\n") + "\n"
    );
  }

  function restart() {
    ctl.current?.abort();
    setItems((cur) =>
      cur.map((it) => ({
        ...it,
        state: "waiting",
        p: 0,
        status: "",
        text: "",
        error: undefined,
      })),
    );
  }
  function stop() {
    stopping.current = ctl.current !== null;
    setItems((cur) =>
      cur.map((it) =>
        it.state === "waiting"
          ? { ...it, state: "failed", error: T("Stopped") }
          : it,
      ),
    );
    ctl.current?.abort();
  }
  /** Put a stopped or failed file back in the queue */
  function retry(id: number) {
    patch(id, { state: "waiting", p: 0, status: "", error: undefined });
  }
  function remove(id: number) {
    if (busy.current === id) ctl.current?.abort();
    setItems((cur) => cur.filter((it) => it.id !== id));
  }
  function clear() {
    ctl.current?.abort();
    setItems([]);
    setOpen(null);
  }

  const settingsKey = `${engine}:${langs.join("+")}`;
  const ranWith = useRef(settingsKey);
  const stale = done.length > 0 && ranWith.current !== settingsKey;
  useEffect(() => {
    if (!items.length) ranWith.current = settingsKey;
  }, [items.length, settingsKey]);

  return (
    <div className="devcard oi-card">
      <FileInput
        inputRef={pickRef}
        onFiles={take}
        accept={`${IMAGE_ACCEPT},application/pdf,.pdf`}
      />
      <div className="dev-bar">
        <LangPicker
          value={langs}
          onChange={setLangs}
          recent={recent}
          cached={cached}
        />
        <EngineBar value={engine} onPick={setEngine} />
        {items.length > 0 && (
          <div className="bar-item bar-push">
            <button type="button" className="btn xs" onClick={pick}>
              <Icon name="plus" />
              {T("Add files")}
            </button>
            {(reading || waiting > 0) && (
              <button type="button" className="btn xs" onClick={stop}>
                {T("Stop")}
              </button>
            )}
            <button type="button" className="btn xs" onClick={clear}>
              <Icon name="trash" />
              {T("Clear")}
            </button>
          </div>
        )}
      </div>
      {stale && (
        <div className="oi-note" role="status">
          <Icon name="info" />
          <span>
            {T(
              "Settings changed. New files use them; read the others again to update them.",
            )}
          </span>
          <button
            type="button"
            className="btn xs"
            onClick={() => {
              ranWith.current = settingsKey;
              restart();
            }}
          >
            {T("Read all again")}
          </button>
        </div>
      )}
      {!items.length ? (
        <div className="oi-empty">
          <DropCard
            title={T("Drop images or PDFs")}
            button={T("Choose files")}
            formats={["JPG", "PNG", "WebP", "GIF", "AVIF", "PDF"]}
            dragging={dragging}
            onPick={pick}
          />
        </div>
      ) : (
        <>
          <ul className="oi-rows">
            {items.map((it) => {
              const expanded = open === it.id && it.state === "done";
              return (
                <li
                  key={it.id}
                  className={`oi-row ${it.state}${expanded ? " open" : ""}`}
                >
                  <div className="oi-row-main">
                    <span className="oi-thumb" aria-hidden="true">
                      {it.thumb ? (
                        <img src={it.thumb} alt="" />
                      ) : (
                        <Icon name="file" />
                      )}
                    </span>
                    <span className="oi-row-name">
                      <strong title={it.file.name}>{it.file.name}</strong>
                      <span className="muted">
                        {formatBytes(it.file.size)}
                        {it.pages
                          ? ` · ${T("{n} pages", { n: it.pages })}`
                          : ""}
                      </span>
                    </span>
                    <span className="oi-row-state">
                      {it.state === "reading" ? (
                        <>
                          <span className="oi-row-status">
                            {stageText(it.status, it.p, it.missing)}
                          </span>
                          <span className="oi-bar">
                            <i
                              style={{ width: `${Math.round(it.p * 100)}%` }}
                            />
                          </span>
                        </>
                      ) : it.state === "waiting" ? (
                        <span className="muted">{T("Waiting")}</span>
                      ) : it.state === "failed" ? (
                        <span className="oi-bad">{it.error}</span>
                      ) : (
                        <span className="oi-stats">
                          <span>{it.langs.map(name).join(", ")}</span>
                          <span>
                            {!it.text.trim()
                              ? T("No text found")
                              : it.confidence === null
                                ? it.layer
                                  ? T("Text layer")
                                  : T("No text found")
                                : T("Confidence {n}%", { n: it.confidence })}
                          </span>
                          <span>
                            {T("{n} characters", { n: it.text.length })}
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="oi-row-acts">
                      {it.state === "done" && (
                        <>
                          <button
                            type="button"
                            className="btn xs"
                            aria-expanded={expanded}
                            onClick={() => setOpen(expanded ? null : it.id)}
                          >
                            {expanded ? T("Hide text") : T("Show text")}
                          </button>
                          <CopyBtn text={it.text} className="btn xs" />
                          <button
                            type="button"
                            className="btn xs"
                            aria-label={T("Download {name}", {
                              name: txtName(it.file),
                            })}
                            onClick={() =>
                              downloadBlob(
                                new Blob([it.text], {
                                  type: "text/plain;charset=utf-8",
                                }),
                                txtName(it.file),
                              )
                            }
                          >
                            <Icon name="download" />
                          </button>
                        </>
                      )}
                      {it.state === "failed" && (
                        <button
                          type="button"
                          className="btn xs"
                          aria-label={T("Retry {name}", { name: it.file.name })}
                          onClick={() => retry(it.id)}
                        >
                          <Icon name="rotate" />
                          {T("Retry")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn xs"
                        aria-label={T("Remove {name}", { name: it.file.name })}
                        onClick={() => remove(it.id)}
                      >
                        <Icon name="x" />
                      </button>
                    </span>
                  </div>
                  {it.state === "done" && !expanded && it.text && (
                    <p className="oi-preview" dir="auto">
                      {it.text.replace(/\s+/g, " ").slice(0, 220)}
                    </p>
                  )}
                  {expanded && (
                    <textarea
                      className="oi-full"
                      readOnly
                      value={it.text}
                      dir={
                        it.langs.every((c) => getLanguage(c)?.rtl)
                          ? "rtl"
                          : undefined
                      }
                      aria-label={T("Text of {name}", { name: it.file.name })}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <div className="dev-status oi-batch-foot" aria-live="polite">
            <span>
              {T("{n} of {t} read", { n: done.length, t: items.length })}
              {reading ? ` · ${reading.file.name}` : ""}
            </span>
            {done.length > 0 && (
              <span className="oi-dl">
                <button
                  type="button"
                  className="btn xs acc"
                  onClick={() =>
                    void downloadZip(
                      done.map((it) => ({
                        name: txtName(it.file),
                        blob: new Blob([it.text], { type: "text/plain" }),
                      })),
                      "text-batch-ocr.zip",
                    )
                  }
                >
                  <Icon name="download" />
                  {T("Zip of .txt files")}
                </button>
                <button
                  type="button"
                  className="btn xs"
                  onClick={() =>
                    downloadBlob(
                      new Blob([combined(false)], {
                        type: "text/plain;charset=utf-8",
                      }),
                      "text-batch-ocr.txt",
                    )
                  }
                >
                  {T("One .txt")}
                </button>
                <button
                  type="button"
                  className="btn xs"
                  onClick={() =>
                    downloadBlob(
                      new Blob([combined(true)], {
                        type: "text/markdown;charset=utf-8",
                      }),
                      "text-batch-ocr.md",
                    )
                  }
                >
                  {T("One .md")}
                </button>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * A PDF in the batch: pages with a real text layer are copied as they are, the others are drawn
 * at OCR resolution and read. Uses the PDF tools' pdf.js helpers (loaded only for PDFs).
 */
async function readPdf(
  it: Item,
  langs: string[],
  engine: "auto" | EngineId,
  signal: AbortSignal,
  onProgress: (p: number, status: string) => void,
) {
  const pdf = await import("../lib/pdf");
  const doc = await pdf.openPdf(new Uint8Array(await it.file.arrayBuffer()));
  try {
    const n = doc.numPages;
    const parts: string[] = [];
    const confs: number[] = [];
    let layer = 0;
    let used: EngineId = "document";
    for (let i = 1; i <= n; i++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const real = await pdf.realText(doc, i);
      if (real !== null) {
        parts.push(real);
        layer++;
        onProgress(i / n, "Reading text");
        continue;
      }
      const canvas = await pdf.renderPage(doc, i, pdf.OCR_DPI);
      // Scanned pages are documents; Auto keeps the document engine for PDFs
      const r = await recognize(canvas, {
        engine: effectiveEngine(engine === "auto" ? "document" : engine, langs),
        langs,
        signal,
        onProgress: (p, s) => onProgress((i - 1 + p) / n, s),
      });
      canvas.width = canvas.height = 0;
      used = r.engine;
      parts.push(r.text);
      if (r.lines.length) confs.push(r.confidence);
    }
    return {
      text: parts.join("\n\n"),
      engine: used,
      confidence: confs.length
        ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length)
        : null,
      pages: n,
      layer,
    };
  } finally {
    void doc.loadingTask.destroy();
  }
}
