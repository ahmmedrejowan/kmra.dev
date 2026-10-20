import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Icon } from "@kmra/ui/components/Icon";
import { Seg } from "@kmra/ui/components/controls";
import { DropCard, FileInput, useFiles } from "@kmra/ui/components/kit";
import { downloadBlob, formatBytes, isImageFile } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useT } from "@kmra/ui/lib/i18n-react";
import {
  EmptyPdfError,
  openPdf,
  PasswordError,
  renderPage,
} from "../lib/pdfjs";
import { build, LockedError, save, stamp, textPng } from "../lib/ops";
import Thumb from "./Thumb";

/** Fill and sign: draw, type or upload a signature, add text or a date, and place them on pages. */
interface Item {
  id: string;
  page: number;
  /** Fractions of the visible page, top-left origin */
  x: number;
  y: number;
  w: number;
  h: number;
  png: Uint8Array;
  url: string;
  label: string;
}

const isPdf = (f: File) =>
  f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const SCRIPT = "'Dancing Script', 'Segoe Script', 'Brush Script MT', cursive";
const INKS: [string, string][] = [
  ["#111111", "Black"],
  ["#1a3d9c", "Blue"],
];

async function blobOf(c: HTMLCanvasElement) {
  return new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
}

/** Crop a canvas to its non-transparent pixels */
function trim(c: HTMLCanvasElement): HTMLCanvasElement {
  const x = c.getContext("2d")!;
  const { data, width, height } = x.getImageData(0, 0, c.width, c.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++)
    for (let i = 0; i < width; i++)
      if (data[(y * width + i) * 4 + 3]! > 10) {
        if (i < minX) minX = i;
        if (i > maxX) maxX = i;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) return c;
  const pad = 6;
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1 + pad * 2;
  out.height = maxY - minY + 1 + pad * 2;
  out
    .getContext("2d")!
    .drawImage(
      c,
      minX - pad,
      minY - pad,
      out.width,
      out.height,
      0,
      0,
      out.width,
      out.height,
    );
  return out;
}

/** A photo of a signature on paper → ink on transparent (paper compared to its own surroundings) */
async function cleanUpload(
  file: File,
  ink: string | null,
): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(bmp, 0, 0, c.width, c.height);
  const img = x.getImageData(0, 0, c.width, c.height);
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(c.width / 24));
  small.height = Math.max(1, Math.round(c.height / 24));
  const sx = small.getContext("2d", { willReadFrequently: true })!;
  sx.drawImage(c, 0, 0, small.width, small.height);
  const big = document.createElement("canvas");
  big.width = c.width;
  big.height = c.height;
  const bx = big.getContext("2d", { willReadFrequently: true })!;
  bx.imageSmoothingQuality = "high";
  bx.drawImage(small, 0, 0, c.width, c.height);
  const paper = bx.getImageData(0, 0, c.width, c.height).data;
  const p = img.data;
  const col = ink
    ? [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16))
    : null;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3]! < 255) continue; // already transparent PNGs keep their alpha
    const l = 0.299 * p[i]! + 0.587 * p[i + 1]! + 0.114 * p[i + 2]!;
    const bg =
      0.299 * paper[i]! + 0.587 * paper[i + 1]! + 0.114 * paper[i + 2]! || 1;
    const a = Math.min(1, Math.max(0, (0.78 - l / bg) / 0.12));
    if (col) {
      p[i] = col[0]!;
      p[i + 1] = col[1]!;
      p[i + 2] = col[2]!;
    }
    p[i + 3] = Math.round(a * 255);
  }
  x.putImageData(img, 0, 0);
  return trim(c);
}

/** Island entry: sets the interface language for everything inside. */
export default function SignPdf(props: { lang?: Locale }) {
  return (
    <LangProvider lang={props.lang}>
      <SignPdfView />
    </LangProvider>
  );
}

function SignPdfView() {
  const T = useT();
  const [doc, setDoc] = useState<{
    key: string;
    file: File;
    bytes: Uint8Array;
    pdf: PDFDocumentProxy;
  } | null>(null);
  const [page, setPage] = useState(0);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [aspect, setAspect] = useState(1.414);
  const [items, setItems] = useState<Item[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<"draw" | "type" | "upload">("draw");
  const [ink, setInk] = useState("#111111");
  const [typed, setTyped] = useState("");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const padRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const upRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    mode: "move" | "size";
    x: number;
    y: number;
    start: Item;
  } | null>(null);

  async function open(files: File[]) {
    const file = files[0]!;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await openPdf(bytes);
      void doc?.pdf.loadingTask.destroy();
      setDoc({ key: crypto.randomUUID(), file, bytes, pdf });
      setPage(0);
      setItems([]);
    } catch (err) {
      toast(
        err instanceof PasswordError
          ? T("{name} is password-protected.", { name: file.name })
          : err instanceof EmptyPdfError
            ? T("{name} has no pages.", { name: file.name })
            : T("{name} couldn't be opened.", { name: file.name }),
      );
    }
  }
  const { dragging, pickRef, pick, take } = useFiles({
    onFiles: (f) => void open(f),
    accept: isPdf,
    reject: T("That isn't a PDF."),
  });

  // Draw the current page large
  useEffect(() => {
    if (!doc) return;
    let live = true;
    void (async () => {
      const p = await doc.pdf.getPage(page + 1);
      const v = p.getViewport({ scale: 1 });
      const c = await renderPage(
        doc.pdf,
        page + 1,
        (900 * (window.devicePixelRatio > 1 ? 2 : 1)) / v.width,
      );
      const url = URL.createObjectURL(
        await new Promise<Blob>((r) =>
          c.toBlob((b) => r(b!), "image/jpeg", 0.88),
        ),
      );
      if (!live) return URL.revokeObjectURL(url);
      setAspect(v.height / v.width);
      setPageUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
    })();
    return () => {
      live = false;
    };
  }, [doc, page]);

  /* ---------- Signature pad ---------- */
  useEffect(() => {
    const c = padRef.current;
    if (!c || mode !== "draw") return;
    const r = c.getBoundingClientRect();
    c.width = Math.round(r.width * 2);
    c.height = Math.round(r.height * 2);
    setHasInk(false);
  }, [mode, doc]);
  function padPoint(e: PointerEvent) {
    const r = padRef.current!.getBoundingClientRect();
    return [
      ((e.clientX - r.left) / r.width) * padRef.current!.width,
      ((e.clientY - r.top) / r.height) * padRef.current!.height,
    ] as const;
  }
  function padDown(e: PointerEvent) {
    const x = padRef.current!.getContext("2d")!;
    padRef.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const [px, py] = padPoint(e);
    x.lineCap = "round";
    x.lineJoin = "round";
    x.strokeStyle = ink;
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + 0.1, py + 0.1);
    x.stroke();
  }
  function padMove(e: PointerEvent) {
    if (!drawing.current) return;
    const x = padRef.current!.getContext("2d")!;
    const [px, py] = padPoint(e);
    x.lineTo(px, py);
    x.stroke();
    setHasInk(true);
  }
  const padUp = () => (drawing.current = false);
  function clearPad() {
    const c = padRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  }

  /* ---------- Items ---------- */
  async function place(
    canvas: HTMLCanvasElement,
    label: string,
    widthFrac: number,
  ) {
    const png = new Uint8Array(await (await blobOf(canvas)).arrayBuffer());
    const w = widthFrac;
    // Height in page fractions keeps the image's shape on this page
    const h = ((canvas.height / canvas.width) * w) / aspect;
    const it: Item = {
      id: crypto.randomUUID(),
      page,
      x: 0.5 - w / 2,
      // Each new item on a page goes a little lower, so they don't stack on top of each other
      y: Math.min(
        0.92 - h,
        0.62 + items.filter((i) => i.page === page).length * 0.07,
      ),
      w,
      h,
      png,
      url: URL.createObjectURL(
        new Blob([png as BlobPart], { type: "image/png" }),
      ),
      label,
    };
    setItems((l) => [...l, it]);
    setSel(it.id);
  }
  async function addSignature() {
    if (mode === "draw") {
      if (!hasInk) return toast(T("Draw your signature in the box first."));
      return place(trim(padRef.current!), T("Signature"), 0.3);
    }
    if (mode === "type") {
      if (!typed.trim()) return toast(T("Type your name first."));
      await document.fonts.load(`64px ${SCRIPT}`);
      const art = await textPng(typed.trim(), 120, ink, `400 {px}px ${SCRIPT}`);
      const img = await createImageBitmap(
        new Blob([art.png as BlobPart], { type: "image/png" }),
      );
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      return place(trim(c), T("Signature"), 0.3);
    }
    upRef.current?.click();
  }
  async function addText(t: string, label: string) {
    if (!t.trim()) return toast(T("Type the text first."));
    const art = await textPng(
      t,
      64,
      "#111111",
      "400 {px}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    );
    const img = await createImageBitmap(
      new Blob([art.png as BlobPart], { type: "image/png" }),
    );
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d")!.drawImage(img, 0, 0);
    // About 11 pt text on an A4-width page
    return place(c, label, Math.min(0.9, (c.width / 64) * 0.021));
  }

  function begin(e: PointerEvent, id: string, m: "move" | "size") {
    e.stopPropagation();
    e.preventDefault();
    viewRef.current?.setPointerCapture(e.pointerId);
    const it = items.find((i) => i.id === id)!;
    drag.current = { id, mode: m, x: e.clientX, y: e.clientY, start: it };
    setSel(id);
  }
  function moveItem(e: PointerEvent) {
    const d = drag.current;
    const r = viewRef.current?.getBoundingClientRect();
    if (!d || !r) return;
    const dx = (e.clientX - d.x) / r.width;
    const dy = (e.clientY - d.y) / r.height;
    const s = d.start;
    setItems((l) =>
      l.map((i) => {
        if (i.id !== d.id) return i;
        if (d.mode === "move")
          return {
            ...i,
            x: Math.min(1 - s.w, Math.max(0, s.x + dx)),
            y: Math.min(1 - s.h, Math.max(0, s.y + dy)),
          };
        const w = Math.min(1 - s.x, Math.max(0.03, s.w + dx));
        return { ...i, w, h: (s.h * w) / s.w };
      }),
    );
  }
  const endDrag = () => (drag.current = null);

  async function download() {
    if (!doc) return;
    setBusy(true);
    try {
      const pages = Array.from({ length: doc.pdf.numPages }, (_, i) => ({
        id: String(i),
        file: doc.key,
        index: i,
        rotate: 0,
      }));
      const out = await build(pages, () => doc.bytes);
      await stamp(
        out,
        items.map(({ page, x, y, w, h, png }) => ({ page, x, y, w, h, png })),
      );
      const blob = await save(out);
      downloadBlob(blob, `${doc.file.name.replace(/\.pdf$/i, "")}-sign.pdf`);
      toast(T("Saved, {size}.", { size: formatBytes(blob.size) }));
    } catch (err) {
      toast(
        err instanceof LockedError
          ? T("This PDF is password-protected and can't be changed.")
          : T("Couldn't save. The PDF may be damaged."),
      );
    } finally {
      setBusy(false);
    }
  }

  const input = (
    <FileInput
      inputRef={pickRef}
      onFiles={take}
      multiple={false}
      accept="application/pdf,.pdf"
    />
  );
  if (!doc)
    return (
      <>
        <DropCard
          dragging={dragging}
          onPick={pick}
          title={T("Drop the PDF to sign")}
          button={T("Choose a PDF")}
          formats={["PDF"]}
        />
        {input}
      </>
    );

  const n = doc.pdf.numPages;
  const onPage = items.filter((i) => i.page === page);
  return (
    <>
      <div className="toolcard pdfcard sign">
        <div className={`stage pdf-stage${dragging ? " over" : ""}`}>
          <div className="sign-view-wrap">
            <div
              className="sign-view"
              ref={viewRef}
              style={{ aspectRatio: `1 / ${aspect}` }}
              onPointerMove={moveItem}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerDown={() => setSel(null)}
            >
              {pageUrl && (
                <img
                  src={pageUrl}
                  alt={T("Page {n}", { n: page + 1 })}
                  draggable={false}
                />
              )}
              {onPage.map((i) => (
                <div
                  key={i.id}
                  className={`sign-item${sel === i.id ? " sel" : ""}`}
                  style={{
                    left: `${i.x * 100}%`,
                    top: `${i.y * 100}%`,
                    width: `${i.w * 100}%`,
                    height: `${i.h * 100}%`,
                  }}
                  onPointerDown={(e) => begin(e, i.id, "move")}
                >
                  <img src={i.url} alt={i.label} draggable={false} />
                  <button
                    type="button"
                    className="region-x"
                    aria-label={T("Remove {name}", { name: i.label })}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() =>
                      setItems((l) => l.filter((x) => x.id !== i.id))
                    }
                  >
                    ×
                  </button>
                  <span
                    className="sign-size"
                    onPointerDown={(e) => begin(e, i.id, "size")}
                    aria-hidden="true"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="sign-pages">
            <button
              type="button"
              className="iconbtn"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              aria-label={T("Previous page")}
            >
              <Icon name="back" />
            </button>
            <span>{T("Page {n} of {t}", { n: page + 1, t: n })}</span>
            <button
              type="button"
              className="iconbtn"
              disabled={page >= n - 1}
              onClick={() => setPage(page + 1)}
              aria-label={T("Next page")}
            >
              <Icon name="right" />
            </button>
          </div>
          {n > 1 && (
            <div className="sign-strip">
              {Array.from({ length: n }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={i === page}
                  onClick={() => setPage(i)}
                >
                  <Thumb
                    fileKey={doc.key}
                    doc={doc.pdf}
                    index={i}
                    width={60}
                    alt={T("Page {n}", { n: i + 1 })}
                  />
                  {items.some((it) => it.page === i) && <i className="dot" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="controls">
          <Seg<typeof mode>
            label={T("Signature")}
            options={[
              ["draw", T("Draw")],
              ["type", T("Type")],
              ["upload", T("Photo")],
            ]}
            value={mode}
            onPick={setMode}
          />
          {mode === "draw" && (
            <div className="ctl">
              <canvas
                ref={padRef}
                className="sigpad"
                onPointerDown={padDown}
                onPointerMove={padMove}
                onPointerUp={padUp}
                onPointerCancel={padUp}
                aria-label={T("Draw your signature here")}
              />
              <div className="acts-row" style={{ marginTop: 6 }}>
                <button type="button" className="btn sm" onClick={clearPad}>
                  {T("Clear")}
                </button>
              </div>
            </div>
          )}
          {mode === "type" && (
            <div className="ctl">
              <input
                className="num"
                placeholder={T("Your name")}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
              {typed && (
                <p
                  className="typed-preview"
                  style={{ fontFamily: SCRIPT, color: ink }}
                >
                  {typed}
                </p>
              )}
            </div>
          )}
          {mode === "upload" && (
            <small className="muted">
              {T(
                "A photo of your signature on white paper. The paper is removed for you.",
              )}
            </small>
          )}
          <Seg<string>
            label={T("Ink")}
            options={INKS.map(([c, name]) => [c, T(name)] as [string, string])}
            value={ink}
            onPick={setInk}
          />
          <button
            type="button"
            className="btn"
            onClick={() => void addSignature()}
          >
            <Icon name="signature" />
            {T(
              mode === "upload"
                ? "Choose photo and place it"
                : "Place on this page",
            )}
          </button>
          <input
            ref={upRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f || !isImageFile(f)) return;
              await place(await cleanUpload(f, ink), T("Signature"), 0.3);
            }}
          />
          <div className="ctl">
            <label htmlFor="sg-text">{T("Text (name, date, initials)")}</label>
            <div className="row-btn">
              <input
                id="sg-text"
                className="num"
                value={extra}
                placeholder={T("Type text to add")}
                onChange={(e) => setExtra(e.target.value)}
              />
              <button
                type="button"
                className="btn sm"
                onClick={() => void addText(extra, T("Text"))}
              >
                {T("Add")}
              </button>
            </div>
            <div className="chips" style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() =>
                  void addText(new Date().toLocaleDateString(), T("Date"))
                }
              >
                {T("+ Today's date")}
              </button>
              <button
                type="button"
                onClick={() => void addText("✓", T("Tick"))}
              >
                {T("+ Tick ✓")}
              </button>
            </div>
          </div>
          <small className="muted">
            {T(
              "Drag to move. Use the corner to resize. Everything stays on your device.",
            )}
          </small>
          <div className="result">
            <small>
              {T(
                items.length === 1
                  ? new Set(items.map((i) => i.page)).size === 1
                    ? "{n} item on {p} page"
                    : "{n} item on {p} pages"
                  : new Set(items.map((i) => i.page)).size === 1
                    ? "{n} items on {p} page"
                    : "{n} items on {p} pages",
                {
                  n: items.length,
                  p: new Set(items.map((i) => i.page)).size,
                },
              )}
            </small>
            <div className="acts">
              <button
                type="button"
                className="btn acc"
                disabled={!items.length || busy}
                onClick={() => void download()}
              >
                <Icon name="download" />
                {T(busy ? "Saving…" : "Download signed PDF")}
              </button>
              <button type="button" className="advlink" onClick={pick}>
                {T("Use another PDF")}
              </button>
            </div>
          </div>
        </div>
      </div>
      {input}
    </>
  );
}
