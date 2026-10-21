import { LangProvider, useT } from "@kmra/ui/lib/i18n-react";
import { num, type Locale } from "@kmra/ui/lib/i18n";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { stripMetadata, type Removed } from "../lib/strip";
import { readSummary, type MetaSummary } from "../lib/meta";
import { zipSync } from "fflate";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import type { IconKey } from "@kmra/ui/lib/icons";
import {
  downloadBlob,
  formatBytes,
  IMAGE_ACCEPT,
  isImageFile,
  tagged,
  toolName,
} from "@kmra/ui/lib/files";
import { takeFiles } from "@kmra/ui/lib/handoff";
import { toast } from "@kmra/ui/lib/toast";
import {
  formatKeys,
  isTouch,
  matches,
  pasteHint,
  typing,
} from "@kmra/ui/lib/keys";
import { engine, type EncodeResult } from "../lib/engine";
import CropBox from "./CropBox";
import RegionBox from "./RegionBox";
import {
  AdjustCtl,
  BgCtl,
  FilterCtl,
  FrameCtl,
  InkCtl,
  MarkCtl,
  PassportCtl,
  RedactCtl,
  Seg,
  SheetCtl,
  TextCtl,
} from "./FxControls";
import { FILTERS, NO_ADJUST, NO_FRAME, SHEETS } from "../lib/fx";
import {
  applyForm,
  applyPreset,
  applySize,
  baseDims,
  centeredCrop,
  defaults,
  EXT,
  FORM_PRESETS,
  FORMATS,
  hasGeometry,
  onlyEncodes,
  isLossy,
  formatOf,
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
  /** Interface language for the main labels (Bangla pages pass "bn") */
  lang?: "en" | "bn";
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
  /** Compress kept the original file because re-encoding made it bigger */
  kept?: boolean;
  /** Strip metadata cut the metadata out without re-encoding the image */
  lossless?: boolean;
  /** What that removed */
  removed?: Removed[];
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
  "form-size": "resize",
  adjust: "look",
  filters: "look",
  "add-text": "text",
  watermark: "watermark",
  border: "frame",
  "extend-canvas": "frame",
  beautify: "frame",
  blur: "redact",
  "face-blur": "redact",
  signature: "signature",
  "remove-bg": "background",
  "change-bg": "background",
  "passport-photo": "passport",
};
const FRAME_MODE: Record<string, "border" | "extend" | "beautify"> = {
  border: "border",
  "extend-canvas": "extend",
  beautify: "beautify",
};

/** SVGs are drawn on the page (workers can't decode them) at a generous size, then handled as PNGs. */
async function rasterizeSvg(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth || 512;
    const h = img.naturalHeight || 512;
    const long = Math.max(w, h);
    const scale = Math.min(4096, Math.max(2048, long)) / long;
    const c = document.createElement("canvas");
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error("SVG"))), "image/png"),
    );
    return new File([blob], file.name.replace(/\.svgz?$/i, "") + ".png", {
      type: "image/png",
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
const isSvg = (f: File) =>
  f.type === "image/svg+xml" || /\.svgz?$/i.test(f.name);

/** Formats the original file can be handed back in (HEIC and the like are always converted) */
const KEEPABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

/** "photo.jpg" from Compress → "photo-compress-kmra.jpg" */
function outName(file: File, type: string, tool: string): string {
  return tagged(`${toolName(file.name, tool === "editor" ? "edit" : tool)}.${EXT[type as Format] ?? "img"}`);
}

function ImageToolView({ tool, preset, tools, lang = "en" }: Props) {
  const T = useT();
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
  /** Zoom factor (1 = 100%, one image pixel per screen pixel), or null to fit the view */
  const [zoom, setZoom] = useState<number | null>(null);
  const shownRef = useRef<HTMLImageElement | null>(null);
  /** Shortcut labels for this OS (⌘ on Apple devices, Ctrl elsewhere); set after mount */
  const [keys, setKeys] = useState({
    paste: "⌘V",
    mod: "⌘",
    hint: T("or paste with ⌘V. Your files stay on your device."),
    touch: false,
  });
  useEffect(
    () =>
      setKeys({
        paste: formatKeys("mod+V"),
        mod: formatKeys("mod"),
        hint: pasteHint(lang),
        touch: isTouch(),
      }),
    [],
  );
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
    const files = [...list].filter(isImageFile);
    if (!files.length) {
      toast(T("That isn't an image. Try JPEG, PNG, WebP, HEIC, GIF or AVIF."));
      return;
    }
    const added: Item[] = [];
    for (const picked of files) {
      const key = crypto.randomUUID();
      try {
        const file = isSvg(picked) ? await rasterizeSvg(picked) : picked;
        const { w, h, preview } = await engine.load(key, file);
        added.push({
          key,
          file,
          url: URL.createObjectURL(preview ?? file),
          w,
          h,
        });
      } catch {
        toast(
          T(
            "{name} couldn't be opened. It may be damaged or in a format your browser can't read.",
            { name: picked.name },
          ),
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

  // With a fixed ratio, switching files recentres the frame for the new file's shape.
  const lastKey = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!item || item.key === lastKey.current) return;
    const first = lastKey.current === undefined;
    lastKey.current = item.key;
    const r = RATIOS.find((x) => x.id === s.ratio);
    if (r && !first)
      setS((p) => ({ ...p, crop: centeredCrop(item.w, item.h, r.r) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key]);

  // A ratio preset (e.g. "Crop to square") becomes a centred crop once the image size is known.
  useEffect(() => {
    if (!item || !s.ratio || s.crop) return;
    const r = RATIOS.find((x) => x.id === s.ratio);
    if (r) setS((p) => ({ ...p, crop: centeredCrop(item.w, item.h, r.r) }));
  }, [item, s.ratio, s.crop]);

  /* ---------- Zoom ---------- */
  const ZOOMS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
  // Back to "fit" whenever another file is shown
  useEffect(() => setZoom(null), [item?.key]);
  // Convert never offers the image's own format: when the chosen one matches it, pick another
  // (a JPG goes to PNG, anything else to JPEG)
  useEffect(() => {
    if (tool !== "convert" || !item) return;
    const src = formatOf(item.file);
    if (src && src === s.type)
      setS((p) => ({ ...p, keepFormat: false, type: src === "image/jpeg" ? "image/png" : "image/jpeg" }));
  }, [item?.key, s.type]);

  /** Width in image pixels of what's on screen: the result when it's shown alone, else the original */
  function shownWidth(): number {
    if (!item) return 1;
    const solo =
      outRef.current &&
      outRef.current.key === item.key &&
      (Math.abs(outRef.current.w / outRef.current.h - item.w / item.h) > 0.01 ||
        !!(s.text || s.mark || s.frame || s.ink || s.sheet || s.passport));
    return solo ? outRef.current!.w : item.w;
  }
  /**
   * Zoom is in screen pixels: 100% shows one image pixel per screen pixel, so on a Retina screen
   * (two screen pixels per CSS pixel) a 2000-pixel image is 1000 CSS pixels wide at 100%.
   */
  const dpr = () => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  function zoomBy(dir: 1 | -1) {
    const el =
      shownRef.current ??
      document.querySelector<HTMLImageElement>(".cropper img");
    const current =
      zoom ?? (el ? (el.getBoundingClientRect().width * dpr()) / shownWidth() : 1);
    const next =
      dir > 0
        ? (ZOOMS.find((z) => z > current + 0.001) ?? ZOOMS[ZOOMS.length - 1]!)
        : ([...ZOOMS].reverse().find((z) => z < current - 0.001) ?? ZOOMS[0]!);
    setZoom(next);
  }
  // Ctrl/⌘ + wheel (and trackpad pinch) zooms the image area
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (
        !(e.ctrlKey || e.metaKey) ||
        !(e.target as Element).closest?.(".stage")
      )
        return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1 : -1);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  });
  const sized = (w: number): CSSProperties | undefined =>
    zoom
      ? {
          width: Math.round((w * zoom) / dpr()),
          maxWidth: "none",
          maxHeight: "none",
          height: "auto",
        }
      : undefined;

  /* ---------- Processing ---------- */
  useEffect(() => {
    if (!item) return;
    const id = ++reqRef.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await produce(item, s);
        if (id !== reqRef.current) return;
        const next = { ...r, key: item.key, url: URL.createObjectURL(r.preview ?? r.blob) };
        const old = outRef.current;
        outRef.current = next;
        setOut(next);
        if (old) URL.revokeObjectURL(old.url);
        setError(null);
      } catch {
        if (id === reqRef.current)
          setError(
            T(
              "Processing failed. The image may be too large for this device's memory.",
            ),
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

  /* ---------- Keyboard shortcuts (listed in the "?" panel) ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Leave keys alone while a dialog (search, shortcuts) is open
      if (document.querySelector(".scrim")) return;
      if (matches(e, "mod+o")) {
        e.preventDefault();
        pickRef.current?.click();
        return;
      }
      if (matches(e, "mod+shift+s")) {
        e.preventDefault();
        if (items.length && !zipping) void downloadEach();
        return;
      }
      if (matches(e, "mod+s")) {
        e.preventDefault();
        if (items.length && !zipping) void download();
        return;
      }
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === "Escape" && advanced && !editor) closeAdvanced();
      else if (k === "a" || k === "A")
        (advanced || wantAdvanced ? closeAdvanced : openAdvanced)();
      else if (!items.length) return;
      else if (k === "ArrowRight" && !(e.target instanceof HTMLInputElement))
        setCur((c) => (c + 1) % items.length);
      else if (k === "ArrowLeft" && !(e.target instanceof HTMLInputElement))
        setCur((c) => (c - 1 + items.length) % items.length);
      else if (k === "+" || k === "=") zoomBy(1);
      else if (k === "-" || k === "_") zoomBy(-1);
      else if (k === "0") setZoom(null);
      else if (k === "1") setZoom(1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---------- Download ---------- */
  /**
   * Settings for one file in a batch. With a fixed crop ratio, files other than the one on screen
   * get their own centred crop at that ratio, so different shapes all come out right.
   */
  function settingsFor(it: Item): Settings {
    const r = RATIOS.find((x) => x.id === s.ratio);
    if (!r || it.key === item?.key) return s;
    return { ...s, crop: centeredCrop(it.w, it.h, r.r) };
  }

  /**
   * Compressing never makes a file bigger: the original is 100%, and when the re-encoded file
   * isn't smaller, the original file is the result.
   */
  function noBigger<T extends EncodeResult>(r: T, it: Item, st: Settings): T & { kept?: boolean } {
    if (
      tool !== "compress" ||
      !KEEPABLE.has(it.file.type) ||
      !onlyEncodes(st) ||
      r.blob.size < it.file.size
    )
      return r;
    return { ...r, blob: it.file, w: it.w, h: it.h, type: it.file.type, over: false, kept: true };
  }

  /**
   * One file with the given settings. Strip metadata on a JPEG, PNG or WebP that keeps its format
   * cuts the metadata out of the file itself (no re-encoding, no quality lost); everything else
   * renders in the worker.
   */
  async function produce(it: Item, st: Settings): Promise<EncodeResult & Pick<Out, "kept" | "lossless" | "removed">> {
    if (tool === "strip-metadata" && st.keepFormat && onlyEncodes(st)) {
      const r = stripMetadata(new Uint8Array(await it.file.arrayBuffer()));
      if (r) {
        const type = formatOf(it.file) ?? it.file.type;
        return {
          blob: new Blob([r.bytes], { type }),
          w: it.w,
          h: it.h,
          type,
          q: 100,
          over: false,
          lossless: true,
          removed: r.removed,
        };
      }
    }
    return noBigger(await engine.encode(it.key, it.file.type, st), it, st);
  }

  /** Process every file with the current settings; file names are made unique. */
  async function encodeAll(): Promise<{ name: string; blob: Blob }[]> {
    const used = new Set<string>();
    const outFiles: { name: string; blob: Blob }[] = [];
    for (const it of items) {
      const st = settingsFor(it);
      const r = await produce(it, st);
      let name = outName(it.file, r.type, tool);
      for (let n = 2; used.has(name); n++)
        name = outName(it.file, r.type, tool).replace(/-kmra(\.\w+)$/, `-${n}-kmra$1`);
      used.add(name);
      outFiles.push({ name, blob: r.blob });
    }
    return outFiles;
  }

  /** One file: reuse the preview result when it's current, otherwise process it now. */
  async function downloadOne(i = cur) {
    const it = items[i];
    if (!it) return;
    if (out && out.key === it.key && i === cur) {
      downloadBlob(out.blob, outName(it.file, out.type, tool));
      return;
    }
    try {
      const st = settingsFor(it);
      const r = await produce(it, st);
      downloadBlob(r.blob, outName(it.file, r.type, tool));
    } catch {
      toast(
        T(
          "Processing failed. The image may be too large for this device's memory.",
        ),
      );
    }
  }

  async function downloadZip() {
    setZipping(true);
    try {
      const files = await encodeAll();
      // Images are already compressed, so store them without deflating again.
      const entries = Object.fromEntries(
        await Promise.all(
          files.map(
            async (f) =>
              [f.name, new Uint8Array(await f.blob.arrayBuffer())] as const,
          ),
        ),
      );
      downloadBlob(
        new Blob([zipSync(entries, { level: 0 })], { type: "application/zip" }),
        `images-${tool === "editor" ? "edit" : tool}.zip`,
      );
    } catch {
      toast(T("Couldn't build the zip. Try fewer or smaller images."));
    } finally {
      setZipping(false);
    }
  }

  async function downloadEach() {
    setZipping(true);
    try {
      const files = await encodeAll();
      for (const f of files) {
        downloadBlob(f.blob, f.name);
        // Browsers drop rapid back-to-back downloads; space them out a little.
        await new Promise((r) => setTimeout(r, 300));
      }
      if (files.length > 1)
        toast(
          T(
            "Saved {n} files. If some are missing, allow multiple downloads for this site.",
            { n: files.length },
          ),
        );
    } catch {
      toast(T("Couldn't save the files. Try fewer or smaller images."));
    } finally {
      setZipping(false);
    }
  }

  const download = () => (items.length > 1 ? downloadZip() : downloadOne());

  /* ---------- Shared pieces ---------- */
  const fileInput = (
    <input
      ref={pickRef}
      type="file"
      accept={IMAGE_ACCEPT}
      multiple
      hidden
      onChange={(e) => {
        if (e.target.files) void addFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );

  const outForItem = out && item && out.key === item.key ? out : null;

  /* ---------- Strip metadata: what's in the photo, and a check of the result ---------- */
  const [metaIn, setMetaIn] = useState<{ key: string; sum: MetaSummary | null } | null>(null);
  const [left, setLeft] = useState<{ blob: Blob; sum: MetaSummary | null } | null>(null);
  useEffect(() => {
    if (tool !== "strip-metadata" || !item) return;
    let live = true;
    void readSummary(item.file).then((sum) => live && setMetaIn({ key: item.key, sum }));
    return () => {
      live = false;
    };
  }, [item?.key]);
  useEffect(() => {
    if (tool !== "strip-metadata" || !outForItem) return;
    let live = true;
    const blob = outForItem.blob;
    void readSummary(blob).then((sum) => live && setLeft({ blob, sum }));
    return () => {
      live = false;
    };
  }, [outForItem?.blob]);
  const type = item ? outType(item.file.type, s) : s.type;

  function compare(it: Item) {
    // Show the result alone when its shape differs, or when it adds things on top (text, frames)
    // that a before/after split would only cut in half.
    const solo = outForItem
      ? Math.abs(outForItem.w / outForItem.h - it.w / it.h) > 0.01 ||
        !!(s.text || s.mark || s.frame || s.ink || s.sheet || s.passport)
      : false;
    return (
      <div
        className={`cmp${solo ? " solo" : ""}`}
        style={{ "--cut": `${cut}%` } as CSSProperties}
      >
        <img
          src={it.url}
          alt={T("Original: {name}", { name: it.file.name })}
          ref={solo ? undefined : shownRef}
          style={solo ? undefined : sized(it.w)}
        />
        <img
          className="after"
          src={outForItem?.url ?? it.url}
          alt={T("Result")}
          ref={solo ? shownRef : undefined}
          style={solo && outForItem ? sized(outForItem.w) : undefined}
        />
        <div className="line" />
        <span className="lab" style={{ left: 10 }}>
          {T("Original")}
        </span>
        <span className="lab" style={{ right: 10 }}>
          {outForItem
            ? `${FORMATS[outForItem.type as Format]} ${formatBytes(outForItem.blob.size)}`
            : T("Result")}
        </span>
        <input
          type="range"
          min={2}
          max={98}
          value={cut}
          onChange={(e) => setCut(+e.target.value)}
          aria-label={T("Drag to compare original and result")}
        />
      </div>
    );
  }

  /** Like seg, but the buttons wrap: for longer lists such as the formats */
  function chipGroup<T extends string>(
    options: [T, string][],
    value: T,
    onPick: (v: T) => void,
    label: string,
  ) {
    return (
      <div className="chips" role="group" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={v === value} onClick={() => onPick(v)}>
            {l}
          </button>
        ))}
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
          {T("Quality")} <span>{s.target ? T("Auto") : s.quality}</span>
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
        {T(
          "PNG is lossless, so there's no quality setting. Pick JPEG or WebP for smaller files.",
        )}
      </p>
    );

  /** The biggest file loaded, in KB: size targets above it would change nothing */
  const biggestKB = items.length ? Math.max(...items.map((it) => it.file.size)) / 1024 : Infinity;
  const targets = TARGETS.filter((v) => v < biggestKB);
  const targetCtl = (short = false) => (
    <div className="ctl">
      <span className="lbl">{T("Exact size")}</span>
      <div className="chips">
        {/* Only sizes below the image, plus a preset's own target (e.g. 20 or 240 KB) so it stays visible */}
        {[
          null,
          ...[...new Set([...targets, ...(s.target ? [s.target] : [])])].sort(
            (a, b) => a - b,
          ),
        ].map((v) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={s.target === v}
            onClick={() => set({ target: v, form: null })}
          >
            {v
              ? short
                ? `≤ ${num(lang, v)} KB`
                : T("Under {n} KB", { n: v })
              : short
                ? T("Any size")
                : T("Off")}
          </button>
        ))}
      </div>
      {!targets.length && !s.target && Number.isFinite(biggestKB) && (
        <small className="muted">
          {T("Already under {n} KB.", { n: TARGETS[0]! })}
        </small>
      )}
    </div>
  );

  function setDim(k: "w" | "h", raw: string) {
    const v = raw ? Math.max(1, Math.round(+raw)) : null;
    const patch: Partial<Settings> = { [k]: v, size: null, form: null };
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
        <span className="lbl">{T("Size in pixels")}</span>
        <div className="row2">
          <input
            className="num"
            type="number"
            min={1}
            placeholder={String(item.w)}
            value={s.w ?? ""}
            onChange={(e) => setDim("w", e.target.value)}
            aria-label={T("Width in pixels")}
          />
          <button
            type="button"
            className="lockbtn"
            aria-pressed={s.lock}
            aria-label={T("Keep aspect ratio")}
            title={T("Keep aspect ratio")}
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
            aria-label={T("Height in pixels")}
          />
        </div>
      </div>
      <div className="ctl">
        <span className="lbl">{T("Presets")}</span>
        <div className="chips">
          {SIZES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={s.size === p.id}
              onClick={() => setS((prev) => applySize(prev, p.id))}
            >
              {T(p.label)}
            </button>
          ))}
          {(s.w || s.h || s.size) && (
            <button
              type="button"
              onClick={() => set({ w: null, h: null, size: null, lock: true })}
            >
              {T("Original size")}
            </button>
          )}
        </div>
      </div>
    </>
  );

  /** The format of the file on screen; Convert doesn't offer it as a destination */
  const srcFormat = item ? formatOf(item.file) : null;
  const formatOpts = (withOriginal: boolean, exclude: Format | null = null): [string, string][] => [
    ...(withOriginal ? ([["keep", T("Original")]] as [string, string][]) : []),
    ...(Object.keys(FORMATS) as Format[])
      .filter((f) => f !== exclude)
      .map((f) => [f, T(FORMATS[f])] as [string, string]),
  ];
  const FORMAT_HINT: Record<Format, string> = {
    "image/jpeg": "Photos at small sizes. No transparency.",
    "image/png": "Sharp edges and transparency. Bigger files.",
    "image/webp": "Smaller than JPEG and PNG, and keeps transparency.",
    "image/avif": "The smallest files. Takes a little longer to make.",
    "image/gif": "Up to 256 colours. For simple graphics.",
    "image/bmp": "No compression, so very big files. No transparency.",
    "image/tiff": "Uncompressed, for printing and archives.",
    "image/x-icon": "An icon for Windows or a website, up to 256 × 256.",
  };
  const formatHint = (f: Format) => (
    <small className="muted fmt-hint">{T(FORMAT_HINT[f])}</small>
  );
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
      <span className="lbl">{T("Aspect ratio")}</span>
      <div className="chips">
        <button
          type="button"
          aria-pressed={s.ratio === null}
          onClick={() => pickRatio(null)}
        >
          {T("Free")}
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
            {T("Reset")}
          </button>
        )}
      </div>
      <small className="muted" style={{ display: "block", marginTop: 8 }}>
        {T("Drag the frame on the image, or use the corners to resize.")}
      </small>
    </div>
  );

  // Functional updates so quick repeated clicks all count
  const turn = (by: 90 | -90) =>
    setS((p) => ({
      ...p,
      rotate: ((((p.rotate + by) % 360) + 360) % 360) as Settings["rotate"],
    }));
  const rotateCtl = (
    <div className="ctl">
      <span className="lbl">
        Rotate and flip <span>{s.rotate}°</span>
      </span>
      <div className="tbtns">
        <button type="button" className="btn sm" onClick={() => turn(-90)}>
          <Icon name="rotate" />
          {T("Left")}
        </button>
        <button type="button" className="btn sm" onClick={() => turn(90)}>
          <Icon name="rotateRight" />
          {T("Right")}
        </button>
        <button
          type="button"
          className="btn sm"
          aria-pressed={s.flipH}
          onClick={() => setS((p) => ({ ...p, flipH: !p.flipH }))}
        >
          <Icon name="flipH" />
          {T("Flip ↔")}
        </button>
        <button
          type="button"
          className="btn sm"
          aria-pressed={s.flipV}
          onClick={() => setS((p) => ({ ...p, flipV: !p.flipV }))}
        >
          <Icon name="flipV" />
          {T("Flip ↕")}
        </button>
      </div>
    </div>
  );

  const saveAsCtl = (
    <div className="ctl">
      <span className="lbl">{T("Save as")}</span>
      {chipGroup<string>(formatOpts(true), formatValue, pickFormat, T("Save as"))}
    </div>
  );

  const formCtl = (
    <div className="ctl">
      <span className="lbl">{T("Form presets")}</span>
      <div className="presets">
        {FORM_PRESETS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={s.form === f.id}
            onClick={() => setS((p) => applyForm(p, f.id))}
          >
            <strong>{T(f.label)}</strong>
            <small>{T(f.hint)}</small>
          </button>
        ))}
      </div>
    </div>
  );

  // How many faces the last render found (face blur, passport framing, auto background)
  const found = outForItem?.faces;
  const facesNote =
    found === undefined ? null : tool === "passport-photo" ? (
      found ? null : (
        <small className="warn">
          No face found, so the photo is centred instead. Use a clear,
          front-facing photo.
        </small>
      )
    ) : (
      <small className={found ? "muted" : "warn"}>
        {found
          ? `${found} face${found > 1 ? "s" : ""} covered in this image.`
          : T(
              "No faces found in this image. Drag on it to cover areas yourself.",
            )}
      </small>
    );

  const sigForm = s.form === "job-signature";
  const signatureSizeCtl = (
    <>
      <Seg<string>
        label={T("Size")}
        options={[
          ["any", T("Original")],
          ["job", T("Form 300×80")],
        ]}
        value={sigForm ? "job" : "any"}
        onPick={(v) =>
          setS((p) =>
            v === "job"
              ? applyForm(p, "job-signature")
              : {
                  ...p,
                  form: null,
                  w: null,
                  h: null,
                  lock: true,
                  target: null,
                  type: "image/png",
                },
          )
        }
      />
      {!sigForm && (
        <Seg<string>
          label={T("Save as")}
          options={[
            ["image/png", T("PNG (transparent)")],
            ["image/jpeg", T("JPEG (white)")],
          ]}
          value={s.type}
          onPick={(v) => set({ type: v as Format, keepFormat: false })}
        />
      )}
    </>
  );

  /** Names for the blocks the stripper cut out */
  const REMOVED: Record<Removed, string> = {
    exif: "Camera data (EXIF)",
    xmp: "Editing history (XMP)",
    iptc: "Caption and copyright (IPTC)",
    comment: "Comment",
    thumbnail: "Preview copy",
    extra: "Extra data from the camera or app",
    text: "Text notes",
    time: "Last-edited time",
  };

  function metaReport(): ReactNode {
    const read = metaIn && item && metaIn.key === item.key ? metaIn : null;
    const sum = read?.sum ?? null;
    const done = outForItem && left && left.blob === outForItem.blob ? left : null;
    const checked = done?.sum ?? null;
    return (
      <>
        <div className="ctl meta-report">
          <span className="lbl">{T("Hidden data in this photo")}</span>
          {!read ? (
            <small className="muted">{T("Reading…")}</small>
          ) : !sum ? (
            <small className="muted">
              {T("This browser couldn't read the photo's hidden data to list it. The download is still saved without any of it.")}
            </small>
          ) : sum.rows.length || sum.more ? (
            <>
              <ul className="meta-rows">
                {sum.rows.map((r) => (
                  <li key={r.label} className={r.private ? "priv" : undefined}>
                    <span>{T(r.label)}</span>
                    <b>{r.value}</b>
                  </li>
                ))}
              </ul>
              {sum.more > 0 && (
                <small className="muted">
                  {sum.rows.length
                    ? T("And {n} more camera details, such as exposure and ISO.", { n: sum.more })
                    : T("{n} camera details, such as exposure and ISO.", { n: sum.more })}
                </small>
              )}
            </>
          ) : (
            <small className="muted">
              {T("No location, camera or date found. The download is still saved without any hidden data.")}
            </small>
          )}
        </div>
        {outForItem && (
          <div className="ctl meta-done">
            <span className="lbl">{T("In the download")}</span>
            {checked && !checked.rows.length && !checked.more ? (
              <p className="meta-ok">
                <Icon name="check" />
                {T("Checked: none of it is left.")}
              </p>
            ) : done && !checked ? (
              <small className="muted">{T("The download couldn't be read back to check it.")}</small>
            ) : checked ? (
              <p className="warn">
                {T("Still in the file: {list}", { list: checked.rows.map((r) => T(r.label)).join(", ") })}
              </p>
            ) : (
              <small className="muted">{T("Checking…")}</small>
            )}
            {outForItem.lossless ? (
              <small className="muted">
                {T("Cut out without re-compressing, so the picture is exactly as it was. Its colours and rotation stay.")}
              </small>
            ) : (
              <small className="muted">
                {T("Saved again from the pixels, so none of the hidden data comes along.")}
              </small>
            )}
            {!!outForItem.removed?.length && (
              <small className="muted">
                {T("Removed: {list}", { list: outForItem.removed.map((k) => T(REMOVED[k])).join(", ") })}
              </small>
            )}
          </div>
        )}
      </>
    );
  }

  function simpleControls(): ReactNode {
    switch (tool) {
      case "compress":
        return (
          <>
            <div className="ctl">
              <span className="lbl">{T("Format")}</span>
              {seg<string>(
                [
                  ["image/jpeg", T("JPEG")],
                  ["image/webp", T("WebP")],
                  ["image/avif", T("AVIF")],
                ],
                s.type,
                (v) => set({ type: v as Format, keepFormat: false }),
                T("Format"),
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
              <span className="lbl">{T("Convert to")}</span>
              {chipGroup<string>(
                formatOpts(false, srcFormat),
                s.type,
                (v) => set({ type: v as Format, keepFormat: false }),
                T("Convert to"),
              )}
              {formatHint(s.type)}
            </div>
            {qualityCtl("q")}
          </>
        );
      case "resize":
        return (
          <>
            {dimsCtl}
            <div className="ctl">
              <span className="lbl">{T("Save as")}</span>
              {chipGroup<string>(
                formatOpts(true),
                formatValue,
                pickFormat,
                T("Save as"),
              )}
            </div>
          </>
        );
      case "strip-metadata":
        return metaReport();
      case "form-size":
        return (
          <>
            {formCtl}
            {dimsCtl}
            {targetCtl()}
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
      case "adjust":
        return (
          <>
            <AdjustCtl s={s} setS={setS} />
            {saveAsCtl}
          </>
        );
      case "filters":
        return (
          <>
            <FilterCtl s={s} setS={setS} />
            {saveAsCtl}
          </>
        );
      case "add-text":
        return (
          <>
            <TextCtl s={s} setS={setS} />
            {saveAsCtl}
          </>
        );
      case "watermark":
        return (
          <>
            <MarkCtl s={s} setS={setS} />
            {saveAsCtl}
          </>
        );
      case "border":
      case "extend-canvas":
      case "beautify":
        return (
          <>
            <FrameCtl s={s} setS={setS} mode={FRAME_MODE[tool]!} />
            {saveAsCtl}
          </>
        );
      case "blur":
      case "face-blur":
        return (
          <>
            <RedactCtl s={s} setS={setS} />
            {facesNote}
            {saveAsCtl}
          </>
        );
      case "remove-bg":
        return (
          <>
            <BgCtl s={s} setS={setS} />
            {s.bg?.mode === "remove" ? (
              <Seg<string>
                label={T("Save as")}
                options={[
                  ["image/png", T("PNG")],
                  ["image/webp", T("WebP")],
                ]}
                value={s.type === "image/webp" ? "image/webp" : "image/png"}
                onPick={(v) => set({ type: v as Format, keepFormat: false })}
              />
            ) : (
              saveAsCtl
            )}
          </>
        );
      case "change-bg":
        return (
          <>
            <BgCtl s={s} setS={setS} />
            {saveAsCtl}
          </>
        );
      case "passport-photo":
        return (
          <>
            <PassportCtl s={s} setS={setS} />
            {facesNote}
          </>
        );
      case "signature":
        return (
          <>
            <InkCtl s={s} setS={setS} />
            {signatureSizeCtl}
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
  const redactTool = tool === "blur" || tool === "face-blur";
  const showRegions =
    !!s.redact &&
    !showCrop &&
    (redactTool
      ? !advanced || SECTION[focus] === "redact"
      : advanced && SECTION[focus] === "redact");
  function stageContent(it: Item) {
    const r = RATIOS.find((x) => x.id === s.ratio);
    // Areas are drawn on the result when it has the original's shape, so the effect shows live.
    const onResult =
      outForItem &&
      !hasGeometry(s) &&
      !s.frame &&
      !s.sheet &&
      Math.abs(outForItem.w / outForItem.h - it.w / it.h) < 0.01;
    const content = showRegions ? (
      <RegionBox
        url={onResult ? outForItem.url : it.url}
        alt={T("Choose areas to blur in {name}", { name: it.file.name })}
        regions={s.redact!.regions}
        ellipse={s.redact!.shape === "ellipse"}
        onChange={(regions) =>
          setS((p) => ({ ...p, redact: { ...p.redact!, regions } }))
        }
        imgStyle={sized(it.w)}
      />
    ) : showCrop ? (
      <CropBox
        url={it.url}
        alt={T("Crop {name}", { name: it.file.name })}
        crop={s.crop}
        ratio={r ? r.r : null}
        srcW={it.w}
        srcH={it.h}
        onChange={(crop) => set({ crop })}
        imgStyle={sized(it.w)}
      />
    ) : (
      compare(it)
    );
    return (
      <>
        <div className={`viewport${zoom ? " zoomed" : ""}`}>{content}</div>
        <div className="zoombar" role="group" aria-label={T("Zoom")}>
          <button
            type="button"
            onClick={() => zoomBy(-1)}
            aria-label={T("Zoom out")}
            title={T("Zoom out (−, or {mod} + scroll)", { mod: keys.mod })}
          >
            <Icon name="minus" />
          </button>
          <button
            type="button"
            className="zl"
            onClick={() => setZoom(zoom === 1 ? null : 1)}
            title={zoom === 1 ? T("Fit to view") : T("Actual size (100%)")}
          >
            {zoom ? `${Math.round(zoom * 100)}%` : T("Fit")}
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1)}
            aria-label={T("Zoom in")}
            title={T("Zoom in (+, or {mod} + scroll)", { mod: keys.mod })}
          >
            <Icon name="plus" />
          </button>
          {zoom !== null && (
            <button
              type="button"
              className="zfit"
              onClick={() => setZoom(null)}
            >
              {T("Fit")}
            </button>
          )}
        </div>
      </>
    );
  }

  function resultSummary() {
    if (error) return <small className="warn">{error}</small>;
    if (!item) return <small>{T("Add an image to see the result.")}</small>;
    if (!outForItem) return <small>{T("Working…")}</small>;
    const pct = Math.round((1 - outForItem.blob.size / item.file.size) * 100);
    if (outForItem.kept)
      return (
        <>
          <small>{T("Your file")}</small>
          <div className="sz">
            <b>{formatBytes(item.file.size)}</b>
          </div>
          <small>
            {outForItem.w} × {outForItem.h}, {FORMATS[outForItem.type as Format]}
          </small>
          <small className="kept">
            {T(
              "It's already smaller than these settings would make it, so you get your original file. Lower the quality or pick a size to go smaller.",
            )}
          </small>
        </>
      );
    return (
      <>
        <small>
          {formatBytes(item.file.size)} {T("to")}
        </small>
        <div className="sz">
          <b>{formatBytes(outForItem.blob.size)}</b>
          {pct >= 0 ? (
            <span className="delta">
              {pct}% {T("smaller")}
            </span>
          ) : (
            // Only a warning when the job is making files smaller
            <span
              className={`delta up${tool === "compress" || s.target ? "" : " neutral"}`}
            >
              {-pct >= 200
                ? T("{n}× larger", { n: Math.round(outForItem.blob.size / item.file.size) })
                : `${-pct}% ${T("larger")}`}
            </span>
          )}
        </div>
        <small>
          {outForItem.w} × {outForItem.h}, {FORMATS[outForItem.type as Format]}
        </small>
        {outForItem.over ? (
          <small className="warn">
            {T(
              "Can't get under {n} KB at this size. Make the image smaller in Advanced.",
              { n: s.target ?? 0 },
            )}
          </small>
        ) : s.target && isLossy(type) ? (
          <small>
            {T("Best quality that fits")}: {outForItem.q}
          </small>
        ) : null}
      </>
    );
  }

  const many = items.length > 1;
  const dlDisabled = busy || zipping || !outForItem;

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
        <strong>{T("Drop images here")}</strong>
        <span className="muted">{keys.hint}</span>
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
            {T("Choose images")}
          </button>
        </div>
        <div className="formats">
          {["JPG", "PNG", "WebP", "HEIC", "GIF", "AVIF"].map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
        {wantAdvanced && (
          <span className="mode-note">
            <Icon name="sliders" />
            {T("Opens in the Advanced workspace")}
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
            <span key={it.key} className="fchip-wrap">
              <button
                type="button"
                className="fchip"
                aria-pressed={i === cur}
                onClick={() => setCur(i)}
              >
                <img src={it.url} alt="" />
                <span>{it.file.name}</span>
              </button>
              {/* Picked the wrong image? Take it out (the last one brings the drop box back) */}
              <button
                type="button"
                className="iconbtn"
                aria-label={T("Remove {name}", { name: it.file.name })}
                title={T("Remove")}
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
            {T("+ Add")}
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
              disabled={dlDisabled}
            >
              <Icon name="download" />
              {zipping
                ? T("Working…")
                : many
                  ? T("Download all {n} as zip", { n: items.length })
                  : T("Download")}
            </button>
            {many && (
              <div className="dl-row">
                <button
                  className="btn sm"
                  type="button"
                  onClick={() => void downloadEach()}
                  disabled={dlDisabled}
                >
                  {T("Save each separately")}
                </button>
                <button
                  className="btn sm"
                  type="button"
                  onClick={() => void downloadOne()}
                  disabled={dlDisabled}
                >
                  {T("Only this one")}
                </button>
              </div>
            )}
            <button className="advlink" type="button" onClick={openAdvanced}>
              <Icon name="sliders" />
              {T("More options in Advanced")}
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
      ? T("Crop {w} × {h}", {
          w: Math.round(s.crop.w * (item?.w ?? 0)),
          h: Math.round(s.crop.h * (item?.h ?? 0)),
        })
      : null,
    s.rotate ? T("Rotate {n}°", { n: s.rotate }) : null,
    s.flipH || s.flipV ? T("Flip") : null,
    item && (ow !== bw || oh !== bh)
      ? T("Resize {w} × {h}", { w: ow, h: oh })
      : null,
    isLossy(type)
      ? s.target
        ? T("Fit ≤ {n} KB", { n: s.target })
        : T("Quality {n}", { n: s.quality })
      : null,
    s.passport ? "ID photo framing" : null,
    s.bg
      ? s.bg.mode === "remove"
        ? T("Remove background")
        : s.bg.mode === "blur"
          ? T("Blur background")
          : T("New background")
      : null,
    s.redact?.faces ? T("Cover faces") : null,
    s.ink ? T("Clean signature") : null,
    s.redact?.regions.length
      ? `Blur ${s.redact.regions.length} area${s.redact.regions.length > 1 ? "s" : ""}`
      : null,
    s.adjust && Object.values(s.adjust).some(Boolean) ? T("Adjust") : null,
    s.filter ? (FILTERS.find((f) => f.id === s.filter)?.label ?? null) : null,
    s.text && (s.text.top || s.text.bottom) ? T("Text") : null,
    s.mark ? T("Watermark") : null,
    s.frame ? T("Frame") : null,
    s.sheet
      ? T("Print sheet {name}", {
          name: T(SHEETS.find((x) => x.id === s.sheet)?.label ?? ""),
        })
      : null,
    FORMATS[type],
    T("Strip metadata"),
  ].filter(Boolean) as string[];

  /** An effect section in the workspace that can be switched on and off. */
  const fxSection = (
    key: string,
    title: string,
    icon: IconKey,
    on: boolean,
    toggle: (on: boolean) => void,
    body: ReactNode,
  ) => (
    <section
      id={`ws-${key}`}
      className={SECTION[focus] === key ? "focus" : undefined}
    >
      <h3>
        <Icon name={icon} />
        {title}
        <button type="button" className="fx-on" onClick={() => toggle(!on)}>
          {on ? T("Remove") : T("Add")}
        </button>
      </h3>
      {on && body}
    </section>
  );
  const fromTool = (slug: string) => defaults(slug);

  return (
    <>
      {items.length ? simple : emptyState}
      <div
        className="ws"
        role="dialog"
        aria-modal="true"
        aria-label={T("Advanced workspace")}
      >
        <div className="ws-top">
          <button className="btn sm" type="button" onClick={closeAdvanced}>
            <Icon name="back" />
            <span className="hide-sm">
              {editor ? T("Home") : T("Simple mode")}
            </span>
          </button>
          <span className="title">
            {editor ? T("Image editor") : T("Workspace")}{" "}
            <small>
              {items.length
                ? `${items.length} file${items.length > 1 ? "s" : ""}`
                : T("No files yet")}
            </small>
          </span>
          <span className="right">
            <button
              className="btn sm hide-sm"
              type="button"
              onClick={() => pickRef.current?.click()}
            >
              <Icon name="upload" />
              {T("Add files")}
            </button>
            {many && (
              <button
                className="btn sm hide-sm"
                type="button"
                onClick={() => void downloadEach()}
                disabled={dlDisabled}
                title={T("Save every file separately")}
              >
                {T("Save each")}
              </button>
            )}
            <button
              className="btn sm acc"
              type="button"
              onClick={() => void download()}
              disabled={dlDisabled}
              title={many ? T("Download every file in one zip") : T("Download")}
            >
              <Icon name="download" />
              {zipping
                ? T("Preparing…")
                : many
                  ? T("Zip of {n}", { n: items.length })
                  : T("Download")}
            </button>
          </span>
        </div>

        <div className="ws-body">
          <div className="rail" aria-label={T("Tools")}>
            {tools
              .filter((t) => SECTION[t.slug])
              .map((t) => (
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
                      ?.scrollIntoView({
                        block: "nearest",
                        behavior: "smooth",
                      });
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
                  <strong>{T("Drop images to start")}</strong>
                  <span className="muted">
                    {keys.touch
                      ? T(
                          "Or tap to choose files. Settings apply to every file.",
                        )
                      : T(
                          "Or click to choose files, or paste with {keys}. Settings apply to every file.",
                          { keys: keys.paste },
                        )}
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
                    aria-label={T("Download {name}", { name: it.file.name })}
                    title={T("Download this file")}
                    disabled={zipping}
                    onClick={() => void downloadOne(i)}
                  >
                    <Icon name="download" />
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    style={{ width: 28, height: 28 }}
                    aria-label={T("Remove {name}", { name: it.file.name })}
                    title={T("Remove")}
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
                {T("+ Add")}
              </button>
            </div>
          </div>

          <div className="insp">
            {section("crop", T("Crop"), "crop", cropCtl)}
            {section("rotate", T("Rotate & flip"), "rotate", rotateCtl)}
            {section(
              "resize",
              T("Resize"),
              "resize",
              <>
                {dimsCtl}
                {formCtl}
                <SheetCtl s={s} setS={setS} />
              </>,
            )}
            {fxSection(
              "look",
              T("Adjust & looks"),
              "sun",
              !!(s.adjust || s.filter),
              (on) =>
                set(
                  on
                    ? { adjust: { ...NO_ADJUST } }
                    : { adjust: null, filter: null },
                ),
              <>
                <AdjustCtl s={s} setS={setS} />
                <FilterCtl s={s} setS={setS} />
              </>,
            )}
            {fxSection(
              "redact",
              T("Blur areas"),
              "eyeOff",
              !!s.redact,
              (on) => set({ redact: on ? fromTool("blur").redact : null }),
              s.redact && <RedactCtl s={s} setS={setS} />,
            )}
            {fxSection(
              "text",
              T("Text"),
              "type",
              !!s.text,
              (on) => set({ text: on ? fromTool("add-text").text : null }),
              s.text && <TextCtl s={s} setS={setS} />,
            )}
            {fxSection(
              "watermark",
              T("Watermark"),
              "stamp",
              !!s.mark,
              (on) => set({ mark: on ? fromTool("watermark").mark : null }),
              s.mark && <MarkCtl s={s} setS={setS} />,
            )}
            {fxSection(
              "frame",
              T("Border & padding"),
              "frame",
              !!s.frame,
              (on) => set({ frame: on ? { ...NO_FRAME, border: 3 } : null }),
              s.frame && <FrameCtl s={s} setS={setS} mode="all" />,
            )}
            {fxSection(
              "background",
              T("Background"),
              "eraser",
              !!s.bg,
              (on) => set({ bg: on ? fromTool("change-bg").bg : null }),
              s.bg && <BgCtl s={s} setS={setS} />,
            )}
            {fxSection(
              "passport",
              "ID photo",
              "idCard",
              !!s.passport,
              (on) =>
                setS((p) =>
                  on
                    ? {
                        ...p,
                        passport: fromTool("passport-photo").passport,
                        bg: p.bg ?? fromTool("passport-photo").bg,
                      }
                    : { ...p, passport: null },
                ),
              s.passport && <PassportCtl s={s} setS={setS} />,
            )}
            {fxSection(
              "signature",
              T("Signature cleanup"),
              "signature",
              !!s.ink,
              (on) => set({ ink: on ? fromTool("signature").ink : null }),
              s.ink && <InkCtl s={s} setS={setS} />,
            )}
            {section(
              "format",
              T("Format"),
              "convert",
              chipGroup<string>(
                formatOpts(true),
                formatValue,
                pickFormat,
                T("Output format"),
              ),
            )}
            {section(
              "compress",
              T("Compression"),
              "compress",
              <>
                {qualityCtl("wq")}
                {isLossy(type) && targetCtl(true)}
              </>,
            )}
            {section(
              "privacy",
              T("Privacy"),
              "shield",
              <small className="muted">
                {T(
                  "Location, camera and date data are always removed from the output.",
                )}
              </small>,
            )}
            <section>
              <h3>{T("Result")}</h3>
              <div
                className={`result${busy ? " working" : ""}`}
                style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}
                aria-live="polite"
              >
                {resultSummary()}
              </div>
            </section>
            <section>
              <h3>{T("Recipe")}</h3>
              <div className="recipe">
                {recipe.map((step, i) => (
                  <span key={step} style={{ display: "contents" }}>
                    {i > 0 && <i>{T("then")}</i>}
                    <span>{step}</span>
                  </span>
                ))}
              </div>
              <small className="muted">{T("Applied to every file.")}</small>
            </section>
          </div>
        </div>

        <div className="ws-status">
          <span>
            <b>●</b> Processing on this device
          </span>
          <span>{T("Files stay on this device")}</span>
          <span>{items.length} in batch</span>
        </div>
      </div>
    </>
  );
}

/** Island entry: sets the interface language for everything inside. */
export default function ImageTool(
  props: Parameters<typeof ImageToolView>[0] & { lang?: Locale },
) {
  return (
    <LangProvider lang={props.lang}>
      <ImageToolView {...props} />
    </LangProvider>
  );
}
