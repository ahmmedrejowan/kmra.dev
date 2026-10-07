import type { Crop } from "./settings";

/**
 * Effects that run after crop, rotate and resize. Plain data, so the worker gets them with the
 * rest of the settings. Every field is optional on Settings: null means "off".
 */

/** Light and colour. Each slider is -100..100 with 0 = unchanged, except sharpen and vignette (0..100). */
export interface Adjust {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  sharpen: number;
  vignette: number;
}

export const NO_ADJUST: Adjust = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  sharpen: 0,
  vignette: 0,
};

export const ADJUST_SLIDERS: {
  key: keyof Adjust;
  label: string;
  min: number;
}[] = [
  { key: "brightness", label: "Brightness", min: -100 },
  { key: "contrast", label: "Contrast", min: -100 },
  { key: "saturation", label: "Saturation", min: -100 },
  { key: "warmth", label: "Warmth", min: -100 },
  { key: "sharpen", label: "Sharpen", min: 0 },
  { key: "vignette", label: "Vignette", min: 0 },
];

/** 4×5 colour matrix, row-major: [r', g', b', a'] = M · [r, g, b, a, 255] */
export type Matrix = number[];

export const IDENTITY: Matrix = [
  1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
];

const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

export function saturate(v: number): Matrix {
  const a = 1 - v;
  return [
    LR * a + v,
    LG * a,
    LB * a,
    0,
    0,
    LR * a,
    LG * a + v,
    LB * a,
    0,
    0,
    LR * a,
    LG * a,
    LB * a + v,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ];
}

export function contrast(v: number): Matrix {
  const o = 128 * (1 - v);
  return [v, 0, 0, 0, o, 0, v, 0, 0, o, 0, 0, v, 0, o, 0, 0, 0, 1, 0];
}

function brightness(v: number): Matrix {
  return [v, 0, 0, 0, 0, 0, v, 0, 0, 0, 0, 0, v, 0, 0, 0, 0, 0, 1, 0];
}

function offset(r: number, g: number, b: number): Matrix {
  return [1, 0, 0, 0, r, 0, 1, 0, 0, g, 0, 0, 1, 0, b, 0, 0, 0, 1, 0];
}

const SEPIA: Matrix = [
  0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0,
  0, 0, 0, 0, 1, 0,
];

/** a · b: apply b first, then a */
export function mul(a: Matrix, b: Matrix): Matrix {
  const out = new Array<number>(20).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = c === 4 ? a[r * 5 + 4]! : 0;
      for (let k = 0; k < 4; k++) v += a[r * 5 + k]! * b[k * 5 + c]!;
      out[r * 5 + c] = v;
    }
  }
  return out;
}

export function lerp(a: Matrix, b: Matrix, t: number): Matrix {
  return a.map((v, i) => v + (b[i]! - v) * t);
}

const chain = (...ms: Matrix[]) => ms.reduceRight((acc, m) => mul(m, acc));

/** Looks, applied after the sliders. `swatch` is a CSS gradient for the picker. */
export const FILTERS: {
  id: string;
  label: string;
  m: Matrix;
  swatch: string;
}[] = [
  {
    id: "mono",
    label: "Mono",
    m: saturate(0),
    swatch: "linear-gradient(135deg,#eee,#333)",
  },
  {
    id: "noir",
    label: "Noir",
    m: chain(contrast(1.45), saturate(0)),
    swatch: "linear-gradient(135deg,#fff,#000 70%)",
  },
  {
    id: "sepia",
    label: "Sepia",
    m: SEPIA,
    swatch: "linear-gradient(135deg,#f3e0c0,#6b4a2b)",
  },
  {
    id: "vintage",
    label: "Vintage",
    m: chain(offset(18, 8, -6), contrast(0.85), lerp(IDENTITY, SEPIA, 0.45)),
    swatch: "linear-gradient(135deg,#f6dcb0,#8a6a5a)",
  },
  {
    id: "vivid",
    label: "Vivid",
    m: chain(contrast(1.12), saturate(1.5)),
    swatch: "linear-gradient(135deg,#ff3d6e,#ffb300,#00c2ff)",
  },
  {
    id: "warm",
    label: "Warm",
    m: chain(offset(16, 4, -16), saturate(1.1)),
    swatch: "linear-gradient(135deg,#ffd27a,#ff7a45)",
  },
  {
    id: "cool",
    label: "Cool",
    m: chain(offset(-14, 2, 18), saturate(0.95)),
    swatch: "linear-gradient(135deg,#9ee7ff,#3a5bff)",
  },
  {
    id: "fade",
    label: "Fade",
    m: chain(offset(22, 22, 22), contrast(0.78), saturate(0.8)),
    swatch: "linear-gradient(135deg,#e9e4dc,#9aa3ad)",
  },
  {
    id: "dramatic",
    label: "Dramatic",
    m: chain(contrast(1.35), saturate(0.7), brightness(0.95)),
    swatch: "linear-gradient(135deg,#9aa,#123)",
  },
  {
    id: "invert",
    label: "Invert",
    m: [-1, 0, 0, 0, 255, 0, -1, 0, 0, 255, 0, 0, -1, 0, 255, 0, 0, 0, 1, 0],
    swatch: "linear-gradient(135deg,#00f,#ff0)",
  },
];

/** Colour matrix for the sliders and the chosen look (at `amount` 0..100). */
export function colorMatrix(
  a: Adjust | null,
  filter: string | null,
  amount: number,
): Matrix | null {
  const parts: Matrix[] = [];
  if (a) {
    if (a.brightness) parts.push(brightness(1 + a.brightness / 100));
    if (a.contrast)
      parts.push(
        contrast(a.contrast > 0 ? 1 + a.contrast / 70 : 1 + a.contrast / 100),
      );
    if (a.saturation) parts.push(saturate(1 + a.saturation / 100));
    if (a.warmth) {
      const t = a.warmth * 0.3;
      parts.push(offset(t, t * 0.2, -t));
    }
  }
  const f = FILTERS.find((x) => x.id === filter);
  if (f) parts.push(lerp(IDENTITY, f.m, amount / 100));
  if (!parts.length) return null;
  // Sliders first, then the look
  return parts.reduce((acc, m) => mul(m, acc));
}

/** Blur or pixelate parts of the image. Regions are fractions of the original image. */
export interface Redact {
  mode: "blur" | "pixelate" | "fill";
  /** 1..100 */
  strength: number;
  color: string;
  shape: "rect" | "ellipse";
  regions: Crop[];
}

/** Turn a photographed signature into clean ink on a transparent (or white) background. */
export interface Ink {
  /** 0..100: higher keeps fainter strokes */
  threshold: number;
  /** "keep" keeps the pen colour, otherwise a CSS hex colour */
  color: string;
  /** Trim empty space around the signature */
  trim: boolean;
}

/** Replace the background behind the main subject. Needs the background model. */
export interface Bg {
  mode: "remove" | "color" | "blur";
  color: string;
}

export interface TextLayer {
  top: string;
  bottom: string;
  /** Font size as % of image width */
  size: number;
  color: string;
  /** Outline in the opposite colour, like classic memes */
  stroke: boolean;
  font: "impact" | "sans" | "serif";
}

export const FONTS: Record<TextLayer["font"], string> = {
  impact: 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

export type Spot =
  "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br" | "tile";

export interface Watermark {
  text: string;
  /** Logo image, used instead of the text when set */
  logo: Blob | null;
  logoName: string;
  pos: Spot;
  /** % of image width: text height for text, logo width for logos */
  size: number;
  /** 0..100 */
  opacity: number;
  color: string;
}

export interface Frame {
  /** Space around the image, % of its shorter side */
  pad: number;
  /** Canvas aspect ratio id (RATIOS) to pad out to, or null */
  ratio: string | null;
  fill: "color" | "blur" | "gradient" | "transparent";
  color: string;
  /** Gradient id from GRADIENTS */
  gradient: string;
  /** Corner radius, % of the image's shorter side */
  radius: number;
  /** Border width, % of the image's shorter side */
  border: number;
  borderColor: string;
  shadow: boolean;
  /** Browser window bar above the image (for screenshots) */
  chrome: "none" | "light" | "dark";
}

export const GRADIENTS: { id: string; stops: string[] }[] = [
  { id: "ocean", stops: ["#4f8cff", "#7b5cff"] },
  { id: "sunset", stops: ["#ff9a5a", "#ff5e8a"] },
  { id: "mint", stops: ["#5ee7b0", "#2fa7d6"] },
  { id: "peach", stops: ["#ffe0c2", "#ffb3c6"] },
  { id: "night", stops: ["#1e2a4a", "#4b2a6b"] },
  { id: "slate", stops: ["#e7ebf0", "#c9d2de"] },
];

export const NO_FRAME: Frame = {
  pad: 0,
  ratio: null,
  fill: "color",
  color: "#ffffff",
  gradient: "ocean",
  radius: 0,
  border: 0,
  borderColor: "#ffffff",
  shadow: false,
  chrome: "none",
};

/** Print sheets for ID photos, at 300 dpi */
export const SHEETS: { id: string; label: string; w: number; h: number }[] = [
  { id: "4x6", label: "4 × 6 in", w: 1800, h: 1200 },
  { id: "5x7", label: "5 × 7 in", w: 2100, h: 1500 },
  { id: "a4", label: "A4", w: 2480, h: 3508 },
];
