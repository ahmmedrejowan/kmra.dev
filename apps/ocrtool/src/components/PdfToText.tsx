import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { Toggle } from "@kmra/ui/components/controls";
import {
  baseName,
  CopyBtn,
  DropCard,
  FileInput,
  useFiles,
} from "@kmra/ui/components/kit";
import { downloadBlob } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import { useT } from "@kmra/ui/lib/i18n-react";
import { missingLangs, recognize } from "../lib/ocr";
import {
  EmptyPdfError,
  isPdf,
  OCR_DPI,
  openPdf,
  parseRange,
  PasswordError,
  realText,
  renderPage,
} from "../lib/pdf";
import {
  engineFor,
  OcrOptions,
  PageThumb,
  RunLine,
  usePdfOcrSettings,
  useThumbs,
  type Stage,
} from "./PdfParts";

/**
 * PDF to text: pages with a real text layer are copied exactly; scanned pages are drawn at 300 dpi
 * and read with OCR. Everything runs on this device.
 */

type Status =
  | "check" // looking at the text layer
  | "layer" // real text layer, used as it is
  | "wait" // needs OCR
  | "read" // OCR running
  | "done" // read with OCR
  | "error"
  | "stopped";

interface PageItem {
  /** Text layer, when it's real text */
  layer: string | null;
  status: Status;
  progress: number;
  ocr?: string;
  conf?: number;
  /** OCR settings the text was read with */
  key?: string;
  /** The person's edits */
  edited?: string;
  ratio: number;
}

export default function PdfToText({ preset }: { preset?: Preset }) {
  const T = useT();
  const settings = usePdfOcrSettings(preset);
  const { langs, engine, key } = settings;
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const [sel, setSel] = useState(0);
  const [view, setView] = useState<"page" | "all">("page");
  const [range, setRange] = useState("");
  const [force, setForce] = useState(preset?.force === "ocr");
  const [seps, setSeps] = useState(true);
  const [opening, setOpening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState({ done: 0, total: 0 });
  const [stage, setStage] = useState<{ page: number; s: Stage } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const autoStart = useRef(false);
  const { thumbs, request } = useThumbs(doc);

  const patch = (i: number, p: Partial<PageItem>) =>
    setPages((list) => list.map((x, k) => (k === i ? { ...x, ...p } : x)));

  const usesOcr = (p: PageItem) => force || p.layer === null;
  const total = pages.length;
  const inRange = useMemo(
    () => (total ? parseRange(range, total) : []),
    [range, total],
  );
  const chosen = inRange ?? [];
  const checking = pages.some((p) => p.status === "check");
  /** Pages in range that need (fresh) OCR with the current settings */
  const todo = chosen.filter((i) => {
    const p = pages[i];
    return p && p.status !== "check" && usesOcr(p) && p.key !== key;
  });

  /* ---------- Opening ---------- */
  async function open(files: File[]) {
    const f = files[0]!;
    abort.current?.abort();
    setOpening(true);
    setProblem(null);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const d = await openPdf(bytes);
      void doc?.loadingTask.destroy();
      const first = await d.getPage(1);
      const v = first.getViewport({ scale: 1 });
      const list: PageItem[] = Array.from({ length: d.numPages }, () => ({
        layer: null,
        status: "check",
        progress: 0,
        ratio: v.width / v.height,
      }));
      setFile(f);
      setDoc(d);
      setPages(list);
      setSel(0);
      setView("page");
      setRange("");
      // Look at every page's text layer (fast), then read the rest with OCR
      for (let i = 0; i < d.numPages; i++) {
        const page = await d.getPage(i + 1);
        const pv = page.getViewport({ scale: 1 });
        const layer = await realText(d, i + 1);
        list[i] = {
          ...list[i]!,
          layer,
          status: layer === null ? "wait" : "layer",
          ratio: pv.width / pv.height,
        };
        setPages(list.slice());
      }
      autoStart.current = true;
    } catch (err) {
      const msg =
        err instanceof PasswordError
          ? T(
              "This PDF is password-protected. Remove the password in the app that made it, then try again.",
            )
          : err instanceof EmptyPdfError
            ? T("{name} has no pages.", { name: f.name })
            : T("{name} couldn't be opened. It may be damaged or not a PDF.", {
                name: f.name,
              });
      setProblem(msg);
      toast(msg);
    } finally {
      setOpening(false);
    }
  }

  // Start reading once the pages have been checked
  useEffect(() => {
    if (autoStart.current && !checking && pages.length) {
      autoStart.current = false;
      void read();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, pages.length]);

  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );

  const { dragging, pickRef, pick, take } = useFiles({
    onFiles: (f) => void open(f),
    accept: isPdf,
    reject: T("That isn't a PDF. Drop a .pdf file."),
  });

  /* ---------- Reading ---------- */
  async function read() {
    const current = doc;
    if (!current || running) return;
    const list = pagesRef.current;
    const indexes = (parseRange(range, list.length) ?? []).filter((i) => {
      const p = list[i]!;
      return (force || p.layer === null) && p.key !== key;
    });
    if (!indexes.length) return;
    const ac = new AbortController();
    abort.current = ac;
    setRunning(true);
    setRun({ done: 0, total: indexes.length });
    for (const i of indexes) patch(i, { status: "wait", progress: 0 });
    let done = 0;
    for (const i of indexes) {
      if (ac.signal.aborted) break;
      patch(i, { status: "read", progress: 0 });
      const missing = await missingLangs(langs).catch(() => []);
      setStage({ page: i, s: { status: "Loading engine", p: 0, missing } });
      try {
        const canvas = await renderPage(current, i + 1, OCR_DPI);
        if (ac.signal.aborted) throw new DOMException("stop", "AbortError");
        const res = await recognize(canvas, {
          engine: engineFor(engine),
          langs,
          signal: ac.signal,
          onProgress: (p, status) => {
            patch(i, { progress: status === "Reading text" ? p : 0 });
            setStage({ page: i, s: { status, p, missing } });
          },
        });
        canvas.width = canvas.height = 0;
        patch(i, {
          status: "done",
          ocr: res.text.trim(),
          conf: res.confidence,
          key,
          edited: undefined,
        });
      } catch (err) {
        if (ac.signal.aborted) break;
        console.warn(err);
        patch(i, { status: "error" });
        toast(T("Page {n} couldn't be read.", { n: i + 1 }));
      }
      done++;
      setRun({ done, total: indexes.length });
    }
    if (ac.signal.aborted)
      setPages((ps) =>
        ps.map((p) =>
          p.status === "read" || (p.status === "wait" && p.key !== key)
            ? { ...p, status: p.ocr !== undefined ? "done" : "stopped" }
            : p,
        ),
      );
    if (abort.current === ac) abort.current = null;
    setStage(null);
    setRunning(false);
    settings.refreshCached();
  }
  function stop() {
    abort.current?.abort();
  }

  /* ---------- Text ---------- */
  const textOf = (p: PageItem) =>
    p.edited ?? (usesOcr(p) ? (p.ocr ?? "") : (p.layer ?? ""));
  const ready = (p: PageItem) =>
    p.edited !== undefined ||
    (usesOcr(p) ? p.ocr !== undefined : p.layer !== null);

  function combined(fmt: "txt" | "md") {
    const parts = chosen
      .filter((i) => pages[i] && ready(pages[i]!))
      .map((i) => ({ n: i + 1, text: textOf(pages[i]!) }));
    if (fmt === "md")
      return (
        parts
          .map(({ n, text }) =>
            seps
              ? `## ${T("Page {n}", { n })}\n\n${mdEscape(text)}`
              : mdEscape(text),
          )
          .join("\n\n") + "\n"
      );
    return (
      parts
        .map(({ n, text }) =>
          seps ? `--- ${T("Page {n}", { n })} ---\n${text}` : text,
        )
        .join("\n\n") + "\n"
    );
  }

  const name = file ? baseName(file.name) : "text";
  const save = (fmt: "txt" | "md") =>
    downloadBlob(
      new Blob([combined(fmt)], {
        type: fmt === "md" ? "text/markdown" : "text/plain",
      }),
      `${name}.${fmt}`,
    );

  /* ---------- Empty ---------- */
  if (!doc) {
    return (
      <div className="toolcard solo op-empty">
        <div className={`stage${dragging ? " over" : ""}`}>
          <DropCard
            title={opening ? T("Opening…") : T("Drop a PDF here")}
            button={T("Choose a PDF")}
            formats={["PDF"]}
            dragging={dragging}
            onPick={pick}
          >
            <div className="op-preopts" onClick={(e) => e.stopPropagation()}>
              <OcrOptions s={settings} />
            </div>
            {problem && (
              <p className="note warn op-problem" role="alert">
                <Icon name="lock" />
                <span>{problem}</span>
              </p>
            )}
          </DropCard>
        </div>
        <FileInput
          inputRef={pickRef}
          onFiles={take}
          accept="application/pdf,.pdf"
          multiple={false}
        />
      </div>
    );
  }

  /* ---------- Workspace ---------- */
  const cur = pages[sel];
  const fromLayer = chosen.filter(
    (i) => pages[i] && !usesOcr(pages[i]!),
  ).length;
  const fromOcr = chosen.length - fromLayer;
  const readSoFar = chosen.filter(
    (i) => pages[i] && usesOcr(pages[i]!) && pages[i]!.ocr !== undefined,
  ).length;
  const stale = chosen.some((i) => {
    const p = pages[i];
    return p && usesOcr(p) && p.ocr !== undefined && p.key !== key;
  });
  const pageText = cur ? textOf(cur) : "";
  const allText = view === "all" ? combined("txt").trimEnd() : "";

  const badge = (p: PageItem): [string, "acc" | "muted" | "warn" | "busy"] => {
    if (p.status === "check") return [T("Checking"), "muted"];
    if (!usesOcr(p)) return [T("Text layer"), "acc"];
    if (p.status === "read")
      return [`${Math.round(p.progress * 100)}%`, "busy"];
    if (p.status === "error") return [T("Failed"), "warn"];
    if (p.ocr !== undefined) return [T("OCR"), "acc"];
    if (p.status === "stopped") return [T("Stopped"), "warn"];
    return [T("Waiting"), "muted"];
  };

  let placeholder = "";
  if (cur && !ready(cur))
    placeholder =
      cur.status === "read"
        ? T("Reading this page…")
        : cur.status === "error"
          ? T("This page couldn't be read.")
          : T("This page will be read with OCR.");
  else if (cur && ready(cur) && !pageText)
    placeholder = T("No text found on this page.");

  return (
    <div className="toolcard op-card">
      <div className="op-bar">
        <OcrOptions s={settings} />
        <label className="bar-item">
          <span className="bar-label">{T("Pages")}</span>
          <input
            className="bar-input op-range"
            value={range}
            placeholder={T("All")}
            onChange={(e) => setRange(e.target.value)}
            aria-label={T("Page range, e.g. 1-3, 5")}
            aria-invalid={inRange === null}
          />
        </label>
        <label className="bar-item bar-check">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          {T("Read every page with OCR")}
        </label>
        <div className="bar-push op-acts">
          {!running && todo.length > 0 && (
            <button
              type="button"
              className="btn acc"
              disabled={checking}
              onClick={() => void read()}
            >
              <Icon name="scanText" />
              {stale
                ? T("Read again")
                : todo.length === 1
                  ? T("Read 1 page")
                  : T("Read {n} pages", { n: todo.length })}
            </button>
          )}
          <button type="button" className="btn sm" onClick={pick}>
            <Icon name="upload" />
            {T("Another PDF")}
          </button>
        </div>
      </div>
      {inRange === null && (
        <p className="op-hint warn">
          {T("Use page numbers and ranges, like 1-3, 5.")}
        </p>
      )}
      {running && (
        <RunLine
          done={run.done}
          total={run.total}
          page={stage?.page ?? null}
          stage={stage?.s ?? null}
          onStop={stop}
        />
      )}
      <div className="op-body">
        <nav className="op-rail" aria-label={T("Pages")}>
          {pages.map((p, i) => {
            const [b, tone] = badge(p);
            return (
              <PageThumb
                key={i}
                index={i}
                thumb={thumbs[i]}
                ratio={p.ratio}
                selected={i === sel}
                dim={!chosen.includes(i)}
                badge={b}
                tone={tone}
                onSelect={() => {
                  setSel(i);
                  setView("page");
                }}
                onVisible={() => request(i)}
              />
            );
          })}
        </nav>
        <section className="op-main">
          <div className="op-head">
            <div className="seg sm" role="group" aria-label={T("Show")}>
              <button
                type="button"
                aria-pressed={view === "page"}
                onClick={() => setView("page")}
              >
                {T("Page {n}", { n: sel + 1 })}
              </button>
              <button
                type="button"
                aria-pressed={view === "all"}
                onClick={() => setView("all")}
              >
                {T("All pages")}
              </button>
            </div>
            {view === "page" && cur && (
              <span className="op-src muted">
                {!usesOcr(cur)
                  ? T("Copied from the text layer")
                  : cur.ocr !== undefined
                    ? T("Read with OCR · {c}% confidence", {
                        c: Math.round(cur.conf ?? 0),
                      })
                    : ""}
              </span>
            )}
            <span className="bar-push" />
            <CopyBtn
              text={view === "all" ? combined("txt") : pageText}
              label={T("Copy")}
              what="Text copied"
            />
          </div>
          <textarea
            className="op-text"
            aria-label={T("Text")}
            value={view === "all" ? allText : pageText}
            placeholder={view === "page" ? placeholder : ""}
            readOnly={view === "all" || !cur || !ready(cur)}
            spellCheck={false}
            dir="auto"
            onChange={(e) =>
              view === "page" && patch(sel, { edited: e.target.value })
            }
          />
          <div className="op-foot">
            <span className="muted small">
              {T("{n} pages: {a} from the text layer, {b} with OCR", {
                n: chosen.length,
                a: fromLayer,
                b: fromOcr,
              })}
              {fromOcr > 0 && readSoFar < fromOcr
                ? ` · ${T("{n} of {t} read", { n: readSoFar, t: fromOcr })}`
                : ""}
            </span>
            <span className="bar-push" />
            <Toggle label={T("Page separators")} on={seps} onChange={setSeps} />
            <button
              type="button"
              className="btn acc"
              disabled={checking}
              onClick={() => save("txt")}
            >
              <Icon name="download" />
              {T("Download .txt")}
            </button>
            <button
              type="button"
              className="btn"
              disabled={checking}
              onClick={() => save("md")}
            >
              .md
            </button>
          </div>
        </section>
      </div>
      <FileInput
        inputRef={pickRef}
        onFiles={take}
        accept="application/pdf,.pdf"
        multiple={false}
      />
    </div>
  );
}

/** Keep OCR text from turning into Markdown structure (headings, lists, quotes) */
function mdEscape(text: string) {
  return text
    .split("\n")
    .map((l) =>
      l
        .replace(/([\\`*_[\]<>])/g, "\\$1")
        .replace(/^(\s*)([#>+-]|\d+[.)])(?=\s)/, "$1\\$2"),
    )
    .join("\n");
}
