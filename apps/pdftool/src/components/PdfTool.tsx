import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Icon } from "@kmra/ui/components/Icon";
import { Seg, Slider, Colors, Toggle } from "@kmra/ui/components/controls";
import {
  CopyBtn,
  DropCard,
  FileInput,
  downloadZip,
  useFiles,
} from "@kmra/ui/components/kit";
import { downloadBlob, formatBytes } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import { openPdf, pageText, PasswordError } from "../lib/pdfjs";
import {
  build,
  forget,
  LockedError,
  pageNumbers,
  rasterize,
  rasterizeEach,
  readMeta,
  save,
  source,
  watermark,
  writeMeta,
  type Corner,
  type Meta,
  type NumberOpts,
  type PageRef,
  type WatermarkOpts,
} from "../lib/ops";
import Thumb from "./Thumb";
import type { Preset } from "@kmra/registry";

interface Doc {
  key: string;
  file: File;
  bytes: Uint8Array;
  pdf: PDFDocumentProxy;
  pages: number;
}

interface Out {
  name: string;
  blob: Blob;
}

/** Tools whose output combines every file into one PDF */
const COMBINED = new Set(["merge", "organize"]);
/** Tools where picking pages in the grid means something, and what it means */
const PICK: Record<string, string> = {
  "remove-pages": "Click pages to remove them.",
  split: "Click pages to pick which ones to extract.",
  "to-image": "Click pages to save only those. None picked saves all.",
};

const isPdf = (f: File) =>
  f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const base = (name: string) => name.replace(/\.pdf$/i, "") || "document";
const MODE_KEY = "kmra-mode";

/** "1-3, 5" → [0,1,2,4] within 1..max; null when the text is empty or invalid */
export function parseRanges(text: string, max: number): number[][] | null {
  const parts = text
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const out: number[][] = [];
  for (const p of parts) {
    const m = /^(\d+)\s*(?:[-–]\s*(\d+|end))?$/i.exec(p);
    if (!m) return null;
    const a = +m[1]!;
    const b = m[2] ? (m[2].toLowerCase() === "end" ? max : +m[2]) : a;
    if (a < 1 || b < a || a > max) return null;
    const range: number[] = [];
    for (let i = a; i <= Math.min(b, max); i++) range.push(i - 1);
    out.push(range);
  }
  return out;
}

export default function PdfTool({
  tool,
  preset,
}: {
  tool: string;
  preset?: Preset;
}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [pages, setPages] = useState<PageRef[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [outs, setOuts] = useState<Out[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const docsRef = useRef(docs);
  docsRef.current = docs;

  // Tool options
  const [splitMode, setSplitMode] = useState<"each" | "ranges" | "extract">(
    (preset?.splitMode as "each" | "ranges" | "extract") ?? "ranges",
  );
  const [ranges, setRanges] = useState("");
  const [turn, setTurn] = useState(90);
  const [imgType, setImgType] = useState<"image/jpeg" | "image/png">(
    (preset?.imgType as "image/jpeg" | "image/png") ?? "image/jpeg",
  );
  const [dpi, setDpi] = useState(150);
  const [level, setLevel] = useState<"light" | "strong" | "max">("strong");
  const [target, setTarget] = useState<number | null>(
    typeof preset?.target === "number" ? preset.target : null,
  );
  const [num, setNum] = useState<NumberOpts>({
    pos: "bc",
    format: "page-n-of",
    start: 1,
    size: 11,
    margin: 28,
    skipFirst: false,
  });
  const [wm, setWm] = useState<WatermarkOpts>({
    text: "CONFIDENTIAL",
    size: 9,
    opacity: 18,
    color: "#e5484d",
    angle: 45,
    tile: false,
  });
  const [meta, setMeta] = useState<Meta | null>(null);
  const [text, setText] = useState<string | null>(null);

  const reset = () => {
    setOuts(null);
    setText(null);
  };

  /* ---------- Files ---------- */
  const add = useCallback(async (files: File[]) => {
    const added: Doc[] = [];
    for (const file of files) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pdf = await openPdf(bytes);
        added.push({
          key: crypto.randomUUID(),
          file,
          bytes,
          pdf,
          pages: pdf.numPages,
        });
      } catch (err) {
        toast(
          err instanceof PasswordError
            ? `${file.name} is password-protected. Remove the password in the app that made it, then try again.`
            : `${file.name} couldn't be opened. It may be damaged or not a PDF.`,
        );
      }
    }
    if (!added.length) return;
    setDocs((d) => [...d, ...added]);
    setPages((p) => [
      ...p,
      ...added.flatMap((d) =>
        Array.from({ length: d.pages }, (_, i) => ({
          id: `${d.key}:${i}:${Math.random().toString(36).slice(2, 7)}`,
          file: d.key,
          index: i,
          rotate: 0,
        })),
      ),
    ]);
    reset();
  }, []);

  const { dragging, pickRef, pick, take } = useFiles({
    onFiles: (f) => void add(f),
    accept: isPdf,
    reject: "That isn't a PDF. Drop a .pdf file.",
  });

  function removeDoc(key: string) {
    const d = docs.find((x) => x.key === key);
    void d?.pdf.loadingTask.destroy();
    forget(key);
    setDocs((list) => list.filter((x) => x.key !== key));
    setPages((list) => list.filter((p) => p.file !== key));
    reset();
  }
  function moveDoc(key: string, by: -1 | 1) {
    setDocs((list) => {
      const i = list.findIndex((d) => d.key === key);
      const j = i + by;
      if (j < 0 || j >= list.length) return list;
      const next = list.slice();
      [next[i], next[j]] = [next[j]!, next[i]!];
      // Keep pages in the new file order
      setPages((ps) => next.flatMap((d) => ps.filter((p) => p.file === d.key)));
      return next;
    });
    reset();
  }

  // Metadata tool: read the first file's fields
  useEffect(() => {
    if (tool !== "metadata" || !docs[0]) return;
    void source(docs[0].key, docs[0].bytes)
      .then((d) => setMeta(readMeta(d)))
      .catch(() => setMeta(null));
  }, [tool, docs]);

  /* ---------- Mode (Simple = files, Advanced = every page) ---------- */
  useEffect(() => {
    try {
      if (localStorage.getItem(MODE_KEY) === "advanced") setAdvanced(true);
    } catch {}
    const on = () => setMode(true);
    const off = () => setMode(false);
    window.addEventListener("kmra:advanced", on);
    window.addEventListener("kmra:simple", off);
    return () => {
      window.removeEventListener("kmra:advanced", on);
      window.removeEventListener("kmra:simple", off);
    };
  }, []);
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("kmra:mode", { detail: { advanced } }),
    );
  }, [advanced]);
  function setMode(a: boolean) {
    setAdvanced(a);
    try {
      localStorage.setItem(MODE_KEY, a ? "advanced" : "simple");
    } catch {}
  }

  /* ---------- Page edits ---------- */
  const rotatePage = (id: string, by: number) =>
    setPages((ps) =>
      ps.map((p) =>
        p.id === id
          ? { ...p, rotate: (((p.rotate + by) % 360) + 360) % 360 }
          : p,
      ),
    );
  const deletePage = (id: string) =>
    setPages((ps) => ps.filter((p) => p.id !== id));
  const togglePick = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setPages((ps) => {
      const from = ps.findIndex((p) => p.id === dragId);
      const to = ps.findIndex((p) => p.id === targetId);
      if (from < 0 || to < 0) return ps;
      const next = ps.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m!);
      return next;
    });
    setDragId(null);
    reset();
  }
  function insertBlank(afterId: string) {
    setPages((ps) => {
      const i = ps.findIndex((p) => p.id === afterId);
      const next = ps.slice();
      next.splice(i + 1, 0, {
        id: `blank:${Math.random().toString(36).slice(2, 9)}`,
        file: "",
        index: 0,
        rotate: 0,
        blank: { w: 595.28, h: 841.89 },
      });
      return next;
    });
    reset();
  }

  /* ---------- Running the tool ---------- */
  const bytesOf = (key: string) =>
    docsRef.current.find((d) => d.key === key)!.bytes;
  const docPages = (key: string) => pages.filter((p) => p.file === key);

  async function rasterTo(doc: Doc, list: PageRef[], gray: boolean) {
    const settings = {
      light: { dpi: 150, q: 0.82 },
      strong: { dpi: 110, q: 0.65 },
      max: { dpi: 80, q: 0.5 },
    }[level];
    const run = async (dpi: number, q: number) =>
      save(
        await rasterize(
          doc.pdf,
          {
            dpi,
            quality: q,
            gray,
            onPage: (n, t) => setBusy(`Page ${n} of ${t}…`),
          },
          list.map((p) => ({ index: p.index, rotate: p.rotate })),
        ),
      );
    if (tool === "grayscale") return run(settings.dpi, 0.8);
    // A lossless re-save keeps text selectable; use it whenever it's small enough
    setBusy("Re-saving…");
    const lossless = await save(await build(list, bytesOf));
    if (!target) {
      const raster = await run(settings.dpi, settings.q);
      return raster.size < lossless.size * 0.9 ? raster : lossless;
    }
    if (lossless.size <= target * 1024) return lossless;
    // Fit the size: draw the pages once per resolution, save at four qualities, keep the best
    // one that fits; otherwise go down a resolution step
    const limit = target * 1024;
    const QS = [0.8, 0.6, 0.45, 0.3];
    let best: Blob = lossless;
    for (const d of [150, 110, 80, 60]) {
      const docs = await rasterizeEach(
        doc.pdf,
        d,
        QS,
        list.map((p) => ({ index: p.index, rotate: p.rotate })),
        (n, total) => setBusy(`${d} dpi: page ${n} of ${total}…`),
      );
      const blobs = await Promise.all(docs.map(save));
      for (const b of blobs) if (b.size < best.size) best = b;
      const fit = blobs.find((b) => b.size <= limit);
      if (fit) return fit;
    }
    return best;
  }

  async function runFor(doc: Doc): Promise<Out[]> {
    const list = docPages(doc.key);
    const name = base(doc.file.name);
    const one = async (
      refs: PageRef[],
      suffix: string,
      edit?: (d: Awaited<ReturnType<typeof build>>) => Promise<void> | void,
    ) => {
      const d = await build(refs, bytesOf);
      if (edit) await edit(d);
      return { name: `${name}${suffix}.pdf`, blob: await save(d) };
    };
    switch (tool) {
      case "remove-pages": {
        const drop = new Set(picked);
        const fromText = parseRanges(ranges, doc.pages)?.flat() ?? [];
        const keep = list.filter(
          (p) => !drop.has(p.id) && !fromText.includes(p.index),
        );
        if (!keep.length) throw new Error("That would remove every page.");
        return [await one(keep, "-kmra")];
      }
      case "rotate":
        return [
          await one(
            list.map((p) => ({ ...p, rotate: (p.rotate + turn) % 360 })),
            "-rotated",
          ),
        ];
      case "split": {
        if (splitMode === "each")
          return Promise.all(list.map((p, i) => one([p], `-page-${i + 1}`)));
        const chosen = list.filter((p) => picked.has(p.id));
        if (splitMode === "extract" || (chosen.length && !ranges.trim())) {
          const fromText = parseRanges(ranges, doc.pages)?.flat();
          const refs = chosen.length
            ? chosen
            : fromText
              ? list.filter((p) => fromText.includes(p.index))
              : [];
          if (!refs.length)
            throw new Error("Pick pages, or type them like 1-3, 5.");
          return [await one(refs, "-extract")];
        }
        const groups = parseRanges(ranges, doc.pages);
        if (!groups) throw new Error("Type page ranges like 1-3, 4-6.");
        return Promise.all(
          groups.map((g) =>
            one(
              list
                .filter((p) => g.includes(p.index))
                .sort((a, b) => g.indexOf(a.index) - g.indexOf(b.index)),
              `-pages-${g[0]! + 1}${g.length > 1 ? `-${g[g.length - 1]! + 1}` : ""}`,
            ),
          ),
        );
      }
      case "compress":
      case "grayscale":
        return [
          {
            name: `${name}-${tool === "compress" ? "compressed" : "grayscale"}.pdf`,
            blob: await rasterTo(doc, list, tool === "grayscale"),
          },
        ];
      case "page-numbers":
        return [await one(list, "-numbered", (d) => pageNumbers(d, num))];
      case "watermark":
        return [await one(list, "-watermarked", (d) => watermark(d, wm))];
      case "metadata":
        return [
          await one(list, "-kmra", (d) =>
            writeMeta(d, meta ?? readMetaBlank(), metaStrip),
          ),
        ];
      case "to-image": {
        const chosen = list.filter((p) => picked.has(p.id));
        const refs = chosen.length ? chosen : list;
        const ext = imgType === "image/png" ? "png" : "jpg";
        const outs: Out[] = [];
        const { renderPage } = await import("../lib/pdfjs");
        for (let i = 0; i < refs.length; i++) {
          setBusy(`Page ${i + 1} of ${refs.length}…`);
          const p = refs[i]!;
          const c = await renderPage(doc.pdf, p.index + 1, dpi / 72, p.rotate);
          const blob = await new Promise<Blob>((r) =>
            c.toBlob((b) => r(b!), imgType, 0.92),
          );
          c.width = c.height = 0;
          outs.push({ name: `${name}-page-${p.index + 1}.${ext}`, blob });
        }
        return outs;
      }
      case "to-text": {
        const parts: string[] = [];
        for (const p of list) {
          setBusy(`Reading page ${p.index + 1}…`);
          parts.push(await pageText(doc.pdf, p.index + 1));
        }
        const all = parts.join("\n\n\f\n\n");
        return [
          {
            name: `${name}.txt`,
            blob: new Blob([all], { type: "text/plain" }),
          },
        ];
      }
      default:
        return [await one(list, "-kmra")];
    }
  }

  const [metaStrip, setMetaStrip] = useState(false);
  const readMetaBlank = (): Meta => ({
    title: "",
    author: "",
    subject: "",
    keywords: "",
    creator: "",
    producer: "",
  });

  async function run() {
    setBusy("Working…");
    setOuts(null);
    try {
      let results: Out[];
      if (COMBINED.has(tool)) {
        if (!pages.length) throw new Error("There are no pages left.");
        const name =
          docs.length > 1 ? "merged-kmra" : `${base(docs[0]!.file.name)}-kmra`;
        results = [
          {
            name: `${name}.pdf`,
            blob: await save(await build(pages, bytesOf)),
          },
        ];
      } else {
        results = [];
        for (const d of docs) results.push(...(await runFor(d)));
      }
      setOuts(results);
      if (tool === "to-text")
        setText(
          await results
            .map((r) => r.blob.text())
            .reduce(async (a, b) => (await a) + "\n\n" + (await b)),
        );
    } catch (err) {
      toast(
        err instanceof LockedError
          ? "This PDF is password-protected and can't be changed here."
          : err instanceof Error && err.message.length < 120
            ? err.message
            : "Something went wrong. The PDF may be damaged.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function downloadAll() {
    if (!outs) return;
    if (outs.length === 1) downloadBlob(outs[0]!.blob, outs[0]!.name);
    else
      await downloadZip(
        outs,
        tool === "to-image" ? "pages-kmra.zip" : "pdfs-kmra.zip",
      );
  }

  /* ---------- Views ---------- */
  const input = (
    <FileInput
      inputRef={pickRef}
      onFiles={take}
      accept="application/pdf,.pdf"
    />
  );
  if (!docs.length)
    return (
      <>
        <DropCard
          dragging={dragging}
          onPick={pick}
          title={tool === "merge" ? "Drop PDFs to merge" : "Drop a PDF here"}
          button={tool === "merge" ? "Choose PDFs" : "Choose a PDF"}
          formats={["PDF"]}
        >
          {advanced && (
            <span className="mode-note">
              <Icon name="sliders" />
              Opens with every page shown
            </span>
          )}
        </DropCard>
        {input}
      </>
    );

  const totalIn = docs.reduce((a, d) => a + d.file.size, 0);
  const totalOut = outs?.reduce((a, o) => a + o.blob.size, 0) ?? 0;
  const pickHint = PICK[tool];

  const fileList = (
    <div className="pdf-files">
      {docs.map((d, i) => (
        <div key={d.key} className="pdf-file">
          <Thumb fileKey={d.key} doc={d.pdf} index={0} width={84} alt="" />
          <div className="pdf-file-text">
            <strong>{d.file.name}</strong>
            <small>
              {d.pages} page{d.pages > 1 ? "s" : ""}, {formatBytes(d.file.size)}
            </small>
          </div>
          <div className="pdf-file-acts">
            {tool === "merge" && docs.length > 1 && (
              <>
                <button
                  type="button"
                  className="iconbtn"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => moveDoc(d.key, -1)}
                >
                  <Icon name="down" className="ico up" />
                </button>
                <button
                  type="button"
                  className="iconbtn"
                  aria-label="Move down"
                  disabled={i === docs.length - 1}
                  onClick={() => moveDoc(d.key, 1)}
                >
                  <Icon name="down" />
                </button>
              </>
            )}
            <button
              type="button"
              className="iconbtn"
              aria-label={`Remove ${d.file.name}`}
              onClick={() => removeDoc(d.key)}
            >
              <Icon name="x" />
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="fchip add" onClick={pick}>
        {tool === "merge" ? "+ Add PDFs" : "+ Add another PDF"}
      </button>
    </div>
  );

  const pageGrid = (
    <div className="page-grid">
      {pages.map((p, i) => {
        const d = docs.find((x) => x.key === p.file);
        const isPicked = picked.has(p.id);
        return (
          <div
            key={p.id}
            className={`pg${isPicked ? " picked" : ""}${pickHint && tool === "remove-pages" && isPicked ? " out" : ""}`}
            draggable
            onDragStart={() => setDragId(p.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropOn(p.id)}
          >
            <button
              type="button"
              className="pg-face"
              onClick={() => pickHint && togglePick(p.id)}
              aria-pressed={pickHint ? isPicked : undefined}
              aria-label={`Page ${i + 1}`}
            >
              {p.file ? (
                <Thumb
                  fileKey={p.file}
                  doc={d?.pdf ?? null}
                  index={p.index}
                  rotate={p.rotate}
                  alt={`Page ${p.index + 1}`}
                />
              ) : (
                <div className="thumb blank">Blank</div>
              )}
            </button>
            <div className="pg-bar">
              <span>
                {i + 1}
                {docs.length > 1 && p.file && (
                  <small className="pg-file">
                    {String.fromCharCode(
                      65 + docs.findIndex((x) => x.key === p.file),
                    )}
                  </small>
                )}
              </span>
              <span className="pg-acts">
                <button
                  type="button"
                  title="Rotate"
                  aria-label="Rotate page"
                  onClick={() => {
                    rotatePage(p.id, 90);
                    reset();
                  }}
                >
                  <Icon name="rotateRight" />
                </button>
                {(tool === "organize" || tool === "merge") && (
                  <button
                    type="button"
                    title="Insert a blank page after"
                    aria-label="Insert blank page after"
                    onClick={() => insertBlank(p.id)}
                  >
                    <Icon name="plus" />
                  </button>
                )}
                <button
                  type="button"
                  title="Delete"
                  aria-label="Delete page"
                  onClick={() => {
                    deletePage(p.id);
                    reset();
                  }}
                >
                  <Icon name="x" />
                </button>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  const pagesField = (label: string, placeholder: string) => (
    <div className="ctl">
      <label htmlFor="pdf-ranges">{label}</label>
      <input
        id="pdf-ranges"
        className="num"
        value={ranges}
        placeholder={placeholder}
        onChange={(e) => {
          setRanges(e.target.value);
          reset();
        }}
      />
    </div>
  );

  function controls(): ReactNode {
    switch (tool) {
      case "merge":
        return (
          <p className="muted small">
            Files are joined in the order shown.{" "}
            {advanced
              ? "Drag pages to reorder them, rotate or delete any page."
              : "Switch to Advanced to arrange single pages."}
          </p>
        );
      case "organize":
        return (
          <p className="muted small">
            Drag pages to reorder them. Rotate, delete or add blank pages, then
            download.
          </p>
        );
      case "remove-pages":
        return (
          <>
            {pagesField("Pages to remove", "e.g. 2, 5-7")}
            {advanced ? (
              <small className="muted">
                {PICK[tool]} Picked: {picked.size}
              </small>
            ) : (
              <small className="muted">
                Or switch to Advanced and click the pages.
              </small>
            )}
          </>
        );
      case "rotate":
        return (
          <Seg<number>
            label="Rotate every page"
            options={[
              [270, "Left"],
              [90, "Right"],
              [180, "Upside down"],
            ]}
            value={turn}
            onPick={(v) => {
              setTurn(v);
              reset();
            }}
          />
        );
      case "split":
        return (
          <>
            <Seg<typeof splitMode>
              label="Split"
              options={[
                ["ranges", "By ranges"],
                ["each", "Every page"],
                ["extract", "Extract pages"],
              ]}
              value={splitMode}
              onPick={(v) => {
                setSplitMode(v);
                reset();
              }}
            />
            {splitMode === "ranges" &&
              pagesField("Ranges (one PDF each)", "e.g. 1-3, 4-8, 9-end")}
            {splitMode === "extract" && (
              <>
                {pagesField("Pages to keep in one PDF", "e.g. 1, 3-4")}
                {advanced && (
                  <small className="muted">
                    Or click pages. Picked: {picked.size}
                  </small>
                )}
              </>
            )}
            {splitMode === "each" && (
              <small className="muted">
                Every page becomes its own PDF, saved in one zip.
              </small>
            )}
          </>
        );
      case "compress":
        return (
          <>
            <Seg<typeof level>
              label="Compression"
              options={[
                ["light", "Light"],
                ["strong", "Strong"],
                ["max", "Smallest"],
              ]}
              value={level}
              onPick={(v) => {
                setLevel(v);
                setTarget(null);
                reset();
              }}
            />
            <div className="ctl">
              <span className="lbl">Or fit under a size</span>
              <div className="chips">
                {[null, 100, 200, 500, 1024, 2048].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    aria-pressed={target === v}
                    onClick={() => {
                      setTarget(v);
                      reset();
                    }}
                  >
                    {v ? (v >= 1024 ? `${v / 1024} MB` : `${v} KB`) : "Off"}
                  </button>
                ))}
              </div>
            </div>
            <small className="muted">
              Pages are redrawn as images, which shrinks scans and photos a lot.
              Text can't be selected afterwards.
            </small>
          </>
        );
      case "grayscale":
        return (
          <small className="muted">
            Every page is redrawn in black and white. Good for printing and
            smaller files. Text can't be selected afterwards.
          </small>
        );
      case "to-image":
        return (
          <>
            <Seg<typeof imgType>
              label="Save pages as"
              options={[
                ["image/jpeg", "JPG"],
                ["image/png", "PNG"],
              ]}
              value={imgType}
              onPick={(v) => {
                setImgType(v);
                reset();
              }}
            />
            <Seg<number>
              label="Quality"
              options={[
                [72, "Screen (72 dpi)"],
                [150, "Good (150)"],
                [300, "Print (300)"],
              ]}
              value={dpi}
              onPick={(v) => {
                setDpi(v);
                reset();
              }}
            />
            {advanced && (
              <small className="muted">
                {PICK[tool]} Picked: {picked.size}
              </small>
            )}
          </>
        );
      case "to-text":
        return (
          <small className="muted">
            Copies the text layer. Scanned pages (pictures of text) have none;
            they'd need OCR.
          </small>
        );
      case "page-numbers": {
        const put = (p: Partial<NumberOpts>) => {
          setNum((n) => ({ ...n, ...p }));
          reset();
        };
        return (
          <>
            <div className="ctl">
              <span className="lbl">Position</span>
              <div className="spots six" role="group" aria-label="Position">
                {(["tl", "tc", "tr", "bl", "bc", "br"] as Corner[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={num.pos === c}
                    onClick={() => put({ pos: c })}
                  />
                ))}
              </div>
            </div>
            <Seg<NumberOpts["format"]>
              label="Format"
              options={[
                ["n", "1"],
                ["page-n", "Page 1"],
                ["n-of", "1 / 9"],
                ["page-n-of", "Page 1 of 9"],
              ]}
              value={num.format}
              onPick={(v) => put({ format: v })}
            />
            <div className="ctl">
              <label htmlFor="pn-start">Start at</label>
              <input
                id="pn-start"
                className="num"
                type="number"
                min={0}
                value={num.start}
                onChange={(e) =>
                  put({ start: Math.max(0, +e.target.value || 0) })
                }
              />
            </div>
            <Slider
              label="Size"
              value={num.size}
              min={7}
              max={24}
              unit=" pt"
              onChange={(v) => put({ size: v })}
            />
            <Toggle
              label="Skip the first page (cover)"
              on={num.skipFirst}
              onChange={(v) => put({ skipFirst: v })}
            />
          </>
        );
      }
      case "watermark": {
        const put = (p: Partial<WatermarkOpts>) => {
          setWm((w) => ({ ...w, ...p }));
          reset();
        };
        return (
          <>
            <div className="ctl">
              <label htmlFor="wm-text">Text</label>
              <input
                id="wm-text"
                className="num"
                value={wm.text}
                onChange={(e) => put({ text: e.target.value })}
              />
            </div>
            <Seg<boolean>
              label="Layout"
              options={[
                [false, "Once, centred"],
                [true, "Repeat across"],
              ]}
              value={wm.tile}
              onPick={(v) => put({ tile: v, size: v ? 5 : 9 })}
            />
            <Seg<number>
              label="Angle"
              options={[
                [0, "Flat"],
                [45, "Diagonal"],
                [90, "Upright"],
              ]}
              value={wm.angle}
              onPick={(v) => put({ angle: v })}
            />
            <Slider
              label="Size"
              value={wm.size}
              min={2}
              max={25}
              unit="%"
              onChange={(v) => put({ size: v })}
            />
            <Slider
              label="Opacity"
              value={wm.opacity}
              min={5}
              unit="%"
              onChange={(v) => put({ opacity: v })}
            />
            <Colors
              label="Colour"
              value={wm.color}
              onPick={(v) => put({ color: v })}
              list={["#e5484d", "#000000", "#8a8f98", "#0057ff", "#30a46c"]}
            />
          </>
        );
      }
      case "metadata":
        return (
          <>
            <Toggle
              label="Remove all document info"
              on={metaStrip}
              onChange={(v) => {
                setMetaStrip(v);
                reset();
              }}
            />
            {!metaStrip && meta && (
              <>
                {(
                  [
                    "title",
                    "author",
                    "subject",
                    "keywords",
                    "creator",
                    "producer",
                  ] as (keyof Meta)[]
                ).map((k) => (
                  <div className="ctl" key={k}>
                    <label htmlFor={`m-${k}`}>
                      {k[0]!.toUpperCase() + k.slice(1)}
                    </label>
                    <input
                      id={`m-${k}`}
                      className="num"
                      value={meta[k]}
                      onChange={(e) => {
                        setMeta({ ...meta, [k]: e.target.value });
                        reset();
                      }}
                    />
                  </div>
                ))}
                {docs.length > 1 && (
                  <small className="muted">
                    These fields come from the first file and are written to
                    every file.
                  </small>
                )}
              </>
            )}
          </>
        );
      default:
        return null;
    }
  }

  const actionLabel: Record<string, string> = {
    merge: `Merge ${docs.length > 1 ? `${docs.length} PDFs` : "PDF"}`,
    organize: "Save PDF",
    "remove-pages": "Remove pages",
    rotate: "Rotate",
    split: "Split",
    compress: "Compress",
    grayscale: "Make black and white",
    "to-image": "Convert to images",
    "to-text": "Extract text",
    "page-numbers": "Add page numbers",
    watermark: "Add watermark",
    metadata: metaStrip ? "Remove info" : "Save info",
  };

  return (
    <>
      <div className={`toolcard pdfcard${advanced ? " adv" : ""}`}>
        <div className={`stage pdf-stage${dragging ? " over" : ""}`}>
          {advanced ? (
            <>
              {pickHint && <p className="pg-hint">{pickHint}</p>}
              {pageGrid}
              <div className="filebar">
                <button type="button" className="fchip add" onClick={pick}>
                  + Add PDF
                </button>
              </div>
            </>
          ) : (
            fileList
          )}
        </div>
        <div className="controls">
          {controls()}
          <div className={`result${busy ? " working" : ""}`} aria-live="polite">
            <small>
              {docs.length} file{docs.length > 1 ? "s" : ""}, {pages.length}{" "}
              page{pages.length === 1 ? "" : "s"}, {formatBytes(totalIn)}
            </small>
            {outs && (
              <div className="sz">
                <b>{formatBytes(totalOut)}</b>
                {(tool === "compress" || tool === "grayscale") && (
                  <span className={`delta${totalOut > totalIn ? " up" : ""}`}>
                    {totalOut <= totalIn
                      ? `${Math.round((1 - totalOut / totalIn) * 100)}% smaller`
                      : `${Math.round((totalOut / totalIn - 1) * 100)}% larger`}
                  </span>
                )}
              </div>
            )}
            {outs && outs.length > 1 && <small>{outs.length} files</small>}
            {outs &&
              target &&
              tool === "compress" &&
              totalOut > target * 1024 && (
                <small className="warn">
                  Couldn't get under the limit even at the lowest setting. This
                  is the smallest version.
                </small>
              )}
            {outs && tool === "compress" && totalOut > totalIn && (
              <small className="warn">
                This PDF is already well compressed. Keep your original.
              </small>
            )}
            {busy && <small>{busy}</small>}
            <div className="acts">
              {!outs ? (
                <button
                  type="button"
                  className="btn acc"
                  disabled={!!busy || !pages.length}
                  onClick={() => void run()}
                >
                  <Icon name={tool === "to-text" ? "type" : "zap"} />
                  {busy ? "Working…" : (actionLabel[tool] ?? "Save")}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn acc"
                  onClick={() => void downloadAll()}
                >
                  <Icon name="download" />
                  {outs.length > 1
                    ? `Download ${outs.length} files (zip)`
                    : "Download"}
                </button>
              )}
              {outs && outs.length > 1 && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={async () => {
                    for (const o of outs) {
                      downloadBlob(o.blob, o.name);
                      await new Promise((r) => setTimeout(r, 300));
                    }
                  }}
                >
                  Save each separately
                </button>
              )}
              {text !== null && (
                <CopyBtn text={text} label="Copy text" what="Text copied" />
              )}
              <button
                type="button"
                className="advlink"
                onClick={() => setMode(!advanced)}
              >
                <Icon name="sliders" />
                {advanced ? "Back to Simple" : "See every page in Advanced"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {text !== null && (
        <textarea
          className="num code-in pdf-text"
          readOnly
          value={text}
          rows={14}
          aria-label="Extracted text"
        />
      )}
      {input}
    </>
  );
}
