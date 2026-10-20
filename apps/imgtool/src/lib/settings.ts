import type { Preset } from "@kmra/registry";
import {
  NO_ADJUST,
  NO_FRAME,
  type Adjust,
  type Bg,
  type Frame,
  type Ink,
  type Passport,
  type Redact,
  type TextLayer,
  type Watermark,
} from "./fx";

export type Format =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/avif"
  | "image/gif"
  | "image/bmp"
  | "image/tiff"
  | "image/x-icon";

/** Every format the tools save, in the order they're offered */
export const FORMATS: Record<Format, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/avif": "AVIF",
  "image/gif": "GIF",
  "image/bmp": "BMP",
  "image/tiff": "TIFF",
  "image/x-icon": "ICO",
};
export const EXT: Record<Format, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/tiff": "tif",
  "image/x-icon": "ico",
};

/** A file's format as one of ours, from its MIME type or extension (null for HEIC and others) */
export function formatOf(file: { type: string; name: string }): Format | null {
  const t = file.type.toLowerCase();
  const alias: Record<string, Format> = {
    "image/jpg": "image/jpeg",
    "image/vnd.microsoft.icon": "image/x-icon",
    "image/x-ms-bmp": "image/bmp",
    "image/tif": "image/tiff",
  };
  if (t in FORMATS) return t as Format;
  if (t in alias) return alias[t]!;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const byExt: Record<string, Format> = { jpg: "image/jpeg", jpeg: "image/jpeg", jfif: "image/jpeg", tif: "image/tiff" };
  if (byExt[ext]) return byExt[ext]!;
  return (Object.keys(EXT) as Format[]).find((f) => EXT[f] === ext) ?? null;
}

/** Formats without transparency: the render paints a background under them */
export const OPAQUE = new Set<Format>(["image/jpeg", "image/bmp"]);

export interface Settings {
  type: Format;
  /** 5–100, ignored for PNG or when `target` is set */
  quality: number;
  /** Target size in KB, or null */
  target: number | null;
  w: number | null;
  h: number | null;
  /** Keep aspect ratio. When false and both w and h are set, the image is cover-cropped to fill. */
  lock: boolean;
  /** Selected size preset id */
  size: string | null;
  /** Save in the original format instead of `type` */
  keepFormat: boolean;
  /** Clockwise rotation in degrees */
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  /** Crop area as fractions of the original image (before rotation), or null for the whole image */
  crop: Crop | null;
  /** Locked crop aspect ratio id from RATIOS, or null for free */
  ratio: string | null;
  /** Selected form preset id (FORM_PRESETS), or null */
  form: string | null;
  /* Effects (see fx.ts). null = off. */
  adjust: Adjust | null;
  /** Look id from FILTERS */
  filter: string | null;
  /** Look strength, 0..100 */
  filterAmount: number;
  redact: Redact | null;
  ink: Ink | null;
  bg: Bg | null;
  text: TextLayer | null;
  mark: Watermark | null;
  frame: Frame | null;
  /** Print sheet id from SHEETS */
  sheet: string | null;
  /** ID photo: framed around the face at an official size */
  passport: Passport | null;
}

export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const RATIOS: { id: string; label: string; r: number }[] = [
  { id: "1:1", label: "1:1", r: 1 },
  { id: "4:5", label: "4:5", r: 4 / 5 },
  { id: "3:2", label: "3:2", r: 3 / 2 },
  { id: "16:9", label: "16:9", r: 16 / 9 },
  { id: "9:16", label: "9:16", r: 9 / 16 },
];

/** Largest centred crop with the given pixel aspect ratio. */
export function centeredCrop(srcW: number, srcH: number, ratio: number): Crop {
  const imgRatio = srcW / srcH;
  if (ratio > imgRatio) {
    const h = imgRatio / ratio;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }
  const w = ratio / imgRatio;
  return { x: (1 - w) / 2, y: 0, w, h: 1 };
}

/** Size after crop and rotation, before any resize. */
export function baseDims(
  srcW: number,
  srcH: number,
  s: Settings,
): [number, number] {
  const w = s.crop ? Math.max(1, Math.round(srcW * s.crop.w)) : srcW;
  const h = s.crop ? Math.max(1, Math.round(srcH * s.crop.h)) : srcH;
  return s.rotate === 90 || s.rotate === 270 ? [h, w] : [w, h];
}

export function hasGeometry(s: Settings): boolean {
  return !!s.crop || s.rotate !== 0 || s.flipH || s.flipV;
}

/**
 * True when the job only re-encodes the image: no new size, crop, turn or effect. Then the
 * original file is an equally good answer, so compressing can keep it when re-encoding would
 * make the file bigger.
 */
export function onlyEncodes(s: Settings): boolean {
  return (
    !hasGeometry(s) &&
    !s.w &&
    !s.h &&
    !s.size &&
    !s.adjust &&
    !s.filter &&
    !s.redact &&
    !s.ink &&
    !s.bg &&
    !s.text &&
    !s.mark &&
    !s.frame &&
    !s.sheet &&
    !s.passport
  );
}

export interface SizePreset {
  id: string;
  label: string;
  w?: number;
  h?: number;
  pct?: number;
}

export const SIZES: SizePreset[] = [
  { id: "ig-square", label: "Square 1080", w: 1080, h: 1080 },
  { id: "ig-portrait", label: "Portrait 1080 × 1350", w: 1080, h: 1350 },
  { id: "ig-story", label: "Story 1080 × 1920", w: 1080, h: 1920 },
  { id: "yt", label: "YouTube 1280 × 720", w: 1280, h: 720 },
  { id: "half", label: "50%", pct: 50 },
];

export const TARGETS = [50, 100, 200, 500];

/**
 * Exact pixel size + file size limits that online forms ask for (BD job portals such as Teletalk,
 * BPSC, bank jobs and university admissions use 300×300 ≤100 KB photos and 300×80 ≤60 KB signatures).
 */
export interface FormPreset {
  id: string;
  label: string;
  hint: string;
  w: number;
  h: number;
  /** KB */
  target: number;
}

export const FORM_PRESETS: FormPreset[] = [
  {
    id: "job-photo",
    label: "Job photo",
    hint: "300 × 300, under 100 KB",
    w: 300,
    h: 300,
    target: 100,
  },
  {
    id: "job-signature",
    label: "Signature",
    hint: "300 × 80, under 60 KB",
    w: 300,
    h: 80,
    target: 60,
  },
  {
    id: "passport",
    label: "Passport / visa",
    hint: "35 × 45 mm (413 × 531), under 200 KB",
    w: 413,
    h: 531,
    target: 200,
  },
  {
    id: "us-visa",
    label: "US visa / DV",
    hint: "600 × 600, under 240 KB",
    w: 600,
    h: 600,
    target: 240,
  },
  {
    id: "admission-photo",
    label: "Admission photo",
    hint: "300 × 400, under 100 KB",
    w: 300,
    h: 400,
    target: 100,
  },
];

/** Apply a form preset: exact size (cover-cropped to fill), JPEG, best quality under the limit. */
export function applyForm(s: Settings, id: string): Settings {
  const f = FORM_PRESETS.find((x) => x.id === id);
  if (!f) return s;
  return {
    ...s,
    form: id,
    w: f.w,
    h: f.h,
    lock: false,
    size: null,
    target: f.target,
    type: "image/jpeg",
    keepFormat: false,
  };
}

export function defaults(tool: string): Settings {
  const base: Settings = {
    type: "image/jpeg",
    quality: 80,
    target: null,
    w: null,
    h: null,
    lock: true,
    size: null,
    keepFormat: false,
    rotate: 0,
    flipH: false,
    flipV: false,
    crop: null,
    ratio: null,
    form: null,
    adjust: null,
    filter: null,
    filterAmount: 100,
    redact: null,
    ink: null,
    bg: null,
    text: null,
    mark: null,
    frame: null,
    sheet: null,
    passport: null,
  };
  const keep = { ...base, keepFormat: true, quality: 92 };
  const png = { ...base, type: "image/png" as Format };
  switch (tool) {
    case "adjust":
      return { ...keep, adjust: { ...NO_ADJUST } };
    case "filters":
      return { ...keep, filter: "vintage" };
    case "border":
      return {
        ...keep,
        frame: { ...NO_FRAME, border: 3, borderColor: "#ffffff", radius: 0 },
      };
    case "extend-canvas":
      return { ...keep, frame: { ...NO_FRAME, ratio: "1:1", fill: "blur" } };
    case "beautify":
      return {
        ...png,
        frame: {
          ...NO_FRAME,
          pad: 9,
          fill: "gradient",
          radius: 1.6,
          shadow: true,
          chrome: "light",
        },
      };
    case "watermark":
      return {
        ...keep,
        mark: {
          text: "© Your name",
          logo: null,
          logoName: "",
          pos: "br",
          size: 4,
          opacity: 70,
          color: "#ffffff",
        },
      };
    case "add-text":
      return {
        ...base,
        quality: 90,
        text: {
          top: "",
          bottom: "",
          size: 10,
          color: "#ffffff",
          stroke: true,
          font: "impact",
        },
      };
    case "blur":
      return {
        ...keep,
        redact: {
          faces: false,
          mode: "pixelate",
          strength: 50,
          color: "#000000",
          shape: "rect",
          regions: [],
        },
      };
    case "face-blur":
      return {
        ...keep,
        redact: {
          faces: true,
          mode: "blur",
          strength: 60,
          color: "#000000",
          shape: "ellipse",
          regions: [],
        },
      };
    case "signature":
      return { ...png, ink: { threshold: 50, color: "keep", trim: true } };
    case "remove-bg":
      return {
        ...png,
        bg: { mode: "remove", color: "#ffffff", model: "auto" },
      };
    case "change-bg":
      return {
        ...base,
        quality: 92,
        bg: { mode: "color", color: "#ffffff", model: "auto" },
      };
    case "passport-photo":
      return {
        ...base,
        quality: 95,
        passport: { spec: "35x45", zoom: 0 },
        bg: { mode: "color", color: "#ffffff", model: "person" },
      };
  }
  if (tool === "resize") return { ...base, keepFormat: true, quality: 90 };
  if (tool === "form-size") return applyForm(base, "job-photo");
  if (
    tool === "strip-metadata" ||
    tool === "crop" ||
    tool === "rotate" ||
    tool === "editor"
  )
    return { ...base, keepFormat: true, quality: 92 };
  return base;
}

export function applySize(s: Settings, id: string): Settings {
  const p = SIZES.find((x) => x.id === id);
  if (!p) return s;
  return p.pct
    ? { ...s, size: id, w: null, h: null, lock: true }
    : { ...s, size: id, w: p.w!, h: p.h!, lock: false };
}

export function applyPreset(s: Settings, preset?: Preset): Settings {
  if (!preset) return s;
  let out = { ...s };
  for (const [k, v] of Object.entries(preset)) {
    if (k === "size" && typeof v === "string") out = applySize(out, v);
    else if (k === "form" && typeof v === "string") out = applyForm(out, v);
    // Nested settings that a flat task preset can't spell out directly
    else if (k === "spec" && typeof v === "string")
      out = { ...out, passport: { zoom: 0, ...out.passport, spec: v } };
    else if (k === "frameRatio" && typeof v === "string")
      out = { ...out, frame: { ...(out.frame ?? NO_FRAME), ratio: v } };
    else (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** Final output size: crop and rotation first, then any resize. */
export function outDims(
  origW: number,
  origH: number,
  s: Settings,
): [number, number] {
  const [srcW, srcH] = baseDims(origW, origH, s);
  return fitDims(srcW, srcH, s);
}

/** Resize step alone: the size for a source of srcW × srcH. */
export function fitDims(
  srcW: number,
  srcH: number,
  s: Settings,
): [number, number] {
  const p = s.size ? SIZES.find((x) => x.id === s.size) : undefined;
  if (p?.pct)
    return [
      Math.max(1, Math.round((srcW * p.pct) / 100)),
      Math.max(1, Math.round((srcH * p.pct) / 100)),
    ];
  let w = s.w ?? srcW;
  let h = s.h ?? srcH;
  if (s.lock) {
    if (s.w && !s.h) h = Math.round((s.w * srcH) / srcW);
    else if (s.h && !s.w) w = Math.round((s.h * srcW) / srcH);
    else if (s.w && s.h) h = Math.round((s.w * srcH) / srcW);
  }
  return [Math.max(1, w), Math.max(1, h)];
}

export function outType(srcType: string, s: Settings): Format {
  if (s.keepFormat && srcType in FORMATS) return srcType as Format;
  return s.type;
}

/** Formats with a quality setting */
export function isLossy(t: Format): boolean {
  return t === "image/jpeg" || t === "image/webp" || t === "image/avif";
}
