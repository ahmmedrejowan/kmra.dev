import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import {
  baseName,
  canvasBlob,
  decode,
  DropCard,
  FileInput,
  useFiles,
} from "@kmra/ui/components/kit";
import { downloadBlob, IMAGE_ACCEPT, isImageFile } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import { useT } from "@kmra/ui/lib/i18n-react";
import { missingLangs, recognize } from "../lib/ocr";
import type { OcrResult } from "../lib/ocr/types";
import {
  EmptyPdfError,
  isPdf,
  OCR_DPI,
  openPdf,
  PasswordError,
  realText,
  renderPage,
  thumbnail,
} from "../lib/pdf";
import type { PageJob } from "../lib/pdf-write";
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
 * Searchable PDF: each scanned page (or image) is read with OCR and the words are laid invisibly
 * over the picture, so the PDF can be searched, selected and copied. Pages keep their look.
 */

type Status = "check" | "skip" | "wait" | "read" | "done" | "error" | "stopped";

interface PageItem {
  /** The page already has a real text layer */
  hasText: boolean;
  status: Status;
  progress: number;
  ocr?: OcrResult;
  key?: string;
  /** Picture of the page, when an old text layer is replaced */
  raster?: Uint8Array;
  ratio: number;
  /** For pages made from images */
  image?: { file: File; w: number; h: number; thumb: string };
}

interface Source {
  name: string;
  /** PDF bytes (null for images) */
  bytes: Uint8Array | null;
  doc: PDFDocumentProxy | null;
}

/** Longest side of an image read with OCR */
const MAX_SIDE = 4600;
const LONG_A4_IN = 11.69;

const words = (r?: OcrResult) =>
  r
    ? r.lines.reduce(
        (n, l) => n + l.words.filter((w) => w.text.trim()).length,
        0,
      )
    : 0;

export default function SearchablePdf({ preset }: { preset?: Preset }) {
  const T = useT();
  const settings = usePdfOcrSettings(preset);
  const { langs, engine, key } = settings;
  const [src, setSrc] = useState<Source | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const [sel, setSel] = useState(0);
  const [redo, setRedo] = useState(false);
  const [boxes, setBoxes] = useState(true);
  const [opening, setOpening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [building, setBuilding] = useState(false);
  const [run, setRun] = useState({ done: 0, total: 0 });
  const [stage, setStage] = useState<{ page: number; s: Stage } | null>(null);
  const [out, setOut] = useState<{
    blob: Blob;
    key: string;
    redo: boolean;
  } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const autoStart = useRef(false);
  const { thumbs, request } = useThumbs(src?.doc ?? null);
  const [preview, setPreview] = useState<{ i: number; url: string } | null>(
    null,
  );

  const patch = (i: number, p: Partial<PageItem>) =>
    setPages((list) => list.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const needs = (p: PageItem) => !p.hasText || redo;
  const checking = pages.some((p) => p.status === "check");
  const todo = pages.filter(
    (p) => p.status !== "check" && needs(p) && p.key !== key,
  );
  const stale = pages.some((p) => needs(p) && p.ocr && p.key !== key);

  /* ---------- Opening ---------- */
  async function open(files: File[]) {
    abort.current?.abort();
    setProblem(null);
    setOut(null);
    const pdf = files.find(isPdf);
    setOpening(true);
    try {
      if (pdf) await openPdfFile(pdf);
      else await openImages(files.filter(isImageFile));
      autoStart.current = true;
    } catch (err) {
      const name = (pdf ?? files[0])?.name ?? "";
      const msg =
        err instanceof PasswordError
          ? T(
              "This PDF is password-protected. Remove the password in the app that made it, then try again.",
            )
          : err instanceof EmptyPdfError
            ? T("{name} has no pages.", { name })
            : pdf
              ? T(
                  "{name} couldn't be opened. It may be damaged or not a PDF.",
                  { name },
                )
              : T("{name} couldn't be opened.", { name });
      setProblem(msg);
      toast(msg);
    } finally {
      setOpening(false);
    }
  }

  async function openPdfFile(f: File) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const d = await openPdf(bytes);
    void src?.doc?.loadingTask.destroy();
    revokeImages();
    const list: PageItem[] = Array.from({ length: d.numPages }, () => ({
      hasText: false,
      status: "check",
      progress: 0,
      ratio: 0.707,
    }));
    setSrc({ name: baseName(f.name), bytes, doc: d });
    setPages(list);
    setSel(0);
    for (let i = 0; i < d.numPages; i++) {
      const page = await d.getPage(i + 1);
      const v = page.getViewport({ scale: 1 });
      const hasText = (await realText(d, i + 1)) !== null;
      list[i] = {
        ...list[i]!,
        hasText,
        status: "wait",
        ratio: v.width / v.height,
      };
      setPages(list.slice());
    }
  }

  async function openImages(files: File[]) {
    if (!files.length) throw new Error("no images");
    const list: PageItem[] = [];
    for (const file of files) {
      try {
        const bmp = await decode(file);
        const k = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(bmp.width * k));
        c.height = Math.max(1, Math.round(bmp.height * k));
        c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
        const thumb = URL.createObjectURL(await canvasBlob(c));
        list.push({
          hasText: false,
          status: "wait",
          progress: 0,
          ratio: bmp.width / bmp.height,
          image: { file, w: bmp.width, h: bmp.height, thumb },
        });
        bmp.close();
      } catch {
        toast(T("{name} couldn't be opened.", { name: file.name }));
      }
    }
    if (!list.length) throw new Error("no images");
    void src?.doc?.loadingTask.destroy();
    revokeImages();
    setSrc({ name: baseName(files[0]!.name), bytes: null, doc: null });
    setPages(list);
    setSel(0);
  }

  function revokeImages() {
    for (const p of pagesRef.current)
      if (p.image) URL.revokeObjectURL(p.image.thumb);
  }

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
      revokeImages();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { dragging, pickRef, pick, take } = useFiles({
    onFiles: (f) => void open(f),
    accept: (f) => isPdf(f) || isImageFile(f),
    reject: T("Drop a PDF or images."),
  });

  /* ---------- Reading ---------- */
  async function pageImage(i: number): Promise<HTMLCanvasElement> {
    const p = pagesRef.current[i]!;
    if (src?.doc) return renderPage(src.doc, i + 1, OCR_DPI);
    const bmp = await decode(p.image!.file);
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    return c;
  }

  async function read() {
    if (!src || running) return;
    const list = pagesRef.current;
    const indexes = list
      .map((p, i) => [p, i] as const)
      .filter(([p]) => needs(p) && p.key !== key)
      .map(([, i]) => i);
    const ac = new AbortController();
    abort.current = ac;
    setOut(null);
    setRunning(true);
    setRun({ done: 0, total: indexes.length });
    let done = 0;
    for (const i of indexes) {
      if (ac.signal.aborted) break;
      patch(i, { status: "read", progress: 0 });
      const missing = await missingLangs(langs).catch(() => []);
      setStage({ page: i, s: { status: "Loading engine", p: 0, missing } });
      try {
        const canvas = await pageImage(i);
        if (ac.signal.aborted) break;
        // Replacing an old text layer: the page becomes this picture
        const raster =
          list[i]!.hasText && src.doc
            ? new Uint8Array(
                await (
                  await canvasBlob(canvas, "image/jpeg", 0.85)
                ).arrayBuffer(),
              )
            : undefined;
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
        patch(i, { status: "done", ocr: res, key, raster });
      } catch (err) {
        if (ac.signal.aborted) break;
        console.warn(err);
        patch(i, { status: "error" });
        toast(T("Page {n} couldn't be read.", { n: i + 1 }));
      }
      done++;
      setRun({ done, total: indexes.length });
    }
    if (abort.current === ac) abort.current = null;
    setStage(null);
    setRunning(false);
    settings.refreshCached();
    if (ac.signal.aborted) {
      setPages((ps) =>
        ps.map((p) =>
          p.status === "read"
            ? { ...p, status: p.ocr ? "done" : "stopped" }
            : p,
        ),
      );
      return;
    }
    await build();
  }

  async function build() {
    if (!src) return;
    setBuilding(true);
    try {
      const { buildSearchable } = await import("../lib/pdf-write");
      const list = pagesRef.current;
      const jobs: PageJob[] = [];
      for (let i = 0; i < list.length; i++) {
        const p = list[i]!;
        const ocr = needs(p) && p.ocr && p.key === key ? p.ocr : null;
        if (p.image) jobs.push(await imageJob(p.image, ocr));
        else if (ocr && p.hasText && p.raster)
          jobs.push({ kind: "raster", index: i, image: p.raster, ocr });
        else jobs.push({ kind: "pdf", index: i, ocr });
      }
      const blob = await buildSearchable(src.bytes, jobs);
      setOut({ blob, key, redo });
    } catch (err) {
      console.warn(err);
      toast(
        /locked/.test(String(err))
          ? T("This PDF is password-protected and can't be changed.")
          : T("The searchable PDF couldn't be made."),
      );
    } finally {
      setBuilding(false);
    }
  }

  /* ---------- Preview of the selected page ---------- */
  useEffect(() => {
    let alive = true;
    let url = "";
    const d = src?.doc;
    if (!d || !pages.length) return;
    void thumbnail(d, sel + 1, 1100).then((t) => {
      url = t.url;
      if (alive) setPreview({ i: sel, url });
      else URL.revokeObjectURL(url);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, sel, pages.length > 0]);

  const totalWords = useMemo(
    () =>
      pages.reduce(
        (n, p) => n + (needs(p) && p.key === key ? words(p.ocr) : 0),
        0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages, key, redo],
  );

  /* ---------- Empty ---------- */
  if (!src) {
    return (
      <div className="toolcard solo op-empty">
        <div className={`stage${dragging ? " over" : ""}`}>
          <DropCard
            title={opening ? T("Opening…") : T("Drop a scanned PDF or images")}
            button={T("Choose files")}
            formats={["PDF", "JPG", "PNG", "WebP", "HEIC"]}
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
          accept={`application/pdf,.pdf,${IMAGE_ACCEPT}`}
        />
      </div>
    );
  }

  /* ---------- Workspace ---------- */
  const cur = pages[sel];
  const anyText = pages.some((p) => p.hasText);
  const badge = (p: PageItem): [string, "acc" | "muted" | "warn" | "busy"] => {
    if (p.status === "check") return [T("Checking"), "muted"];
    if (!needs(p)) return [T("Has text"), "muted"];
    if (p.status === "read")
      return [`${Math.round(p.progress * 100)}%`, "busy"];
    if (p.status === "error") return [T("Failed"), "warn"];
    if (p.ocr && p.key === key)
      return [T("{n} words", { n: words(p.ocr) }), "acc"];
    if (p.status === "stopped") return [T("Stopped"), "warn"];
    return [T("Waiting"), "muted"];
  };
  const curOcr = cur && needs(cur) && cur.key === key ? cur.ocr : undefined;
  const curUrl = cur?.image
    ? cur.image.thumb
    : preview?.i === sel
      ? preview.url
      : "";
  const outName = `${src.name}-searchable.pdf`;
  const outOk = out && out.key === key && out.redo === redo;

  return (
    <div className="toolcard op-card">
      <div className="op-bar">
        <OcrOptions s={settings} />
        {anyText && (
          <label className="bar-item bar-check">
            <input
              type="checkbox"
              checked={redo}
              onChange={(e) => {
                setRedo(e.target.checked);
                setOut(null);
              }}
            />
            {T("Redo pages that already have text")}
          </label>
        )}
        <div className="bar-push op-acts">
          {!running && !building && todo.length > 0 && (
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
            {T("Other files")}
          </button>
        </div>
      </div>
      {running && (
        <RunLine
          done={run.done}
          total={run.total}
          page={stage?.page ?? null}
          stage={stage?.s ?? null}
          onStop={() => abort.current?.abort()}
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
                thumb={p.image?.thumb ?? thumbs[i]}
                ratio={p.ratio}
                selected={i === sel}
                badge={b}
                tone={tone}
                onSelect={() => setSel(i)}
                onVisible={p.image ? undefined : () => request(i)}
              />
            );
          })}
        </nav>
        <section className="op-main op-viewer">
          <div className="op-head">
            <strong>{T("Page {n}", { n: sel + 1 })}</strong>
            <span className="op-src muted">
              {cur && !needs(cur)
                ? T("Already has text. Kept as it is.")
                : curOcr
                  ? T("{n} words found", { n: words(curOcr) })
                  : cur?.status === "read"
                    ? T("Reading this page…")
                    : ""}
            </span>
            <span className="bar-push" />
            {curOcr && (
              <label className="bar-item bar-check">
                <input
                  type="checkbox"
                  checked={boxes}
                  onChange={(e) => setBoxes(e.target.checked)}
                />
                {T("Show found words")}
              </label>
            )}
          </div>
          <div className="op-sheet-wrap">
            <div
              className="op-sheet"
              style={{ "--r": cur?.ratio ?? 0.707 } as React.CSSProperties}
            >
              {curUrl && (
                <img src={curUrl} alt={T("Page {n}", { n: sel + 1 })} />
              )}
              {curOcr && boxes && (
                <svg
                  viewBox={`0 0 ${curOcr.width} ${curOcr.height}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {curOcr.lines.flatMap((l, li) =>
                    l.words.map((w, wi) => (
                      <rect
                        key={`${li}-${wi}`}
                        x={w.box.x}
                        y={w.box.y}
                        width={w.box.w}
                        height={w.box.h}
                      >
                        <title>{w.text}</title>
                      </rect>
                    )),
                  )}
                </svg>
              )}
            </div>
          </div>
          <div className="op-foot">
            <span className="op-found" role="status">
              {T("Text found: {n} words", { n: totalWords })}
            </span>
            <span className="bar-push" />
            {building && (
              <span className="muted small">{T("Making the PDF…")}</span>
            )}
            <button
              type="button"
              className="btn acc"
              disabled={!outOk || running || building}
              onClick={() => out && downloadBlob(out.blob, outName)}
            >
              <Icon name="download" />
              {T("Download searchable PDF")}
            </button>
          </div>
        </section>
      </div>
      <FileInput
        inputRef={pickRef}
        onFiles={take}
        accept={`application/pdf,.pdf,${IMAGE_ACCEPT}`}
      />
    </div>
  );
}

/** An image as a PDF page: JPEG and PNG go in as they are, others are re-encoded as JPEG. */
async function imageJob(
  img: { file: File; w: number; h: number },
  ocr: OcrResult | null,
): Promise<PageJob> {
  // Size: as if scanned at up to 300 dpi, an A4-like page for typical photos
  const dpi = Math.max(72, Math.min(300, Math.max(img.w, img.h) / LONG_A4_IN));
  const w = (img.w * 72) / dpi;
  const h = (img.h * 72) / dpi;
  const bytes = new Uint8Array(await img.file.arrayBuffer());
  const type = img.file.type;
  if (type === "image/png" && !pngNeedsWork(bytes))
    return { kind: "image", image: bytes, format: "png", w, h, ocr };
  if (type === "image/jpeg" && jpegOrientation(bytes) <= 1)
    return { kind: "image", image: bytes, format: "jpg", w, h, ocr };
  const bmp = await decode(img.file);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const jpg = new Uint8Array(
    await (await canvasBlob(c, "image/jpeg", 0.92)).arrayBuffer(),
  );
  c.width = c.height = 0;
  return { kind: "image", image: jpg, format: "jpg", w, h, ocr };
}

/** pdf-lib can't take interlaced or 16-bit PNGs as they are */
function pngNeedsWork(b: Uint8Array) {
  if (b.length < 29) return true;
  const depth = b[24]!;
  const interlace = b[28]!;
  return depth > 8 || interlace !== 0;
}

/** EXIF orientation of a JPEG (1 = upright, 0 = none found) */
function jpegOrientation(b: Uint8Array): number {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (dv.getUint16(0) !== 0xffd8) return 0;
  let o = 2;
  while (o + 4 < b.length) {
    const marker = dv.getUint16(o);
    const len = dv.getUint16(o + 2);
    if (marker === 0xffe1 && dv.getUint32(o + 4) === 0x45786966) {
      const t = o + 10;
      const le = dv.getUint16(t) === 0x4949;
      const ifd = t + dv.getUint32(t + 4, le);
      const n = dv.getUint16(ifd, le);
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (e + 10 > b.length) break;
        if (dv.getUint16(e, le) === 0x0112) return dv.getUint16(e + 8, le);
      }
      return 0;
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
    o += 2 + len;
  }
  return 0;
}
