import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { zipSync } from "fflate";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import type { IconKey } from "@kmra/ui/lib/icons";
import { downloadBlob, formatBytes } from "@kmra/ui/lib/files";
import { takeFiles } from "@kmra/ui/lib/handoff";
import { toast } from "@kmra/ui/lib/toast";
import { engine, type EncodeResult } from "../lib/engine";
import CropBox from "./CropBox";
import {
  applyPreset,
  applySize,
  baseDims,
  centeredCrop,
  defaults,
  EXT,
  FORMATS,
  isLossy,
  outDims,
  outType,
  RATIOS,
  SIZES,
  TARGETS,
  type Format,
  type Settings,
} from "../lib/settings";

export interface ToolMeta {
  slug: string;
  name: string;
  icon: IconKey;
  ready: boolean;
}

interface Props {
  /** Tool slug, or "editor" for the all-in-one editor page (workspace only) */
  tool: string;
  preset?: Preset;
  /** All tools of this app, for the workspace rail */
  tools: ToolMeta[];
}

interface Item {
  key: string;
  file: File;
  url: string;
  w: number;
  h: number;
}

interface Out extends EncodeResult {
  key: string;
  url: string;
}

const MODE_KEY = "kmra-mode";
/** Which workspace section each tool highlights */
const SECTION: Record<string, string> = {
  compress: "compress",
  convert: "format",
  resize: "resize",
  crop: "crop",
  rotate: "rotate",
  "strip-metadata": "privacy",
};

function outName(file: File, type: string): string {
  const base = file.name.replace(/\.[^.]+$/, "");
  return `${base}-kmra.${EXT[type as Format] ?? "img"}`;
}

export default function ImageTool({ tool, preset, tools }: Props) {
  const editor = tool === "editor";
  const [items, setItems] = useState<Item[]>([]);
  const [cur, setCur] = useState(0);
  const [s, setS] = useState<Settings>(() =>
    applyPreset(defaults(tool), preset),
  );
  const [out, setOut] = useState<Out | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(editor);
  const [focus, setFocus] = useState(tool);
  const [cut, setCut] = useState(50);
  const [zipping, setZipping] = useState(false);
  const [dragging, setDragging] = useState(false);

  const pickRef = useRef<HTMLInputElement>(null);
  const reqRef = useRef(0);
  const outRef = useRef<Out | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  /** Advanced is the chosen mode (shown on the page's Simple/Advanced switch) */
  const [wantAdvanced, setWantAdvanced] = useState(false);
  /** Open the workspace as soon as files arrive */
  const openOnFiles = useRef(false);

  const item = items[cur];
  const set = (patch: Partial<Settings>) => setS((p) => ({ ...p, ...patch }));

  /* ---------- Files ---------- */
  const addFiles = useCallback(async (list: FileList | File[]) => {
    const files = [...list].filter((f) => f.type.startsWith("image/"));
    if (!files.length) {
      toast("That isn't an image. Try JPEG, PNG, WebP, GIF or AVIF.");
      return;
    }
    const added: Item[] = [];
    for (const file of files) {
      const key = crypto.randomUUID();
      try {
        const { w, h } = await engine.load(key, file);
        added.push({ key, file, url: URL.createObjectURL(file), w, h });
      } catch {
        toast(
          `${file.name} couldn't be opened. It may be damaged or in a format your browser can't read.`,
        );
      }
    }
    if (!added.length) return;
    setCur(itemsRef.current.length);
    setItems((prev) => [...prev, ...added]);
  }, []);

  function removeItem(i: number) {
    const it = items[i];
    if (!it) return;
    URL.revokeObjectURL(it.url);
    void engine.drop(it.key);
    setItems((prev) => prev.filter((_, j) => j !== i));
    setCur((c) => Math.max(0, c >= i ? c - 1 : c));
  }

  async function addSample() {
    await addFiles([await engine.sample()]);
  }

  // Files handed over from the landing page, or ?sample
  useEffect(() => {
    try {
      if (!editor && localStorage.getItem(MODE_KEY) === "advanced") {
        setWantAdvanced(true);
        // Reopen the workspace by itself only on wide screens; on phones Simple fits better.
        openOnFiles.current = matchMedia("(min-width: 981px)").matches;
      }
    } catch {}
    void (async () => {
      const handed = await takeFiles();
      if (handed.length) await addFiles(handed);
      else if (new URLSearchParams(location.search).has("sample"))
        await addSample();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open the workspace once files arrive, if Advanced was chosen
  useEffect(() => {
    if (items.length && openOnFiles.current) {
      openOnFiles.current = false;
      setAdvanced(true);
    }
  }, [items.length]);

  // Drop anywhere, paste anywhere
  useEffect(() => {
    const onOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      setDragging(false);
      void addFiles(e.dataTransfer.files);
    };
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) void addFiles(files);
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [addFiles]);

  // A ratio preset (e.g. "Crop to square") becomes a centred crop once the image size is known.
  useEffect(() => {
    if (!item || !s.ratio || s.crop) return;
    const r = RATIOS.find((x) => x.id === s.ratio);
    if (r) setS((p) => ({ ...p, crop: centeredCrop(item.w, item.h, r.r) }));
  }, [item, s.ratio, s.crop]);

  /* ---------- Processing ---------- */
  useEffect(() => {
    if (!item) return;
    const id = ++reqRef.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await engine.encode(item.key, item.file.type, s);
        if (id !== reqRef.current) return;
        const next = { ...r, key: item.key, url: URL.createObjectURL(r.blob) };
        const old = outRef.current;
        outRef.current = next;
        setOut(next);
        if (old) URL.revokeObjectURL(old.url);
        setError(null);
      } catch {
        if (id === reqRef.current)
          setError(
            "Processing failed. The image may be too large for this device's memory.",
          );
      } finally {
        if (id === reqRef.current) setBusy(false);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [item, s]);

  /* ---------- Mode ---------- */
  function openAdvanced() {
    setWantAdvanced(true);
    try {
      localStorage.setItem(MODE_KEY, "advanced");
    } catch {}
    // With files, switch now; without, the choice is remembered and applied when files arrive.
    if (items.length) setAdvanced(true);
    else openOnFiles.current = true;
  }
  function closeAdvanced() {
    // The editor page is the workspace itself; leaving it goes home.
    if (editor) {
      window.location.href = "/";
      return;
    }
    setAdvanced(false);
    setWantAdvanced(false);
    openOnFiles.current = false;
    try {
      localStorage.setItem(MODE_KEY, "simple");
    } catch {}
  }
  useEffect(() => {
    document.body.style.overflow = advanced ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [advanced]);

  // The Simple/Advanced switch in the page header lives outside this island: it sends
  // kmra:advanced / kmra:simple, and we report the current mode back with kmra:mode.
  useEffect(() => {
    const open = () => openAdvanced();
    const close = () => closeAdvanced();
    window.addEventListener("kmra:advanced", open);
    window.addEventListener("kmra:simple", close);
    return () => {
      window.removeEventListener("kmra:advanced", open);
      window.removeEventListener("kmra:simple", close);
    };
  });
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("kmra:mode", {
        detail: { advanced: wantAdvanced || advanced },
      }),
    );
  }, [wantAdvanced, advanced]);

  /* ---------- Download ---------- */
  async function download() {
    if (!items.length) return;
    if (items.length === 1) {
      if (out && item && out.key === item.key)
        downloadBlob(out.blob, outName(item.file, out.type));
      return;
    }
    setZipping(true);
    try {
      const entries: Record<string, Uint8Array> = {};
      for (const it of items) {
        const r = await engine.encode(it.key, it.file.type, s);
        let name = outName(it.file, r.type);
        for (let n = 2; entries[name]; n++)
          name = name.replace(/(\.\w+)$/, `-${n}$1`);
        entries[name] = new Uint8Array(await r.blob.arrayBuffer());
      }
      // Images are already compressed, so store them without deflating again.
      const zip = zipSync(entries, { level: 0 });
      downloadBlob(
        new Blob([zip], { type: "application/zip" }),
        "kmra-images.zip",
      );
    } catch {
      toast("Couldn't build the zip. Try fewer or smaller images.");
    } finally {
      setZipping(false);
    }
  }

  /* ---------- Shared pieces ---------- */
  const fileInput = (
    <input
      ref={pickRef}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(e) => {
        if (e.target.files) void addFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );

  const outForItem = out && item && out.key === item.key ? out : null;
  const type = item ? outType(item.file.type, s) : s.type;

  function compare(it: Item) {
    const solo = outForItem
      ? Math.abs(outForItem.w / outForItem.h - it.w / it.h) > 0.01
      : false;
    return (
      <div
        className={`cmp${solo ? " solo" : ""}`}
        style={{ "--cut": `${cut}%` } as CSSProperties}
      >
        <img src={it.url} alt={`Original: ${it.file.name}`} />
        <img className="after" src={outForItem?.url ?? it.url} alt="Result" />
        <div className="line" />
        <span className="lab" style={{ left: 10 }}>
          Original
        </span>
        <span className="lab" style={{ right: 10 }}>
          {outForItem
            ? `${FORMATS[outForItem.type as Format]} ${formatBytes(outForItem.blob.size)}`
            : "Result"}
        </span>
        <input
          type="range"
          min={2}
          max={98}
          value={cut}
          onChange={(e) => setCut(+e.target.value)}
          aria-label="Drag to compare original and result"
        />
      </div>
    );
  }

  function seg<T extends string | boolean>(
    options: [T, string][],
    value: T,
    onPick: (v: T) => void,
    label: string,
  ) {
    return (
      <div className="seg" role="group" aria-label={label}>
        {options.map(([v, l]) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={v === value}
            onClick={() => onPick(v)}
          >
            {l}
          </button>
        ))}
      </div>
    );
  }

  const qualityCtl = (id: string) =>
    isLossy(type) ? (
      <div className="ctl">
        <label htmlFor={id}>
          Quality <span>{s.target ? "Auto" : s.quality}</span>
        </label>
        <input
          id={id}
          type="range"
          min={5}
          max={100}
          value={s.quality}
          disabled={!!s.target}
          onChange={(e) => set({ quality: +e.target.value })}
        />
      </div>
    ) : (
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        PNG is lossless, so there's no quality setting. Pick JPEG or WebP for
        smaller files.
      </p>
    );

  const targetCtl = (short = false) => (
    <div className="ctl">
      <span className="lbl">Exact size</span>
      <div className="chips">
        {[null, ...TARGETS].map((v) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={s.target === v}
            onClick={() => set({ target: v })}
          >
            {v
              ? `${short ? "≤" : "Under"} ${v} KB`
              : short
                ? "Any size"
                : "Off"}
          </button>
        ))}
      </div>
    </div>
  );

  function setDim(k: "w" | "h", raw: string) {
    const v = raw ? Math.max(1, Math.round(+raw)) : null;
    const patch: Partial<Settings> = { [k]: v, size: null };
    if (s.lock && v && item) {
      const other = k === "w" ? "h" : "w";
      patch[other] =
        k === "w"
          ? Math.round((v * item.h) / item.w)
          : Math.round((v * item.w) / item.h);
    }
    set(patch);
  }

  const dimsCtl = item && (
    <>
      <div className="ctl">
        <span className="lbl">Size in pixels</span>
        <div className="row2">
          <input
            className="num"
            type="number"
            min={1}
            placeholder={String(item.w)}
            value={s.w ?? ""}
            onChange={(e) => setDim("w", e.target.value)}
            aria-label="Width in pixels"
          />
          <button
            type="button"
            className="lockbtn"
            aria-pressed={s.lock}
            aria-label="Keep aspect ratio"
            title="Keep aspect ratio"
            onClick={() => set({ lock: !s.lock, size: null })}
          >
            <Icon name="lock" />
          </button>
          <input
            className="num"
            type="number"
            min={1}
            placeholder={String(item.h)}
            value={s.h ?? ""}
            onChange={(e) => setDim("h", e.target.value)}
            aria-label="Height in pixels"
          />
        </div>
      </div>
      <div className="ctl">
        <span className="lbl">Presets</span>
        <div className="chips">
          {SIZES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={s.size === p.id}
              onClick={() => setS((prev) => applySize(prev, p.id))}
            >
              {p.label}
            </button>
          ))}
          {(s.w || s.h || s.size) && (
            <button
              type="button"
              onClick={() => set({ w: null, h: null, size: null, lock: true })}
            >
              Original size
            </button>
          )}
        </div>
      </div>
    </>
  );

  const formatOpts = (withOriginal: boolean): [string, string][] => [
    ...(withOriginal ? ([["keep", "Original"]] as [string, string][]) : []),
    ["image/jpeg", "JPEG"],
    ["image/png", "PNG"],
    ["image/webp", "WebP"],
  ];
  const formatValue = s.keepFormat ? "keep" : s.type;
  const pickFormat = (v: string) =>
    v === "keep"
      ? set({ keepFormat: true })
      : set({ keepFormat: false, type: v as Format });

  function pickRatio(id: string | null) {
    const r = RATIOS.find((x) => x.id === id);
    set({
      ratio: id,
      crop: r && item ? centeredCrop(item.w, item.h, r.r) : null,
    });
  }

  const cropCtl = (
    <div className="ctl">
      <span className="lbl">Aspect ratio</span>
      <div className="chips">
        <button
          type="button"
          aria-pressed={s.ratio === null}
          onClick={() => pickRatio(null)}
        >
          Free
        </button>
        {RATIOS.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={s.ratio === r.id}
            onClick={() => pickRatio(r.id)}
          >
            {r.label}
          </button>
        ))}
        {s.crop && (
          <button
            type="button"
            onClick={() => set({ crop: null, ratio: null })}
          >
            Reset
          </button>
        )}
      </div>
      <small className="muted" style={{ display: "block", marginTop: 8 }}>
        Drag the frame on the image, or use the corners to resize.
      </small>
    </div>
  );

  const turn = (by: 90 | -90) =>
    set({
      rotate: ((((s.rotate + by) % 360) + 360) % 360) as Settings["rotate"],
    });
  const rotateCtl = (
    <div className="ctl">
      <span className="lbl">
        Rotate and flip <span>{s.rotate}°</span>
      </span>
      <div className="tbtns">
        <button type="button" className="btn sm" onClick={() => turn(-90)}>
          <Icon name="rotate" />
          Left
        </button>
        <button type="button" className="btn sm" onClick={() => turn(90)}>
          <Icon name="rotateRight" />
          Right
        </button>
        <button
          type="button"
          className="btn sm"
          aria-pressed={s.flipH}
          onClick={() => set({ flipH: !s.flipH })}
        >
          <Icon name="flipH" />
          Flip ↔
        </button>
        <button
          type="button"
          className="btn sm"
          aria-pressed={s.flipV}
          onClick={() => set({ flipV: !s.flipV })}
        >
          <Icon name="flipV" />
          Flip ↕
        </button>
      </div>
    </div>
  );

  const saveAsCtl = (
    <div className="ctl">
      <span className="lbl">Save as</span>
      {seg<string>(formatOpts(true), formatValue, pickFormat, "Save as")}
    </div>
  );

  function simpleControls(): ReactNode {
    switch (tool) {
      case "compress":
        return (
          <>
            <div className="ctl">
              <span className="lbl">Format</span>
              {seg<string>(
                [
                  ["image/jpeg", "JPEG"],
                  ["image/webp", "WebP"],
                ],
                s.type,
                (v) => set({ type: v as Format, keepFormat: false }),
                "Format",
              )}
            </div>
            {qualityCtl("q")}
            {targetCtl()}
          </>
        );
      case "convert":
        return (
          <>
            <div className="ctl">
              <span className="lbl">Convert to</span>
              {seg<string>(
                formatOpts(false),
                s.type,
                (v) => set({ type: v as Format, keepFormat: false }),
                "Convert to",
              )}
            </div>
            {qualityCtl("q")}
          </>
        );
      case "resize":
        return (
          <>
            {dimsCtl}
            <div className="ctl">
              <span className="lbl">Save as</span>
              {seg<string>(
                formatOpts(true),
                formatValue,
                pickFormat,
                "Save as",
              )}
            </div>
          </>
        );
      case "strip-metadata":
        return (
          <>
            <p className="muted" style={{ margin: 0 }}>
              kmra rebuilds the image from its pixels. Location, camera model,
              date and other hidden data are left out.
            </p>
            <div className="ctl">
              <span className="lbl">Save as</span>
              {seg<string>(
                formatOpts(true),
                formatValue,
                pickFormat,
                "Save as",
              )}
            </div>
          </>
        );
      case "crop":
        return (
          <>
            {cropCtl}
            {saveAsCtl}
          </>
        );
      case "rotate":
        return (
          <>
            {rotateCtl}
            {saveAsCtl}
          </>
        );
      default:
        return null;
    }
  }

  /** Crop tool (or Crop focused in the workspace) shows the crop frame instead of the comparison. */
  const showCrop =
    tool === "crop"
      ? !advanced || focus === "crop"
      : advanced && focus === "crop";
  function stageContent(it: Item) {
    if (!showCrop) return compare(it);
    const r = RATIOS.find((x) => x.id === s.ratio);
    return (
      <CropBox
        url={it.url}
        alt={`Crop ${it.file.name}`}
        crop={s.crop}
        ratio={r ? r.r : null}
        srcW={it.w}
        srcH={it.h}
        onChange={(crop) => set({ crop })}
      />
    );
  }

  function resultSummary() {
    if (error) return <small className="warn">{error}</small>;
    if (!item) return <small>Add an image to see the result.</small>;
    if (!outForItem) return <small>Working…</small>;
    const pct = Math.round((1 - outForItem.blob.size / item.file.size) * 100);
    return (
      <>
        <small>{formatBytes(item.file.size)} to</small>
        <div className="sz">
          <b>{formatBytes(outForItem.blob.size)}</b>
          {pct >= 0 ? (
            <span className="delta">{pct}% smaller</span>
          ) : (
            <span className="delta up">{-pct}% larger</span>
          )}
        </div>
        <small>
          {outForItem.w} × {outForItem.h}, {FORMATS[outForItem.type as Format]}
        </small>
        {outForItem.over ? (
          <small className="warn">
            Can't get under {s.target} KB at this size. Make the image smaller
            in Advanced.
          </small>
        ) : s.target && isLossy(type) ? (
          <small>Best quality that fits: {outForItem.q}</small>
        ) : null}
      </>
    );
  }

  const downloadLabel = zipping
    ? "Preparing zip…"
    : items.length > 1
      ? `Download all ${items.length} as zip`
      : "Download";

  /* ---------- Empty state ---------- */
  const emptyState = (
    <div className="dropcard lg">
      <div
        className={`dropzone${dragging ? " over" : ""}`}
        onClick={() => pickRef.current?.click()}
      >
        <div className="big">
          <Icon name="upload" />
        </div>
        <strong>Drop images here</strong>
        <span className="muted">or paste with ⌘V. Nothing is uploaded.</span>
        <div className="row">
          <button
            className="btn acc lg"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              pickRef.current?.click();
            }}
          >
            <Icon name="upload" />
            Choose images
          </button>
        </div>
        <div className="formats">
          {["JPG", "PNG", "WebP", "GIF", "AVIF"].map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
        {wantAdvanced && (
          <span className="mode-note">
            <Icon name="sliders" />
            Opens in the Advanced workspace
          </span>
        )}
        {fileInput}
      </div>
    </div>
  );
  if (!items.length && !advanced) return emptyState;

  /* ---------- Simple mode ---------- */
  const simple = (
    <div className="toolcard">
      <div className={`stage${dragging ? " over" : ""}`}>
        {item && stageContent(item)}
        <div className="filebar">
          {items.map((it, i) => (
            <button
              key={it.key}
              type="button"
              className="fchip"
              aria-pressed={i === cur}
              onClick={() => setCur(i)}
            >
              <img src={it.url} alt="" />
              <span>{it.file.name}</span>
            </button>
          ))}
          <button
            type="button"
            className="fchip add"
            onClick={() => pickRef.current?.click()}
          >
            + Add
          </button>
        </div>
      </div>
      <div className="controls">
        {simpleControls()}
        <div className={`result${busy ? " working" : ""}`} aria-live="polite">
          {resultSummary()}
          <div className="acts">
            <button
              className="btn acc"
              type="button"
              onClick={() => void download()}
              disabled={busy || zipping || !outForItem}
            >
              <Icon name="download" />
              {downloadLabel}
            </button>
            <button className="advlink" type="button" onClick={openAdvanced}>
              <Icon name="sliders" />
              More options in Advanced
            </button>
          </div>
        </div>
      </div>
      {fileInput}
    </div>
  );

  if (!advanced) return simple;

  /* ---------- Advanced workspace ---------- */
  const section = (
    key: string,
    title: string,
    icon: IconKey,
    body: ReactNode,
  ) => (
    <section
      id={`ws-${key}`}
      className={SECTION[focus] === key ? "focus" : undefined}
    >
      <h3>
        <Icon name={icon} />
        {title}
      </h3>
      {body}
    </section>
  );

  const [ow, oh] = item ? outDims(item.w, item.h, s) : [0, 0];
  const [bw, bh] = item ? baseDims(item.w, item.h, s) : [0, 0];
  const recipe = [
    s.crop
      ? `Crop ${Math.round(s.crop.w * (item?.w ?? 0))} × ${Math.round(s.crop.h * (item?.h ?? 0))}`
      : null,
    s.rotate ? `Rotate ${s.rotate}°` : null,
    s.flipH || s.flipV ? "Flip" : null,
    item && (ow !== bw || oh !== bh) ? `Resize ${ow} × ${oh}` : null,
    isLossy(type)
      ? s.target
        ? `Fit ≤ ${s.target} KB`
        : `Quality ${s.quality}`
      : null,
    FORMATS[type],
    "Strip metadata",
  ].filter(Boolean) as string[];

  return (
    <>
      {items.length ? simple : emptyState}
      <div
        className="ws"
        role="dialog"
        aria-modal="true"
        aria-label="Advanced workspace"
      >
        <div className="ws-top">
          <button className="btn sm" type="button" onClick={closeAdvanced}>
            <Icon name="back" />
            <span className="hide-sm">{editor ? "Home" : "Simple mode"}</span>
          </button>
          <span className="title">
            {editor ? "Image editor" : "Workspace"}{" "}
            <small>
              {items.length
                ? `${items.length} file${items.length > 1 ? "s" : ""}`
                : "No files yet"}
            </small>
          </span>
          <span className="right">
            <button
              className="btn sm hide-sm"
              type="button"
              onClick={() => pickRef.current?.click()}
            >
              <Icon name="upload" />
              Add files
            </button>
            <button
              className="btn sm acc"
              type="button"
              onClick={() => void download()}
              disabled={busy || zipping || !outForItem}
            >
              <Icon name="download" />
              {zipping
                ? "Preparing…"
                : items.length > 1
                  ? `Download ${items.length}`
                  : "Download"}
            </button>
          </span>
        </div>

        <div className="ws-body">
          <div className="rail" aria-label="Tools">
            {tools.map((t) => (
              <button
                key={t.slug}
                type="button"
                title={t.ready ? t.name : `${t.name} (coming soon)`}
                aria-label={t.name}
                aria-pressed={focus === t.slug}
                disabled={!t.ready}
                onClick={() => {
                  setFocus(t.slug);
                  document
                    .getElementById(`ws-${SECTION[t.slug]}`)
                    ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }}
              >
                <Icon name={t.icon} />
              </button>
            ))}
          </div>

          <div className="ws-center">
            <div className={`stage${dragging ? " over" : ""}`}>
              {item ? (
                stageContent(item)
              ) : (
                <button
                  type="button"
                  className="ws-empty"
                  onClick={() => pickRef.current?.click()}
                >
                  <span className="big">
                    <Icon name="upload" />
                  </span>
                  <strong>Drop images to start</strong>
                  <span className="muted">
                    Or click to choose files, or paste with ⌘V. Settings apply
                    to every file.
                  </span>
                </button>
              )}
            </div>
            <div className="queue">
              {items.map((it, i) => (
                <span
                  key={it.key}
                  style={{ display: "flex", gap: 4, alignItems: "center" }}
                >
                  <button
                    type="button"
                    className="fchip"
                    aria-pressed={i === cur}
                    onClick={() => setCur(i)}
                  >
                    <img src={it.url} alt="" />
                    <span>
                      {it.file.name}
                      <small>
                        {formatBytes(it.file.size)}, {it.w} × {it.h}
                      </small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    style={{ width: 28, height: 28 }}
                    aria-label={`Remove ${it.file.name}`}
                    onClick={() => removeItem(i)}
                  >
                    <Icon name="x" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="fchip add"
                onClick={() => pickRef.current?.click()}
              >
                + Add
              </button>
            </div>
          </div>

          <div className="insp">
            {section("crop", "Crop", "crop", cropCtl)}
            {section("rotate", "Rotate & flip", "rotate", rotateCtl)}
            {section("resize", "Resize", "resize", dimsCtl)}
            {section(
              "format",
              "Format",
              "convert",
              seg<string>(
                formatOpts(true),
                formatValue,
                pickFormat,
                "Output format",
              ),
            )}
            {section(
              "compress",
              "Compression",
              "compress",
              <>
                {qualityCtl("wq")}
                {isLossy(type) && targetCtl(true)}
              </>,
            )}
            {section(
              "privacy",
              "Privacy",
              "shield",
              <small className="muted">
                Location, camera and date data are always removed from the
                output.
              </small>,
            )}
            <section>
              <h3>Result</h3>
              <div
                className={`result${busy ? " working" : ""}`}
                style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}
                aria-live="polite"
              >
                {resultSummary()}
              </div>
            </section>
            <section>
              <h3>Recipe</h3>
              <div className="recipe">
                {recipe.map((step, i) => (
                  <span key={step} style={{ display: "contents" }}>
                    {i > 0 && <i>then</i>}
                    <span>{step}</span>
                  </span>
                ))}
              </div>
              <small className="muted">
                Applied to every file. Saving recipes is coming soon.
              </small>
            </section>
          </div>
        </div>

        <div className="ws-status">
          <span>
            <b>●</b> Processing on this device
          </span>
          <span>0 bytes uploaded</span>
          <span>{items.length} in batch</span>
        </div>
      </div>
    </>
  );
}
