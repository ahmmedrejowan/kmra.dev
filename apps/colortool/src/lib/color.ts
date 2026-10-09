/**
 * A small colour library, no dependencies.
 *
 * Colours are kept as sRGB channels 0–1 (`Rgba`), which may fall outside 0–1 for wide-gamut input
 * such as a vivid oklch(); `fit()` maps them into sRGB for display (CSS Color 4 gamut mapping:
 * lower the OKLCH chroma until the colour fits). OKLab and OKLCH follow Björn Ottosson; WCAG
 * contrast follows WCAG 2.x.
 *
 * Parses: HEX (3, 4, 6, 8 digits, with or without #), rgb()/rgba(), hsl()/hsla(), hwb(), hsv(),
 * cmyk(), oklch(), oklab(), color(srgb …), color(srgb-linear …), the 148 CSS named colours,
 * "transparent", and loose input like "30 144 255" or "rgb 30 144 255".
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type Kind =
  | "hex"
  | "rgb"
  | "hsl"
  | "hwb"
  | "hsv"
  | "cmyk"
  | "oklch"
  | "oklab"
  | "linear"
  | "name";

export class ColorError extends Error {}

/* ---------- the 148 CSS named colours ---------- */

const NAMED_RAW =
  "aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080 honeydew f0fff0 hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5 lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585 midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32";

export const NAMED: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  const p = NAMED_RAW.split(" ");
  for (let i = 0; i < p.length; i += 2) m.set(p[i]!, p[i + 1]!);
  return m;
})();

/* ---------- small helpers ---------- */

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mod360 = (h: number) => ((h % 360) + 360) % 360;

/** Rounds for display; never prints -0 */
export function round(v: number, d = 0): string {
  const p = 10 ** d;
  const x = Math.round(v * p) / p;
  return Object.is(x, -0) || x === 0 ? "0" : String(x);
}

export function rgba(r: number, g: number, b: number, a = 1): Rgba {
  return { r, g, b, a };
}

/* ---------- linear RGB ---------- */

export function toLinear(c: number): number {
  const a = Math.abs(c);
  return (
    Math.sign(c) * (a <= 0.04045 ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4)
  );
}
export function fromLinear(c: number): number {
  const a = Math.abs(c);
  return (
    Math.sign(c) * (a <= 0.0031308 ? 12.92 * a : 1.055 * a ** (1 / 2.4) - 0.055)
  );
}
export function toLinearRgb(c: Rgba): [number, number, number] {
  return [toLinear(c.r), toLinear(c.g), toLinear(c.b)];
}
export function fromLinearRgb(r: number, g: number, b: number, a = 1): Rgba {
  return { r: fromLinear(r), g: fromLinear(g), b: fromLinear(b), a };
}

/* ---------- OKLab / OKLCH ---------- */

export function toOklab(c: Rgba): [number, number, number] {
  const [lr, lg, lb] = toLinearRgb(c);
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function fromOklab(L: number, A: number, B: number, a = 1): Rgba {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return fromLinearRgb(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    a,
  );
}

/** [L 0–1, C, H degrees]; H is 0 for greys */
export function toOklch(c: Rgba): [number, number, number] {
  const [L, A, B] = toOklab(c);
  const C = Math.hypot(A, B);
  const H = C < 1e-4 ? 0 : mod360((Math.atan2(B, A) * 180) / Math.PI);
  return [L, C, H];
}

export function fromOklch(L: number, C: number, H: number, a = 1): Rgba {
  const h = (H * Math.PI) / 180;
  return fromOklab(L, C * Math.cos(h), C * Math.sin(h), a);
}

/** Distance in OKLab (ΔEOK); about 0.02 is just noticeable */
export function deltaE(x: Rgba, y: Rgba): number {
  const p = toOklab(x);
  const q = toOklab(y);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/* ---------- gamut ---------- */

export function inGamut(c: Rgba, eps = 1e-4): boolean {
  return [c.r, c.g, c.b].every((v) => v >= -eps && v <= 1 + eps);
}

export function clip(c: Rgba): Rgba {
  return { r: clamp01(c.r), g: clamp01(c.g), b: clamp01(c.b), a: clamp01(c.a) };
}

/**
 * An OKLCH colour mapped into sRGB the CSS Color 4 way: keep lightness and hue, lower chroma until
 * the colour fits (or clipping changes it by less than a just noticeable difference).
 */
export function mapOklch(
  L: number,
  C: number,
  H: number,
  a = 1,
  /** Allowed clipping error; 0 keeps the hue exact (palettes), 0.02 is the CSS default */
  jnd = 0.02,
): Rgba {
  if (L >= 1) return { r: 1, g: 1, b: 1, a };
  if (L <= 0) return { r: 0, g: 0, b: 0, a };
  const first = fromOklch(L, C, H, a);
  if (inGamut(first)) return clip(first);
  const JND = jnd;
  if (JND > 0 && deltaE(clip(first), first) < JND) return clip(first);
  let lo = 0;
  let hi = C;
  while (hi - lo > 1e-4) {
    const mid = (lo + hi) / 2;
    const cur = fromOklch(L, mid, H, a);
    if (inGamut(cur)) {
      lo = mid;
      continue;
    }
    const e = JND > 0 ? deltaE(clip(cur), cur) : Infinity;
    if (e < JND) {
      if (JND - e < 1e-4) return clip(cur);
      lo = mid;
    } else hi = mid;
  }
  return clip(fromOklch(L, lo, H, a));
}

/** Any colour, made displayable in sRGB */
export function fit(c: Rgba): Rgba {
  if (inGamut(c)) return clip(c);
  const [L, C, H] = toOklch(c);
  return mapOklch(L, C, H, clamp01(c.a));
}

/* ---------- HSL, HSV, HWB, CMYK ---------- */

export function hslToRgb(h: number, s: number, l: number, a = 1): Rgba {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const q = s * Math.min(l, 1 - l);
    return l - q * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return { r: f(0), g: f(8), b: f(4), a };
}

function hueOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d <= 0) return 0;
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return mod360(h * 60);
}

/** [h degrees, s 0–1, l 0–1] */
export function toHsl(c: Rgba): [number, number, number] {
  const { r, g, b } = clip(c);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 || l === 0 || l === 1 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [hueOf(r, g, b), s, l];
}

/** [h degrees, s 0–1, v 0–1] */
export function toHsv(c: Rgba): [number, number, number] {
  const { r, g, b } = clip(c);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  return [hueOf(r, g, b), max === 0 ? 0 : d / max, max];
}

export function hsvToRgb(h: number, s: number, v: number, a = 1): Rgba {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: f(5), g: f(3), b: f(1), a };
}

export function hwbToRgb(h: number, w: number, bl: number, a = 1): Rgba {
  if (w + bl >= 1) {
    const g = w / (w + bl);
    return { r: g, g, b: g, a };
  }
  const c = hslToRgb(h, 1, 0.5);
  const f = (x: number) => x * (1 - w - bl) + w;
  return { r: f(c.r), g: f(c.g), b: f(c.b), a };
}

/** [h, whiteness 0–1, blackness 0–1] */
export function toHwb(c: Rgba): [number, number, number] {
  const { r, g, b } = clip(c);
  return [hueOf(r, g, b), Math.min(r, g, b), 1 - Math.max(r, g, b)];
}

/** Naive (device) CMYK, 0–1 each; print shops convert with ICC profiles, so treat it as a guide */
export function toCmyk(c: Rgba): [number, number, number, number] {
  const { r, g, b } = clip(c);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k];
}

export function cmykToRgb(c: number, m: number, y: number, k: number, a = 1) {
  return { r: (1 - c) * (1 - k), g: (1 - m) * (1 - k), b: (1 - y) * (1 - k), a };
}

/* ---------- parsing ---------- */

const NUM = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%?)$/i;

/** A number; percentages scale to `pct` (e.g. 255 for rgb channels) */
function num(tok: string, pct: number): number {
  if (tok === "none") return 0;
  const m = NUM.exec(tok);
  if (!m) throw new ColorError("One of the values isn't a number.");
  const v = parseFloat(m[1]!);
  return m[2] ? (v / 100) * pct : v;
}

/** A number that means 0–1 whether it's written as 0.5 or 50% (or 50 with `wholeIsPct`) */
function unit(tok: string, wholeIsPct = true): number {
  if (tok === "none") return 0;
  const m = NUM.exec(tok);
  if (!m) throw new ColorError("One of the values isn't a number.");
  const v = parseFloat(m[1]!);
  if (m[2]) return v / 100;
  return wholeIsPct && v > 1 ? v / 100 : v;
}

function hue(tok: string): number {
  if (tok === "none") return 0;
  const m =
    /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn|°)?$/i.exec(tok);
  if (!m) throw new ColorError("The hue isn't a number or an angle.");
  const v = parseFloat(m[1]!);
  const u = (m[2] ?? "deg").toLowerCase();
  const deg =
    u === "rad"
      ? (v * 180) / Math.PI
      : u === "grad"
        ? v * 0.9
        : u === "turn"
          ? v * 360
          : v;
  return mod360(deg);
}

function alphaOf(tok: string | undefined): number {
  if (tok === undefined) return 1;
  return clamp01(num(tok, 1));
}

/** "a b c / d", "a, b, c, d" → channels and alpha */
function args(inner: string): { ch: string[]; a?: string } {
  const t = inner.trim();
  if (t.includes(",")) {
    const p = t
      .replace("/", ",")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    return { ch: p, a: undefined };
  }
  const [main, a] = t.split("/").map((x) => x.trim());
  return { ch: main!.split(/\s+/).filter(Boolean), a: a || undefined };
}

function hexColor(h: string): Rgba {
  const x =
    h.length <= 4
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const v = (i: number) => parseInt(x.slice(i, i + 2), 16) / 255;
  return { r: v(0), g: v(2), b: v(4), a: x.length === 8 ? v(6) : 1 };
}

const FORMS =
  "Use HEX, rgb(), hsl(), hwb(), oklch(), oklab(), a colour name, or three numbers like 30 144 255.";

/** Reads any supported colour. Throws ColorError with a plain message when it can't. */
export function parseColor(input: string): { color: Rgba; kind: Kind } {
  let s = input
    .trim()
    .toLowerCase()
    .replace(/;$/, "")
    .replace(/^(?:[a-z-]+\s*:\s*)/, "") // "color: red", "--brand: #fff"
    .trim();
  if (!s) throw new ColorError("Type a colour.");
  if (s === "transparent") return { color: rgba(0, 0, 0, 0), kind: "name" };
  const named = NAMED.get(s.replace(/\s+/g, ""));
  if (named) return { color: hexColor(named), kind: "name" };
  const h = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (h && (s.startsWith("#") || /[a-f]/.test(s) || h[1]!.length >= 6))
    return { color: hexColor(h[1]!), kind: "hex" };
  if (s.startsWith("0x") && /^0x[0-9a-f]{6}$/.test(s))
    return { color: hexColor(s.slice(2)), kind: "hex" };

  // Loose numbers: "30 144 255", "30, 144, 255", "30 144 255 0.5"
  const loose = s
    .replace(/[()]/g, " ")
    .split(/[\s,/]+/)
    .filter(Boolean);
  if (
    (loose.length === 3 || loose.length === 4) &&
    loose.every((x) => NUM.test(x))
  ) {
    const [r, g, b] = loose.slice(0, 3).map((x) => num(x, 255));
    if ([r, g, b].every((v) => v! >= 0 && v! <= 255))
      return {
        color: rgba(r! / 255, g! / 255, b! / 255, alphaOf(loose[3])),
        kind: "rgb",
      };
  }

  // "rgb 30 144 255" without brackets
  const bare = /^([a-z-]+)\s+([^()]+)$/.exec(s);
  if (bare) s = `${bare[1]}(${bare[2]})`;
  const f = /^([a-z-]+)\((.*)\)$/s.exec(s);
  if (!f) throw new ColorError(FORMS);
  let fn = f[1]!;
  let inner = f[2]!;
  if (fn === "color") {
    const m = /^\s*([a-z0-9-]+)\s+(.*)$/s.exec(inner);
    if (!m) throw new ColorError(FORMS);
    fn = m[1] === "srgb" ? "srgb" : m[1] === "srgb-linear" ? "srgb-linear" : "";
    if (!fn)
      throw new ColorError("Only color(srgb …) and color(srgb-linear …) are read.");
    inner = m[2]!;
  }
  const { ch, a } = args(inner);
  const four = fn === "cmyk" || fn === "device-cmyk";
  const want = four ? 4 : 3;
  if (ch.length !== want && ch.length !== want + 1)
    throw new ColorError(
      four
        ? "CMYK needs four values."
        : "A colour function needs three values, plus an optional alpha.",
    );
  const A = alphaOf(a ?? ch[want]);
  const c = ch.slice(0, want);
  switch (fn) {
    case "rgb":
    case "rgba": {
      const [r, g, b] = c.map((x) => num(x, 255) / 255);
      return { color: rgba(r!, g!, b!, A), kind: "rgb" };
    }
    case "hsl":
    case "hsla":
      return {
        color: hslToRgb(hue(c[0]!), clamp01(unit(c[1]!)), clamp01(unit(c[2]!)), A),
        kind: "hsl",
      };
    case "hsv":
    case "hsb":
      return {
        color: hsvToRgb(hue(c[0]!), clamp01(unit(c[1]!)), clamp01(unit(c[2]!)), A),
        kind: "hsv",
      };
    case "hwb":
      return {
        color: hwbToRgb(hue(c[0]!), clamp01(unit(c[1]!)), clamp01(unit(c[2]!)), A),
        kind: "hwb",
      };
    case "cmyk":
    case "device-cmyk": {
      const [cc, m, y, k] = c.map((x) => clamp01(unit(x)));
      return { color: cmykToRgb(cc!, m!, y!, k!, A), kind: "cmyk" };
    }
    case "oklch": {
      const L = clamp01(unit(c[0]!));
      const C = Math.max(0, num(c[1]!, 0.4));
      return { color: fromOklch(L, C, hue(c[2]!), A), kind: "oklch" };
    }
    case "oklab": {
      const L = clamp01(unit(c[0]!));
      return {
        color: fromOklab(L, num(c[1]!, 0.4), num(c[2]!, 0.4), A),
        kind: "oklab",
      };
    }
    case "srgb": {
      const [r, g, b] = c.map((x) => num(x, 1));
      return { color: rgba(r!, g!, b!, A), kind: "rgb" };
    }
    case "srgb-linear": {
      const [r, g, b] = c.map((x) => num(x, 1));
      return { color: fromLinearRgb(r!, g!, b!, A), kind: "linear" };
    }
  }
  throw new ColorError(FORMS);
}

/** parseColor without throwing */
export function tryParse(input: string): Rgba | null {
  try {
    return parseColor(input).color;
  } catch {
    return null;
  }
}

/** For constants in code: a colour that must parse */
export function col(input: string): Rgba {
  return parseColor(input).color;
}

/* ---------- writing ---------- */

const byte = (v: number) => Math.round(clamp01(v) * 255);
const hx = (v: number) => byte(v).toString(16).padStart(2, "0");

/** #rrggbb, or #rrggbbaa when see-through (or when `alpha` is true) */
export function toHex(c0: Rgba, alpha = c0.a < 1): string {
  const c = fit(c0);
  return `#${hx(c.r)}${hx(c.g)}${hx(c.b)}${alpha ? hx(c.a) : ""}`;
}

export function toRgbString(c0: Rgba): string {
  const c = fit(c0);
  return c.a < 1
    ? `rgba(${byte(c.r)}, ${byte(c.g)}, ${byte(c.b)}, ${round(c.a, 2)})`
    : `rgb(${byte(c.r)}, ${byte(c.g)}, ${byte(c.b)})`;
}

export function toHslString(c0: Rgba): string {
  const c = fit(c0);
  const [h, s, l] = toHsl(c);
  const body = `${round(h)}, ${round(s * 100)}%, ${round(l * 100)}%`;
  return c.a < 1 ? `hsla(${body}, ${round(c.a, 2)})` : `hsl(${body})`;
}

const alphaTail = (a: number) => (a < 1 ? ` / ${round(a * 100)}%` : "");

export function toHsvString(c0: Rgba): string {
  const [h, s, v] = toHsv(fit(c0));
  return `hsv(${round(h)}, ${round(s * 100)}%, ${round(v * 100)}%)`;
}

export function toHwbString(c0: Rgba): string {
  const c = fit(c0);
  const [h, w, b] = toHwb(c);
  return `hwb(${round(h)} ${round(w * 100)}% ${round(b * 100)}%${alphaTail(c.a)})`;
}

export function toCmykString(c0: Rgba): string {
  const [c, m, y, k] = toCmyk(fit(c0));
  return `cmyk(${round(c * 100)}%, ${round(m * 100)}%, ${round(y * 100)}%, ${round(k * 100)}%)`;
}

export function toOklchString(c: Rgba): string {
  const [L, C, H] = toOklch(c);
  return `oklch(${round(L * 100, 1)}% ${round(C, 3)} ${round(H, 1)}${alphaTail(c.a)})`;
}

export function toOklabString(c: Rgba): string {
  const [L, A, B] = toOklab(c);
  return `oklab(${round(L * 100, 1)}% ${round(A, 3)} ${round(B, 3)}${alphaTail(c.a)})`;
}

export function toLinearString(c0: Rgba): string {
  const c = fit(c0);
  const [r, g, b] = toLinearRgb(c);
  return `color(srgb-linear ${round(r, 4)} ${round(g, 4)} ${round(b, 4)}${alphaTail(c.a)})`;
}

/** A CSS value that shows the colour (sRGB, mapped into gamut) */
export function css(c: Rgba): string {
  const f = fit(c);
  return f.a < 1 ? toRgbString(f) : toHex(f, false);
}

export function withAlpha(c: Rgba, a: number): Rgba {
  return { ...c, a: clamp01(a) };
}

/* ---------- names ---------- */

/** The exact CSS name for a colour, or null */
export function exactName(c: Rgba): string | null {
  if (c.a === 0) return "transparent";
  const h = toHex(c, false).slice(1);
  for (const [n, v] of NAMED) if (v === h) return n;
  return null;
}

/** Closest of the 148 CSS named colours, by distance in OKLab */
export function nearestName(c: Rgba): {
  name: string;
  hex: string;
  exact: boolean;
  distance: number;
} {
  const target = toOklab(fit(c));
  let best = "black";
  let bestD = Infinity;
  for (const [n, v] of NAMED) {
    const p = toOklab(hexColor(v));
    const d = Math.hypot(p[0] - target[0], p[1] - target[1], p[2] - target[2]);
    if (d < bestD - 1e-12) {
      bestD = d;
      best = n;
    }
  }
  const hex = `#${NAMED.get(best)!}`;
  return { name: best, hex, exact: hex === toHex(c, false), distance: bestD };
}

/* ---------- WCAG contrast ---------- */

/** Paints `top` over `bottom`; a see-through bottom is put on white first */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const b = bottom.a < 1 ? over(bottom, rgba(1, 1, 1)) : fit(bottom);
  const t = fit(top);
  const m = (x: number, y: number) => x * t.a + y * (1 - t.a);
  return { r: m(t.r, b.r), g: m(t.g, b.g), b: m(t.b, b.b), a: 1 };
}

/** WCAG 2 relative luminance, 0 (black) to 1 (white) */
export function luminance(c0: Rgba): number {
  const c = fit(c0);
  const f = (v: number) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** Contrast ratio of text `fg` on background `bg`, 1–21; see-through colours are blended first */
export function contrast(fg: Rgba, bg: Rgba): number {
  const back = bg.a < 1 ? over(bg, rgba(1, 1, 1)) : bg;
  const front = fg.a < 1 ? over(fg, back) : fg;
  const a = luminance(front);
  const b = luminance(back);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** "4.48:1"; WCAG says not to round up to a pass, so callers compare the raw ratio */
export function ratioText(r: number): string {
  return `${round(Math.floor(r * 100 + 1e-9) / 100, 2)}:1`;
}

/** Black or white, whichever reads better on `bg` */
export function textOn(bg: Rgba): Rgba {
  const white = rgba(1, 1, 1);
  const black = rgba(0, 0, 0);
  return contrast(white, bg) >= contrast(black, bg) ? white : black;
}

/**
 * The colour closest to `fg` (same OKLCH hue and chroma, only lightness moved) that reaches
 * `target` contrast on `bg`, going lighter or darker. Null when that direction can't reach it.
 */
export function passingLightness(
  fg: Rgba,
  bg: Rgba,
  target: number,
  dir: "lighter" | "darker",
): Rgba | null {
  const [L0, C, H] = toOklch(fit(fg));
  const end = dir === "lighter" ? 1 : 0;
  const at = (L: number) => mapOklch(L, C, H, 1);
  if (contrast(at(end), bg) < target) return null;
  if (contrast(withAlpha(fit(fg), 1), bg) >= target) return withAlpha(fit(fg), 1);
  let lo = L0; // fails
  let hi = end; // passes
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (contrast(at(mid), bg) >= target) hi = mid;
    else lo = mid;
  }
  // Round to a hex that still passes
  let c = col(toHex(at(hi), false));
  for (let i = 0; i < 20 && contrast(c, bg) < target; i++) {
    hi = dir === "lighter" ? Math.min(1, hi + 0.002) : Math.max(0, hi - 0.002);
    c = col(toHex(at(hi), false));
  }
  return c;
}

/* ---------- mixing ---------- */

export type Space = "oklab" | "oklch" | "srgb" | "srgb-linear" | "hsl";
export type HueMethod = "shorter" | "longer";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpHue(a: number, b: number, t: number, method: HueMethod) {
  let d = mod360(b - a);
  if (method === "shorter" && d > 180) d -= 360;
  if (method === "longer" && d < 180 && d !== 0) d -= 360;
  return mod360(a + d * t);
}

/**
 * Mixes `a` and `b`; `t` is how much of `b` (0–1). Rectangular spaces use premultiplied alpha,
 * as CSS color-mix() does. The result may be outside sRGB (use fit() to show it).
 */
export function mix(
  a: Rgba,
  b: Rgba,
  t: number,
  space: Space = "oklab",
  hueMethod: HueMethod = "shorter",
): Rgba {
  const alpha = lerp(a.a, b.a, t);
  if (space === "oklch" || space === "hsl") {
    // [lightness, chroma or saturation, hue]
    const polar = (c: Rgba): [number, number, number] => {
      if (space === "oklch") return toOklch(c);
      const [h, s, l] = toHsl(c);
      return [l, s, h];
    };
    const pa = polar(a);
    const pb = polar(b);
    // A grey has no hue: take the other colour's
    const ha = pa[1] < 1e-3 ? pb[2] : pa[2];
    const hb = pb[1] < 1e-3 ? pa[2] : pb[2];
    const h = lerpHue(ha, hb, t, hueMethod);
    const L = lerp(pa[0], pb[0], t);
    const C = lerp(pa[1], pb[1], t);
    return space === "oklch"
      ? fromOklch(L, C, h, alpha)
      : hslToRgb(h, C, L, alpha);
  }
  const to = (c: Rgba): [number, number, number] =>
    space === "oklab"
      ? toOklab(c)
      : space === "srgb-linear"
        ? toLinearRgb(c)
        : [c.r, c.g, c.b];
  const pa = to(a).map((v) => v * a.a);
  const pb = to(b).map((v) => v * b.a);
  const m = [0, 1, 2].map((i) => lerp(pa[i]!, pb[i]!, t) / (alpha || 1)) as [
    number,
    number,
    number,
  ];
  if (space === "oklab") return fromOklab(m[0], m[1], m[2], alpha);
  if (space === "srgb-linear") return fromLinearRgb(m[0], m[1], m[2], alpha);
  return rgba(m[0], m[1], m[2], alpha);
}

/** `n` colours from a to b, both ends included */
export function steps(
  a: Rgba,
  b: Rgba,
  n: number,
  space: Space = "oklab",
  hueMethod: HueMethod = "shorter",
): Rgba[] {
  if (n <= 1) return [a];
  return Array.from({ length: n }, (_, i) =>
    fit(mix(a, b, i / (n - 1), space, hueMethod)),
  );
}

/* ---------- random ---------- */

/** A pleasant random colour: mid lightness, some chroma */
export function randomColor(rand = Math.random): Rgba {
  return mapOklch(0.45 + rand() * 0.4, 0.08 + rand() * 0.14, rand() * 360);
}

/** Hue of a colour after rounding to HEX, for checks and labels */
export function hueOf8bit(c: Rgba): number {
  return toOklch(col(toHex(c, false)))[2];
}
