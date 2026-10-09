/**
 * Palettes: colour schemes and random palettes in OKLCH, and the Tailwind-style 50–950 scale.
 */
import {
  col,
  fit,
  mapOklch,
  toHex,
  toOklch,
  toOklchString,
  type Rgba,
} from "./color";

export type Scheme =
  | "complementary"
  | "analogous"
  | "triadic"
  | "tetradic"
  | "split-complementary"
  | "monochromatic";

export const SCHEMES: { id: Scheme; name: string; about: string }[] = [
  { id: "complementary", name: "Complementary", about: "Opposite hues, 180° apart." },
  { id: "analogous", name: "Analogous", about: "Neighbours, 30° either side." },
  { id: "triadic", name: "Triadic", about: "Three hues, 120° apart." },
  { id: "tetradic", name: "Tetradic", about: "Two complementary pairs, 60° apart." },
  {
    id: "split-complementary",
    name: "Split complementary",
    about: "The base and the two hues next to its opposite, 150° and 210°.",
  },
  {
    id: "monochromatic",
    name: "Monochromatic",
    about: "One hue in five lightness steps.",
  },
];

/** Hue offsets per scheme, from the base hue */
export const OFFSETS: Record<Exclude<Scheme, "monochromatic">, number[]> = {
  complementary: [0, 180],
  analogous: [-30, 0, 30],
  triadic: [0, 120, 240],
  tetradic: [0, 60, 180, 240],
  "split-complementary": [0, 150, 210],
};

const mod360 = (h: number) => ((h % 360) + 360) % 360;

/**
 * A scheme from `base`, computed in OKLCH: every colour keeps the base's lightness and chroma
 * (mapped into sRGB), only the hue turns. Monochromatic keeps the hue and steps the lightness.
 */
export function scheme(base: Rgba, s: Scheme): Rgba[] {
  const b = fit(base);
  const [L, C, H] = toOklch(b);
  if (s === "monochromatic") {
    // Five evenly spaced lightness steps; the nearest one is the base itself
    const ladder = [0.95, 0.775, 0.6, 0.425, 0.25];
    let at = 0;
    ladder.forEach((x, i) => {
      if (Math.abs(x - L) < Math.abs(ladder[at]! - L)) at = i;
    });
    return ladder.map((l, i) =>
      i === at ? { ...b, a: 1 } : mapOklch(l, C * chromaAt(l, L), H, 1, 0),
    );
  }
  return OFFSETS[s].map((o) =>
    o === 0 ? { ...b, a: 1 } : mapOklch(L, C, mod360(H + o), 1, 0),
  );
}

/** Lower chroma near white and black, so tints and shades don't look neon */
function chromaAt(l: number, base: number) {
  const f = (x: number) => Math.max(0.15, 1 - Math.abs(x - 0.6) * 1.6);
  return Math.min(1.2, f(l) / f(base));
}

/** A random palette of `n` colours that go together; `keep` holds locked colours by index */
export function randomPalette(
  n: number,
  keep: (Rgba | null)[] = [],
  rand = Math.random,
): Rgba[] {
  const locked = keep.filter(Boolean) as Rgba[];
  // Start from a locked colour's hue when there is one, so new colours fit with it
  const H0 = locked.length ? toOklch(locked[0]!)[2] : rand() * 360;
  const harmonies = [
    [0, 30, 60, 180, 210],
    [0, 120, 240, 20, 140],
    [0, 150, 210, 30, 180],
    [0, 25, 50, 75, 100],
    [0, 180, 15, 195, 0],
    [0, 90, 180, 270, 45],
  ];
  const pick = harmonies[Math.floor(rand() * harmonies.length)]!;
  // Spread lightness from dark to light, then shuffle
  const Ls = Array.from(
    { length: n },
    (_, i) => 0.28 + (0.68 * (i + rand() * 0.6)) / Math.max(1, n - 0.4),
  );
  for (let i = Ls.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [Ls[i], Ls[j]] = [Ls[j]!, Ls[i]!];
  }
  const baseC = 0.06 + rand() * 0.12;
  return Array.from({ length: n }, (_, i) => {
    const k = keep[i];
    if (k) return k;
    const L = Math.min(0.97, Ls[i]!);
    const H = mod360(H0 + pick[i % pick.length]! + (rand() - 0.5) * 16);
    // Very light and very dark colours get less chroma
    const C = baseC * (L > 0.9 ? 0.4 : L < 0.35 ? 0.7 : 1) * (0.7 + rand() * 0.6);
    return col(toHex(mapOklch(L, C, H, 1, 0), false));
  });
}

/* ---------- 50–950 scale ---------- */

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
/** Tailwind v4's lightness ramp (OKLCH L), averaged over its colour scales */
const RAMP = [0.975, 0.935, 0.885, 0.81, 0.71, 0.63, 0.55, 0.485, 0.425, 0.375, 0.28];
/** Chroma relative to the strongest step, as in Tailwind's scales */
const CHROMA = [0.06, 0.13, 0.25, 0.44, 0.72, 0.92, 1, 0.93, 0.77, 0.6, 0.38];

export interface Shade {
  step: number;
  color: Rgba;
  /** The base colour itself sits on this step */
  base: boolean;
}

/**
 * Eleven steps from 50 to 950. The base colour lands, unchanged, on the step whose lightness is
 * closest; the steps around it are moved in proportion so the ramp stays smooth and ends at
 * Tailwind's lightest and darkest values.
 */
export function shadeScale(base0: Rgba): Shade[] {
  const base = { ...fit(base0), a: 1 };
  const [L, C, H] = toOklch(base);
  let at = 0;
  for (let i = 1; i < RAMP.length; i++)
    if (Math.abs(RAMP[i]! - L) < Math.abs(RAMP[at]! - L)) at = i;
  const shift = L - RAMP[at]!;
  const last = RAMP.length - 1;
  return STEPS.map((step, i) => {
    if (i === at) return { step, color: base, base: true };
    // Full shift at the base's step, fading to none at both ends
    const w = i < at ? (at === 0 ? 0 : i / at) : at === last ? 0 : (last - i) / (last - at);
    const l = Math.min(0.99, Math.max(0.12, RAMP[i]! + shift * w));
    // Greys stay grey; pale colours may grow up to a moderate chroma in the middle steps
    const c =
      C < 0.004 ? 0 : Math.min(0.37, (C * CHROMA[i]!) / CHROMA[at]!, C * 6 + 0.03);
    return { step, color: col(toHex(mapOklch(l, c, H, 1, 0), false)), base: false };
  });
}

/* ---------- exports ---------- */

export type ValueFormat = "hex" | "oklch";
const val = (c: Rgba, f: ValueFormat) =>
  f === "hex" ? toHex(c, false) : toOklchString(c);

export function cssVariables(
  entries: [string, Rgba][],
  f: ValueFormat = "hex",
): string {
  return `:root {\n${entries.map(([k, c]) => `  --${k}: ${val(c, f)};`).join("\n")}\n}`;
}

export function themeBlock(
  entries: [string, Rgba][],
  f: ValueFormat = "hex",
): string {
  return `@theme {\n${entries.map(([k, c]) => `  --color-${k}: ${val(c, f)};`).join("\n")}\n}`;
}

export function jsonOf(entries: [string, Rgba][], f: ValueFormat = "hex") {
  return JSON.stringify(
    Object.fromEntries(entries.map(([k, c]) => [k, val(c, f)])),
    null,
    2,
  );
}

/** tailwind.config.js `colors` object for one named scale */
export function tailwindConfig(
  name: string,
  shades: Shade[],
  f: ValueFormat = "hex",
): string {
  const key = /^[a-z_$][\w$]*$/i.test(name) ? name : `"${name}"`;
  return `// tailwind.config.js\nexport default {\n  theme: {\n    extend: {\n      colors: {\n        ${key}: {\n${shades
    .map((s) => `          ${s.step}: "${val(s.color, f)}",`)
    .join("\n")}\n        },\n      },\n    },\n  },\n};`;
}

/** A safe CSS identifier from what someone typed */
export function slugName(s: string, fallback = "brand"): string {
  const x = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return x || fallback;
}
