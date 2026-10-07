import type { Preset } from "@kmra/registry";

export type Format = "image/jpeg" | "image/png" | "image/webp";

export const FORMATS: Record<Format, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
};
export const EXT: Record<Format, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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
  };
  if (tool === "resize") return { ...base, keepFormat: true, quality: 90 };
  if (tool === "strip-metadata")
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
    else (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function outDims(
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

export function isLossy(t: Format): boolean {
  return t !== "image/png";
}
