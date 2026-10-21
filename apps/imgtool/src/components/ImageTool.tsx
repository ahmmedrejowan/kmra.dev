import { LangProvider, useT } from "@kmra/ui/lib/i18n-react";
import { lp, num, type Locale } from "@kmra/ui/lib/i18n";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { stripMetadata, type Removed } from "../lib/strip";
import { readSummary, type MetaSummary } from "../lib/meta";
import { GROUPS, listFields, type Field } from "../lib/fields";
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
import { stashFiles, takeFiles } from "@kmra/ui/lib/handoff";
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
  /** The tool's group (English name), for the workspace rail */
  group?: string;
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
  return tagged(
    `${toolName(file.name, tool === "editor" ? "edit" : tool)}.${EXT[type as Format] ?? "img"}`,
  );
}

/**
 * The changes an image can have, in pipeline order. Each one can be hidden (left out of the
 * result for now) or removed; `clearOf` says how to take it out of the settings, or null when
 * it isn't on.
 */
const CHANGES = [
  "crop",
  "rotate",
  "flip",
  "resize",
  "target",
  "passport",
  "bg",
  "faces",
  "ink",
  "regions",
  "adjust",
  "filter",
  "text",
  "mark",
  "frame",
  "sheet",
] as const;
type ChangeId = (typeof CHANGES)[number];
/** Each change's name in lists and the history */
const CHANGE_NAME: Record<ChangeId, string> = {
  crop: "Crop",
  rotate: "Rotate",
  flip: "Flip",
  resize: "Resize",
  target: "Size target",
  passport: "ID photo",
  bg: "Background",
  faces: "Cover faces",
  ink: "Signature cleanup",
  regions: "Blur areas",
  adjust: "Adjust",
  filter: "Filter",
  text: "Text",
  mark: "Watermark",
  frame: "Border",
  sheet: "Print sheet",
};
/** The workspace section that sets each change */
const CHANGE_SEC: Record<ChangeId, string> = {
  crop: "crop",
  rotate: "rotate",
  flip: "rotate",
  resize: "resize",
  target: "compress",
  passport: "passport",
  bg: "background",
  faces: "redact",
  ink: "signature",
  regions: "redact",
  adjust: "look",
  filter: "look",
  text: "text",
  mark: "watermark",
  frame: "frame",
  sheet: "resize",
};
function clearOf(id: ChangeId, s: Settings): Partial<Settings> | null {
  switch (id) {
    case "crop":
      return s.crop ? { crop: null, ratio: null } : null;
    case "rotate":
      return s.rotate ? { rotate: 0 } : null;
    case "flip":
      return s.flipH || s.flipV ? { flipH: false, flipV: false } : null;
    case "resize":
      return s.w || s.h || s.size || s.form
        ? { w: null, h: null, size: null, form: null }
        : null;
    case "target":
      return s.target ? { target: null } : null;
    case "passport":
      return s.passport ? { passport: null } : null;
    case "bg":
      return s.bg ? { bg: null } : null;
    case "faces":
      return s.redact?.faces
        ? {
            redact: s.redact.regions.length
              ? { ...s.redact, faces: false }
              : null,
          }
        : null;
    case "ink":
      return s.ink ? { ink: null } : null;
    case "regions":
      return s.redact?.regions.length
        ? { redact: s.redact.faces ? { ...s.redact, regions: [] } : null }
        : null;
    case "adjust":
      return s.adjust && Object.values(s.adjust).some(Boolean)
        ? { adjust: null }
        : null;
    case "filter":
      return s.filter ? { filter: null } : null;
    case "text":
      return s.text && (s.text.top || s.text.bottom) ? { text: null } : null;
    case "mark":
      return s.mark ? { mark: null } : null;
    case "frame":
      return s.frame ? { frame: null } : null;
    case "sheet":
      return s.sheet ? { sheet: null } : null;
  }
}
/** The settings with hidden changes left out: what's rendered and downloaded */
function withoutHidden(s: Settings, hidden: Set<ChangeId>): Settings {
  let out = s;
  for (const id of CHANGES) {
    if (!hidden.has(id)) continue;
    const c = clearOf(id, out);
    if (c) out = { ...out, ...c };
  }
  return out;
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
  /** The workspace's "More edits" list is open (always at first in the editor) */
  const [moreOpen, setMoreOpen] = useState(editor);
  /** The tool whose rules apply: the page's tool, or the one picked in the workspace */
  const act = advanced ? focus : tool;
  /** The tool picked in the workspace (none in the plain editor) */
  const focusMeta = tools.find((t) => t.slug === focus);
  // The editor page's tab says which tool is open: "Compress images · Image editor"
  const baseTitle = useRef("");
  useEffect(() => {
    if (!editor) return;
    baseTitle.current ||= document.title;
    document.title = focusMeta
      ? `${focusMeta.name} · ${baseTitle.current}`
      : baseTitle.current;
  }, [focus]);
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
  /** Changes shown in the list but left out of the result for now */
  const [hidden, setHidden] = useState<Set<ChangeId>>(new Set());
  /** What's actually rendered: the settings without the hidden changes */
  const eff = useMemo(
    () => (hidden.size ? withoutHidden(s, hidden) : s),
    [s, hidden],
  );

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
    // The editor opened for one tool: /editor?t=compress
    if (editor) {
      const t = new URLSearchParams(location.search).get("t");
      if (t && SECTION[t] && tools.some((x) => x.slug === t && x.ready)) {
        setFocus(t);
        baseline.current = true;
        setS(defaults(t));
        setMoreOpen(false);
      }
    }
    restoreEdits();
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
      enterWorkspace();
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
    if (r && !first) {
      quiet.current = true;
      setS((p) => ({ ...p, crop: centeredCrop(item.w, item.h, r.r) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key]);

  // A ratio preset (e.g. "Crop to square") becomes a centred crop once the image size is known.
  useEffect(() => {
    if (!item || !s.ratio || s.crop) return;
    const r = RATIOS.find((x) => x.id === s.ratio);
    if (r) {
      quiet.current = true;
      setS((p) => ({ ...p, crop: centeredCrop(item.w, item.h, r.r) }));
    }
  }, [item, s.ratio, s.crop]);

  /* ---------- Zoom ---------- */
  const ZOOMS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
  // Back to "fit" whenever another file is shown
  useEffect(() => setZoom(null), [item?.key]);
  // Convert never offers the image's own format: when the chosen one matches it, pick another
  // (a JPG goes to PNG, anything else to JPEG)
  useEffect(() => {
    if (act !== "convert" || !item) return;
    const src = formatOf(item.file);
    if (src && src === s.type) {
      quiet.current = true;
      setS((p) => ({
        ...p,
        keepFormat: false,
        type: src === "image/jpeg" ? "image/png" : "image/jpeg",
      }));
    } else if (s.keepFormat) {
      quiet.current = true;
      set({ keepFormat: false });
    }
  }, [item?.key, s.type, s.keepFormat, act]);

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
  const dpr = () =>
    typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  function zoomBy(dir: 1 | -1) {
    const el =
      shownRef.current ??
      document.querySelector<HTMLImageElement>(".cropper img");
    const current =
      zoom ??
      (el ? (el.getBoundingClientRect().width * dpr()) / shownWidth() : 1);
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

  /* ---------- Strip metadata: which fields go ---------- */
  type MetaMode = "all" | "sensitive" | "everything" | "nothing" | "custom";
  const [metaMode, setMetaMode] = useState<MetaMode>("all");
  /** Custom choice: the field ids to keep (anything else goes) */
  const [metaKeep, setMetaKeep] = useState<Set<string>>(new Set());
  const metaRef = useRef({ mode: metaMode, keep: metaKeep });

  /* ---------- Edit history: undo / redo, and a list to jump back to ---------- */
  /** Everything an undo brings back: the settings, hidden changes and the metadata choice */
  type Snap = {
    s: Settings;
    hidden: Set<ChangeId>;
    metaMode: MetaMode;
    metaKeep: Set<string>;
  };
  const snap = (): Snap => ({ s, hidden, metaMode, metaKeep });
  /** Steps so far (the first is how the page started) and the one on screen */
  const hist = useRef<{ snap: Snap; label: string }[]>([]);
  const at = useRef(0);
  const lastAt = useRef(0);
  /** Set while a step is applied (undo, redo, a jump) so it isn't recorded again */
  const replaying = useRef(false);
  /** Set before the page adjusts settings by itself, so that isn't a step of its own */
  const quiet = useRef(false);
  /** Set when the page sets its own starting point (saved edits, ?t=): that becomes step one */
  const baseline = useRef(false);
  const [, bump] = useState(0);
  useEffect(() => {
    const now = snap();
    if (!hist.current.length || baseline.current) {
      // The first run only sets step one; a pending baseline (saved edits) replaces it next run
      if (hist.current.length) baseline.current = false;
      hist.current = [{ snap: now, label: T("Start") }];
      at.current = 0;
      bump((n) => n + 1);
      return;
    }
    if (replaying.current) {
      replaying.current = false;
      return;
    }
    if (quiet.current) {
      // The page adjusting itself (a crop centred for a new photo): part of the current step
      quiet.current = false;
      hist.current[at.current]!.snap = now;
      return;
    }
    const prev = hist.current[at.current]!;
    const label = describe(prev.snap, now);
    if (!label) return;
    // A slider drag or quick typing on the same thing is one step
    const t = Date.now();
    const top = at.current === hist.current.length - 1 && at.current > 0;
    if (top && t - lastAt.current < 700 && prev.label === label) {
      prev.snap = now;
    } else {
      hist.current = hist.current.slice(0, at.current + 1);
      hist.current.push({ snap: now, label });
      if (hist.current.length > 80) hist.current.splice(1, 1);
      at.current = hist.current.length - 1;
    }
    lastAt.current = t;
    bump((n) => n + 1);
  }, [s, hidden, metaMode, metaKeep]);
  function goTo(i: number) {
    const to = hist.current[i];
    if (!to || i === at.current) return;
    at.current = i;
    replaying.current = true;
    lastAt.current = 0;
    setS(to.snap.s);
    setHidden(to.snap.hidden);
    setMetaMode(to.snap.metaMode);
    setMetaKeep(to.snap.metaKeep);
    bump((n) => n + 1);
  }
  const undo = () => goTo(at.current - 1);
  const redo = () => goTo(at.current + 1);
  const canUndo = at.current > 0;
  const canRedo = at.current < hist.current.length - 1;

  /** What changed between two steps, in a few words ("Watermark added", "Crop hidden") */
  function describe(a: Snap, b: Snap): string {
    const name = (id: ChangeId) => T(CHANGE_NAME[id]);
    const out: string[] = [];
    for (const id of CHANGES) {
      if (a.hidden.has(id) !== b.hidden.has(id)) {
        out.push(
          T(b.hidden.has(id) ? "{name} hidden" : "{name} shown", {
            name: name(id),
          }),
        );
        continue;
      }
      const was = clearOf(id, a.s);
      const is = clearOf(id, b.s);
      if (!was && is) out.push(T("{name} added", { name: name(id) }));
      else if (was && !is) out.push(T("{name} removed", { name: name(id) }));
      else if (
        is &&
        JSON.stringify(pick(a.s, id)) !== JSON.stringify(pick(b.s, id))
      )
        out.push(T("{name} changed", { name: name(id) }));
    }
    if (a.s.type !== b.s.type || a.s.keepFormat !== b.s.keepFormat)
      out.push(
        T("Format: {f}", {
          f: b.s.keepFormat ? T("Original") : T(FORMATS[b.s.type]),
        }),
      );
    if (a.s.quality !== b.s.quality)
      out.push(T("Quality {n}", { n: b.s.quality }));
    if (a.metaMode !== b.metaMode || a.metaKeep !== b.metaKeep)
      out.push(T("Metadata choice"));
    if (!out.length && JSON.stringify(a.s) !== JSON.stringify(b.s))
      out.push(T("Settings changed"));
    if (!out.length) return "";
    return out.length > 1 ? `${out[0]} +${out.length - 1}` : out[0]!;
  }
  /** The settings one change is made of, to tell whether it changed */
  function pick(x: Settings, id: ChangeId): unknown {
    const c = clearOf(id, x);
    return c ? Object.keys(c).map((k) => x[k as keyof Settings]) : null;
  }

  /* ---------- Edits kept for this tab ---------- */
  // Saved per browser tab (sessionStorage), with the address they belong to: a refresh brings
  // them back, and so does the switch between a tool page and /editor?t=<tool>. A watermark
  // logo is a file, so it isn't kept.
  const EDITS_KEY = "kmra-img-edits";
  const here = () => location.pathname + location.search;
  /** The latest edits, for handlers registered once (popstate) */
  const editsRef = useRef<Snap>(snap());
  editsRef.current = snap();
  function saveEdits(path = here()) {
    try {
      const e = editsRef.current;
      const keep = {
        ...e.s,
        mark: e.s.mark ? { ...e.s.mark, logo: null } : null,
      };
      sessionStorage.setItem(
        EDITS_KEY,
        JSON.stringify({
          path,
          s: keep,
          hidden: [...e.hidden],
          metaMode: e.metaMode,
          metaKeep: [...e.metaKeep],
        }),
      );
    } catch {}
  }
  function restoreEdits() {
    try {
      const raw = sessionStorage.getItem(EDITS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        path: string;
        s: Settings;
        hidden?: ChangeId[];
        metaMode: MetaMode;
        metaKeep: string[];
      };
      if (saved.path !== here()) return;
      baseline.current = true;
      if (saved.hidden) setHidden(new Set(saved.hidden));
      setS({ ...defaults(tool), ...saved.s });
      setMetaMode(saved.metaMode);
      setMetaKeep(new Set(saved.metaKeep));
    } catch {}
  }
  const restored = useRef(false);
  useEffect(() => {
    // The first render has the page's defaults; save from the first real change on
    if (!restored.current) {
      restored.current = true;
      return;
    }
    saveEdits();
  }, [s, hidden, metaMode, metaKeep, focus]);
  metaRef.current = { mode: metaMode, keep: metaKeep };
  /** Each file's fields, read once */
  const fieldCache = useRef(new Map<string, Promise<Field[] | null>>());
  const fieldsOf = (it: Item) => {
    let f = fieldCache.current.get(it.key);
    if (!f) {
      f = listFields(it.file);
      fieldCache.current.set(it.key, f);
    }
    return f;
  };
  /** Whether a field goes, for a file with these fields */
  function removes(
    fields: Field[] | null,
    mode: MetaMode,
    keep: Set<string>,
  ): (id: string) => boolean {
    const by = new Map((fields ?? []).map((f) => [f.id, f]));
    switch (mode) {
      case "all":
        return (id) => !by.get(id)?.display;
      case "sensitive":
        return (id) => by.get(id)?.sensitive ?? true;
      case "everything":
        return () => true;
      case "nothing":
        return () => false;
      default:
        return (id) => !keep.has(id);
    }
  }

  /* ---------- Processing ---------- */
  useEffect(() => {
    if (!item) return;
    const id = ++reqRef.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await produce(item, eff);
        if (id !== reqRef.current) return;
        const next = {
          ...r,
          key: item.key,
          url: URL.createObjectURL(r.preview ?? r.blob),
        };
        const old = outRef.current;
        outRef.current = next;
        setOut(next);
        if (old) URL.revokeObjectURL(old.url);
        setError(null);
      } catch (e) {
        // Keep the real reason in the console for bug reports
        console.error("Processing failed:", e);
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
  }, [item, eff, metaMode, metaKeep, act]);

  /* ---------- Mode ---------- */
  /** The workspace's address: /editor?t=<tool> (in the reader's language) */
  const editorPath = (slug: string) =>
    lp(lang, SECTION[slug] ? `/editor?t=${slug}` : "/editor");
  const onEditorPath = () => /\/editor$/.test(location.pathname);

  /** Show the workspace; on a tool page the address becomes /editor?t=<tool> without a reload */
  function enterWorkspace() {
    setAdvanced(true);
    if (!editor && !onEditorPath()) {
      history.pushState({ kmraWs: true }, "", editorPath(focus));
      saveEdits();
    }
  }
  function openAdvanced() {
    setWantAdvanced(true);
    try {
      localStorage.setItem(MODE_KEY, "advanced");
    } catch {}
    // Opens right away, with or without files: the workspace has its own drop area
    openOnFiles.current = false;
    enterWorkspace();
  }
  function closeAdvanced() {
    if (editor) {
      // The editor page is the workspace itself: go to the picked tool's page in Simple mode,
      // taking the files along, or home when no tool is picked
      try {
        localStorage.setItem(MODE_KEY, "simple");
      } catch {}
      const to = focusMeta ? lp(lang, `/${focus}`) : lp(lang, "/");
      // The edits go along to the tool's page
      if (focusMeta) saveEdits(to);
      void (
        focusMeta && items.length
          ? stashFiles(items.map((it) => it.file))
          : Promise.resolve()
      ).finally(() => (window.location.href = to));
      return;
    }
    setAdvanced(false);
    setWantAdvanced(false);
    openOnFiles.current = false;
    try {
      localStorage.setItem(MODE_KEY, "simple");
    } catch {}
    // Back to the tool's own address: undo our history entry, or replace it after a refresh
    if (onEditorPath()) {
      if ((history.state as { kmraWs?: boolean } | null)?.kmraWs)
        history.back();
      else history.replaceState(null, "", lp(lang, `/${tool}`));
      saveEdits();
    }
  }
  // Browser Back and Forward move between Simple (the tool's address) and the workspace
  useEffect(() => {
    if (editor) return;
    const onPop = () => {
      const inWs = onEditorPath();
      saveEdits();
      setAdvanced(inWs);
      setWantAdvanced(inWs);
      try {
        localStorage.setItem(MODE_KEY, inWs ? "advanced" : "simple");
      } catch {}
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
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
      // Undo / redo the edits (text fields keep their own undo)
      if (
        !typing(e) &&
        (matches(e, "mod+z") ||
          matches(e, "mod+shift+z") ||
          matches(e, "mod+y"))
      ) {
        e.preventDefault();
        if (matches(e, "mod+z")) undo();
        else redo();
        return;
      }
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
    const r = RATIOS.find((x) => x.id === eff.ratio);
    if (!r || it.key === item?.key) return eff;
    return { ...eff, crop: centeredCrop(it.w, it.h, r.r) };
  }

  /**
   * Compressing never makes a file bigger: the original is 100%, and when the re-encoded file
   * isn't smaller, the original file is the result.
   */
  function noBigger<T extends EncodeResult>(
    r: T,
    it: Item,
    st: Settings,
  ): T & { kept?: boolean } {
    if (
      act !== "compress" ||
      !KEEPABLE.has(it.file.type) ||
      !onlyEncodes(st) ||
      r.blob.size < it.file.size
    )
      return r;
    return {
      ...r,
      blob: it.file,
      w: it.w,
      h: it.h,
      type: it.file.type,
      over: false,
      kept: true,
    };
  }

  /**
   * One file with the given settings. Strip metadata on a JPEG, PNG or WebP that keeps its format
   * cuts the metadata out of the file itself (no re-encoding, no quality lost); everything else
   * renders in the worker.
   */
  async function produce(
    it: Item,
    st: Settings,
  ): Promise<EncodeResult & Pick<Out, "kept" | "lossless" | "removed">> {
    if (act === "strip-metadata" && st.keepFormat && onlyEncodes(st)) {
      const { mode, keep } = metaRef.current;
      const r = stripMetadata(
        new Uint8Array(await it.file.arrayBuffer()),
        removes(await fieldsOf(it), mode, keep),
      );
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
      let name = outName(it.file, r.type, act);
      for (let n = 2; used.has(name); n++)
        name = outName(it.file, r.type, act).replace(
          /-kmra(\.\w+)$/,
          `-${n}-kmra$1`,
        );
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
      downloadBlob(out.blob, outName(it.file, out.type, act));
      return;
    }
    try {
      const st = settingsFor(it);
      const r = await produce(it, st);
      downloadBlob(r.blob, outName(it.file, r.type, act));
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
        `images-${act === "editor" ? "edit" : act}.zip`,
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

  /* ---------- Strip metadata: what's in the photo ---------- */
  const [metaIn, setMetaIn] = useState<{
    key: string;
    fields: Field[] | null;
    sum: MetaSummary | null;
  } | null>(null);
  useEffect(() => {
    if (act !== "strip-metadata" || !item) return;
    let live = true;
    void fieldsOf(item).then(async (fields) => {
      // Formats read field by field get the checklist; the others a plain summary
      const sum = fields ? null : await readSummary(item.file);
      if (live) setMetaIn({ key: item.key, fields, sum });
    });
    return () => {
      live = false;
    };
  }, [item?.key, act]);
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
          <button
            key={v}
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
        {type === "image/png"
          ? T(
              "PNG is lossless, so there's no quality setting. Pick JPEG or WebP for smaller files.",
            )
          : T(
              "{format} has no quality setting. Pick JPEG, WebP or AVIF for smaller files.",
              {
                format: T(FORMATS[type as Format] ?? "This format"),
              },
            )}
      </p>
    );

  /** The photo on screen, in KB: size targets above it would change nothing */
  const biggestKB = item ? item.file.size / 1024 : Infinity;
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

  const dimsCtl = (
    <>
      <div className="ctl">
        <span className="lbl">{T("Size in pixels")}</span>
        <div className="row2">
          <input
            className="num"
            type="number"
            min={1}
            placeholder={item ? String(item.w) : T("Width")}
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
            placeholder={item ? String(item.h) : T("Height")}
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
  const formatOpts = (
    withOriginal: boolean,
    exclude: Format | null = null,
  ): [string, string][] => [
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
      {chipGroup<string>(
        formatOpts(true),
        formatValue,
        pickFormat,
        T("Save as"),
      )}
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
    found === undefined ? null : act === "passport-photo" ? (
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

  function metaReport(): ReactNode {
    const read = metaIn && item && metaIn.key === item.key ? metaIn : null;
    const fields = read?.fields ?? null;
    if (!item)
      return (
        <small className="muted">
          {T("Add a photo to see the hidden data in it.")}
        </small>
      );
    if (!read) return <small className="muted">{T("Reading…")}</small>;
    // Formats that are saved again from the pixels: everything goes, listed for information
    if (!fields) {
      const sum = read.sum;
      return (
        <div className="ctl meta-report">
          <span className="lbl">{T("Hidden data in this photo")}</span>
          {sum?.rows.length ? (
            <ul className="meta-rows">
              {sum.rows.map((r) => (
                <li key={r.label} className={r.private ? "priv" : undefined}>
                  <span>{T(r.label)}</span>
                  <b>{r.value}</b>
                </li>
              ))}
            </ul>
          ) : null}
          <small className="muted">
            {T(
              "This kind of file is saved again from its pixels, so all of its hidden data goes.",
            )}
          </small>
        </div>
      );
    }
    // Other edits or another format mean the picture is saved again, and then nothing comes along
    const resaved = !(eff.keepFormat && onlyEncodes(eff));
    const remove = resaved ? () => true : removes(fields, metaMode, metaKeep);
    const going = fields.filter((f) => remove(f.id));
    const toggle = (ids: string[], on: boolean) => {
      // Start from what's chosen now, then change these fields
      const keep = new Set(
        fields.filter((f) => !remove(f.id)).map((f) => f.id),
      );
      for (const id of ids) {
        if (on) keep.delete(id);
        else keep.add(id);
      }
      setMetaKeep(keep);
      setMetaMode("custom");
    };
    const presets: [MetaMode, string][] = [
      ["all", T("Remove all")],
      ["sensitive", T("Sensitive only")],
      ["everything", T("Select all")],
      ["nothing", T("Unselect all")],
    ];
    return (
      <>
        {resaved && (
          <div className="ctl meta-resave">
            <p className="warn">
              {T(
                "Another format or other edits are on, so the picture is saved again and all of its hidden data goes.",
              )}
            </p>
            <button
              type="button"
              className="btn sm"
              onClick={() =>
                setS((p) => ({ ...defaults("strip-metadata"), lock: p.lock }))
              }
            >
              {T("Clear other edits")}
            </button>
          </div>
        )}
        <div className="ctl meta-report">
          <span className="lbl meta-head">
            {T("Hidden data in this photo")}
            <small className="muted">
              {T("{n} fields", { n: fields.length })}
            </small>
          </span>
          {fields.length ? (
            <fieldset className="meta-choose" disabled={resaved}>
              {chipGroup<MetaMode>(
                presets,
                metaMode,
                setMetaMode,
                T("Choose fields to remove"),
              )}
              <small className="muted">
                {metaMode === "all"
                  ? T(
                      "Everything goes except the orientation and colour profile, which keep the picture looking the same.",
                    )
                  : metaMode === "sensitive"
                    ? T(
                        "Removes what says where, when and who: location, dates, names, serial numbers and the like.",
                      )
                    : T(
                        "Tick what to remove; unticked fields stay in the file.",
                      )}
              </small>
              <p className="meta-count">
                {T("Removing {n} of {t} fields", {
                  n: going.length,
                  t: fields.length,
                })}
              </p>
              <div className="meta-groups">
                {GROUPS.map((g) => {
                  const list = fields.filter((f) => f.group === g);
                  if (!list.length) return null;
                  const n = list.filter((f) => remove(f.id)).length;
                  return (
                    <fieldset key={g} className="meta-group">
                      <legend>
                        <label>
                          <input
                            type="checkbox"
                            checked={n === list.length}
                            ref={(el) => {
                              if (el)
                                el.indeterminate = n > 0 && n < list.length;
                            }}
                            onChange={(e) =>
                              toggle(
                                list.map((f) => f.id),
                                e.target.checked,
                              )
                            }
                          />
                          <span>{T(g)}</span>
                          <small>
                            {T("{n} of {t}", { n, t: list.length })}
                          </small>
                        </label>
                      </legend>
                      {list.map((f) => (
                        <label
                          key={f.id}
                          className={`meta-field${remove(f.id) ? " off" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={remove(f.id)}
                            onChange={(e) => toggle([f.id], e.target.checked)}
                          />
                          <span className="meta-name">
                            {T(f.label)}
                            {f.sensitive && (
                              <i
                                className="meta-tag"
                                title={T("Says where, when or who")}
                              >
                                {T("Sensitive")}
                              </i>
                            )}
                          </span>
                          <b className="meta-val" title={f.value}>
                            {f.value}
                          </b>
                        </label>
                      ))}
                    </fieldset>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <small className="muted">
              {T(
                "No hidden data in this photo. The download is the same file.",
              )}
            </small>
          )}
        </div>
      </>
    );
  }

  function simpleControls(slug = tool): ReactNode {
    switch (slug) {
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
            <FrameCtl s={s} setS={setS} mode={FRAME_MODE[slug]!} />
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
            {outForItem.w} × {outForItem.h},{" "}
            {FORMATS[outForItem.type as Format]}
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
              className={`delta up${act === "compress" || s.target ? "" : " neutral"}`}
            >
              {-pct >= 200
                ? T("{n}× larger", {
                    n: Math.round(outForItem.blob.size / item.file.size),
                  })
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
  ) =>
    focusMeta && SECTION[focus] === key ? null : (
      <section id={`ws-${key}`}>
        <h3>
          <Icon name={icon} />
          {title}
        </h3>
        {body}
      </section>
    );

  const [ow, oh] = item ? outDims(item.w, item.h, s) : [0, 0];
  const [bw, bh] = item ? baseDims(item.w, item.h, s) : [0, 0];
  /** The changes on this image, in the order they're applied */
  const changeLabel = (id: ChangeId): string => {
    switch (id) {
      case "crop":
        // Without a photo there's no size to show yet
        if (!item) return T("Crop");
        return T("Crop {w} × {h}", {
          w: Math.round((s.crop?.w ?? 0) * (item?.w ?? 0)),
          h: Math.round((s.crop?.h ?? 0) * (item?.h ?? 0)),
        });
      case "rotate":
        return T("Rotate {n}°", { n: s.rotate });
      case "resize":
        return item && (ow !== bw || oh !== bh)
          ? T("Resize {w} × {h}", { w: ow, h: oh })
          : T("Resize");
      case "target":
        return T("Fit ≤ {n} KB", { n: s.target ?? 0 });
      case "bg":
        return s.bg?.mode === "remove"
          ? T("Remove background")
          : s.bg?.mode === "blur"
            ? T("Blur background")
            : T("New background");
      case "regions":
        return T("Blur {n} areas", { n: s.redact?.regions.length ?? 0 });
      case "filter":
        return T(FILTERS.find((f) => f.id === s.filter)?.label ?? "Filter");
      case "sheet":
        return T("Print sheet {name}", {
          name: T(SHEETS.find((x) => x.id === s.sheet)?.label ?? ""),
        });
      default:
        return T(CHANGE_NAME[id]);
    }
  };
  const changes = CHANGES.filter((id) => clearOf(id, s));
  function removeChange(id: ChangeId) {
    const c = clearOf(id, s);
    if (c) set(c);
    if (hidden.has(id))
      setHidden((h) => new Set([...h].filter((x) => x !== id)));
  }
  function toggleChange(id: ChangeId) {
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  /** Show a change's controls: the tool's own panel, or its section under "More edits" */
  function openChange(id: ChangeId) {
    const sec = CHANGE_SEC[id];
    if (focusMeta && SECTION[focus] === sec) {
      document.querySelector(".insp")?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setMoreOpen(true);
    setTimeout(
      () =>
        document
          .getElementById(`ws-${sec}`)
          ?.scrollIntoView({ block: "start", behavior: "smooth" }),
      60,
    );
  }
  /** Back to how this tool starts: every change off (Undo brings them back) */
  function startOver() {
    setS(defaults(focusMeta ? focus : tool));
    setHidden(new Set());
    setMetaMode("all");
    setMetaKeep(new Set());
  }

  /** An effect section in the workspace that can be switched on and off. */
  const fxSection = (
    key: string,
    title: string,
    icon: IconKey,
    on: boolean,
    toggle: (on: boolean) => void,
    body: ReactNode,
  ) =>
    focusMeta && SECTION[focus] === key ? null : (
      <section id={`ws-${key}`}>
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

  /**
   * Pick a tool in the workspace: its panel opens on the right and its rules apply (Compress never
   * makes a file bigger, Strip metadata cuts fields out without re-encoding). Effects the tool is
   * about are switched on, so its controls have something to change; other edits stay as they are.
   */
  function pickTool(slug: string) {
    setFocus(slug);
    if (onEditorPath())
      history.replaceState(history.state, "", editorPath(slug));
    const d = defaults(slug);
    setS((p) => {
      switch (slug) {
        case "compress": {
          if (!p.keepFormat && isLossy(p.type)) return p;
          const src =
            srcFormat && isLossy(srcFormat) && srcFormat !== "image/avif"
              ? srcFormat
              : "image/jpeg";
          return { ...p, keepFormat: false, type: src };
        }
        case "strip-metadata":
          // A format or quality chosen elsewhere isn't an edit: keep the file as it is
          return onlyEncodes(p) ? { ...p, keepFormat: true, target: null } : p;
        case "adjust":
          return p.adjust ? p : { ...p, adjust: { ...NO_ADJUST } };
        case "filters":
          return p.filter ? p : { ...p, filter: d.filter };
        case "add-text":
          return p.text ? p : { ...p, text: d.text };
        case "watermark":
          return p.mark ? p : { ...p, mark: d.mark };
        case "border":
        case "extend-canvas":
        case "beautify":
          return p.frame ? p : { ...p, frame: d.frame };
        case "blur":
        case "face-blur":
          return p.redact ? p : { ...p, redact: d.redact };
        case "remove-bg":
        case "change-bg":
          return p.bg ? p : { ...p, bg: d.bg };
        case "passport-photo":
          return p.passport
            ? p
            : { ...p, passport: d.passport, bg: p.bg ?? d.bg };
        case "signature":
          return p.ink ? p : { ...p, ink: d.ink };
        default:
          return p;
      }
    });
    document.querySelector(".insp")?.scrollTo({ top: 0 });
  }
  /** The workspace's other sections; the picked tool's own one is its panel above */
  const moreSections = () => (
    <>
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
            on ? { adjust: { ...NO_ADJUST } } : { adjust: null, filter: null },
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
    </>
  );
  /** Edits outside the picked tool's own panel, for the "More edits" count */
  const extra = (
    [
      ["crop", !!s.crop],
      ["rotate", !!(s.rotate || s.flipH || s.flipV)],
      ["resize", !!(s.w || s.h || s.size || s.form || s.sheet)],
      ["look", !!(s.adjust || s.filter)],
      ["redact", !!s.redact],
      ["text", !!s.text],
      ["watermark", !!s.mark],
      ["frame", !!s.frame],
      ["background", !!s.bg],
      ["passport", !!s.passport],
      ["signature", !!s.ink],
    ] as [string, boolean][]
  ).filter(([k, on]) => on && k !== SECTION[focus]).length;
  /** Rail tools in their groups, in the order the groups first appear */
  const railGroups: [string, ToolMeta[]][] = [];
  for (const t of tools.filter((t) => SECTION[t.slug] && t.ready)) {
    const g = t.group ?? "";
    const row = railGroups.find(([k]) => k === g);
    if (row) row[1].push(t);
    else railGroups.push([g, [t]]);
  }

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
              {editor && !focusMeta ? T("Home") : T("Simple mode")}
            </span>
          </button>
          <span className="title">
            {focusMeta?.name ?? T("Image editor")}{" "}
            <small>
              {items.length
                ? `${items.length} file${items.length > 1 ? "s" : ""}`
                : T("No files yet")}
            </small>
          </span>
          <span className="right">
            <span className="undo-redo" role="group" aria-label={T("History")}>
              <button
                type="button"
                className="iconbtn"
                onClick={undo}
                disabled={!canUndo}
                aria-label={T("Undo")}
                title={T("Undo ({keys})", { keys: formatKeys("mod+Z") })}
              >
                <Icon name="undo" />
              </button>
              <button
                type="button"
                className="iconbtn"
                onClick={redo}
                disabled={!canRedo}
                aria-label={T("Redo")}
                title={T("Redo ({keys})", { keys: formatKeys("mod+shift+Z") })}
              >
                <Icon name="redo" />
              </button>
            </span>
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
          <nav className="rail" aria-label={T("Tools")}>
            {railGroups.map(([g, list]) => (
              <div key={g} className="rail-group">
                {g && <span className="rail-head">{g}</span>}
                {list.map((t) => (
                  <button
                    key={t.slug}
                    type="button"
                    title={t.name}
                    aria-label={t.name}
                    aria-pressed={focus === t.slug}
                    onClick={() => pickTool(t.slug)}
                  >
                    <Icon name={t.icon} />
                    <span className="nm">{t.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

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
                        {formatBytes(it.file.size)}
                        {/* The file on screen also shows what it becomes */}
                        {i === cur && outForItem
                          ? ` → ${formatBytes(outForItem.blob.size)}`
                          : ""}
                        , {it.w} × {it.h}
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
            {focusMeta && (
              <section className="ws-tool">
                <h3>
                  <Icon name={focusMeta.icon} />
                  {focusMeta.name}
                </h3>
                {!item && (
                  <p className="ws-hint">
                    {T(
                      "Add a photo to see the result. What you choose now applies to it.",
                    )}
                  </p>
                )}
                {simpleControls(focus)}
              </section>
            )}
            <section className="ws-changes">
              <h3>
                <Icon name="layers" />
                {T("Changes")}
                {changes.length > 0 && (
                  <small>{num(lang, changes.length)}</small>
                )}
                {(changes.length > 0 || canUndo) && (
                  <button type="button" className="fx-on" onClick={startOver}>
                    {T("Start over")}
                  </button>
                )}
              </h3>
              {changes.length ? (
                <ul className="change-list">
                  {changes.map((id) => {
                    const off = hidden.has(id);
                    const name = changeLabel(id);
                    return (
                      <li key={id} className={off ? "off" : undefined}>
                        <button
                          type="button"
                          className="ch-eye"
                          aria-pressed={!off}
                          aria-label={
                            off
                              ? T("Show {name}", { name })
                              : T("Hide {name}", { name })
                          }
                          title={off ? T("Show") : T("Hide")}
                          onClick={() => toggleChange(id)}
                        >
                          <Icon name={off ? "eyeOff" : "eye"} />
                        </button>
                        <button
                          type="button"
                          className="ch-name"
                          title={T("Show its settings")}
                          onClick={() => openChange(id)}
                        >
                          {name}
                        </button>
                        <button
                          type="button"
                          className="ch-x"
                          aria-label={T("Remove {name}", { name })}
                          title={T("Remove")}
                          onClick={() => removeChange(id)}
                        >
                          <Icon name="x" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <small className="muted">
                  {T("No changes yet. What you add shows up here.")}
                </small>
              )}
            </section>
            {hist.current.length > 1 && (
              <details className="more history">
                <summary>
                  <Icon name="clock" className="ico" />
                  {T("History")}
                  <small>
                    {T("{n} steps", { n: hist.current.length - 1 })}
                  </small>
                  <Icon name="down" className="ico caret" />
                </summary>
                <ol className="hist-list">
                  {hist.current.map((h, i) => (
                    <li
                      key={i}
                      className={i > at.current ? "ahead" : undefined}
                    >
                      <button
                        type="button"
                        aria-current={i === at.current ? "step" : undefined}
                        onClick={() => goTo(i)}
                      >
                        {h.label}
                      </button>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <details
              className="more"
              open={moreOpen}
              onToggle={(e) =>
                setMoreOpen((e.currentTarget as HTMLDetailsElement).open)
              }
            >
              <summary>
                <Icon name="sliders" />
                {editor ? T("Edits") : T("More edits")}
                {extra > 0 && <small>{T("{n} on", { n: extra })}</small>}
                <Icon name="down" className="ico caret" />
              </summary>
              {moreSections()}
            </details>
            {item && (
              <section className="ws-result">
                <div
                  className={`result${busy ? " working" : ""}`}
                  aria-live="polite"
                >
                  {resultSummary()}
                </div>
                {many && (
                  <small className="muted">{T("Applied to every file.")}</small>
                )}
              </section>
            )}
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
