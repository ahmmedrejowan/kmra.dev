/**
 * CSS colours: parse HEX, rgb(), hsl(), hwb(), oklch(), oklab() and named colours, write every
 * format, and measure WCAG contrast. All maths is local (OKLab per Björn Ottosson).
 * Colours are kept as sRGB channels 0–1 (may fall outside 0–1 for wide-gamut OKLCH input) and
 * alpha 0–1.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type Kind = "hex" | "rgb" | "hsl" | "hwb" | "oklch" | "oklab" | "name";

/* ---------- named colours ---------- */

const NAMED_RAW =
  "aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080 honeydew f0fff0 hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5 lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585 midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32";

export const NAMED: Map<string, string> = (() => {
  const m = new Map<string, string>();
  const p = NAMED_RAW.split(" ");
  for (let i = 0; i < p.length; i += 2) m.set(p[i]!, p[i + 1]!);
  return m;
})();

/** The CSS name for an exact HEX (the first one when there are synonyms like gray/grey) */
export function nameOf(hex6: string): string | null {
  for (const [n, h] of NAMED) if (h === hex6) return n;
  return null;
}

/* ---------- OKLab ---------- */

const toLin = (c: number) => {
  const a = Math.abs(c);
  return (
    Math.sign(c) * (a <= 0.04045 ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4)
  );
};
const fromLin = (c: number) => {
  const a = Math.abs(c);
  return (
    Math.sign(c) * (a <= 0.0031308 ? 12.92 * a : 1.055 * a ** (1 / 2.4) - 0.055)
  );
};

export function toOklab({ r, g, b }: Rgba): [number, number, number] {
  const lr = toLin(r);
  const lg = toLin(g);
  const lb = toLin(b);
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

export function fromOklab(L: number, A: number, B: number) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: fromLin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

export function toOklch(c: Rgba): [number, number, number] {
  const [L, A, B] = toOklab(c);
  const C = Math.hypot(A, B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, C < 1e-4 ? 0 : H];
}

/* ---------- HSL / HWB ---------- */

function hslToRgb(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return { r: f(0), g: f(8), b: f(4) };
}

function rgbToHsl({ r, g, b }: Rgba): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = l === 0 || l === 1 ? 0 : (max - l) / Math.min(l, 1 - l);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hwbToRgb(h: number, w: number, bl: number) {
  if (w + bl >= 1) {
    const g = w / (w + bl);
    return { r: g, g, b: g };
  }
  const c = hslToRgb(h, 1, 0.5);
  const f = (x: number) => x * (1 - w - bl) + w;
  return { r: f(c.r), g: f(c.g), b: f(c.b) };
}

/* ---------- parsing ---------- */

export class ColorError extends Error {}

function num(tok: string, pctScale: number, _what: string): number {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%?)$/i.exec(tok);
  if (!m) throw new ColorError(`One of the values isn't a number.`);
  const v = parseFloat(m[1]!);
  return m[2] ? (v / 100) * pctScale : v;
}

function hue(tok: string): number {
  const m =
    /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/i.exec(tok);
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
  return ((deg % 360) + 360) % 360;
}

function alpha(tok: string | undefined): number {
  if (tok === undefined) return 1;
  return Math.min(1, Math.max(0, num(tok, 1, "Alpha")));
}

/** Splits "a b c / d" and "a, b, c, d" into channels and alpha */
function args(inner: string): { ch: string[]; a?: string } {
  const t = inner.trim();
  if (t.includes(",")) {
    const p = t.split(",").map((x) => x.trim());
    return { ch: p.slice(0, 3), a: p[3] };
  }
  const [main, a] = t.split("/").map((x) => x.trim());
  return { ch: main!.split(/\s+/).filter(Boolean), a: a || undefined };
}

export function parseColor(input: string): { color: Rgba; kind: Kind } {
  const s = input.trim().toLowerCase().replace(/;$/, "");
  if (!s) throw new ColorError("Type a color.");
  if (s === "transparent")
    return { color: { r: 0, g: 0, b: 0, a: 0 }, kind: "name" };
  const named = NAMED.get(s);
  if (named) return { color: hex(named), kind: "name" };
  const h = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (h) return { color: hex(h[1]!), kind: "hex" };
  const f = /^([a-z]+)\((.*)\)$/s.exec(s);
  if (!f)
    throw new ColorError(
      "Use HEX, rgb(), hsl(), hwb(), oklch(), oklab() or a color name.",
    );
  const fn = f[1]!;
  const { ch, a } = args(f[2]!);
  if (ch.length !== 3)
    throw new ColorError(
      "A color function needs three values, plus an optional alpha.",
    );
  const A = alpha(a);
  // "none" counts as 0, as in CSS Color 4
  const c = ch.map((x) => (x === "none" ? "0" : x));
  switch (fn) {
    case "rgb":
    case "rgba": {
      const [r, g, b] = c.map((x) => num(x, 255, "A channel") / 255);
      return { color: { r: r!, g: g!, b: b!, a: A }, kind: "rgb" };
    }
    case "hsl":
    case "hsla": {
      const rgb = hslToRgb(
        hue(c[0]!),
        clamp01(num(c[1]!, 100, "Saturation") / 100),
        clamp01(num(c[2]!, 100, "Lightness") / 100),
      );
      return { color: { ...rgb, a: A }, kind: "hsl" };
    }
    case "hwb": {
      const rgb = hwbToRgb(
        hue(c[0]!),
        clamp01(num(c[1]!, 100, "Whiteness") / 100),
        clamp01(num(c[2]!, 100, "Blackness") / 100),
      );
      return { color: { ...rgb, a: A }, kind: "hwb" };
    }
    case "oklch": {
      const L = clamp01(num(c[0]!, 1, "Lightness"));
      const C = Math.max(0, num(c[1]!, 0.4, "Chroma"));
      const H = (hue(c[2]!) * Math.PI) / 180;
      return {
        color: { ...fromOklab(L, C * Math.cos(H), C * Math.sin(H)), a: A },
        kind: "oklch",
      };
    }
    case "oklab": {
      const L = clamp01(num(c[0]!, 1, "Lightness"));
      return {
        color: {
          ...fromOklab(L, num(c[1]!, 0.4, "A"), num(c[2]!, 0.4, "B")),
          a: A,
        },
        kind: "oklab",
      };
    }
  }
  throw new ColorError(
    "Use HEX, rgb(), hsl(), hwb(), oklch(), oklab() or a color name.",
  );
}

function hex(h: string): Rgba {
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

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Fits into sRGB: true when any channel was outside 0–1 by more than rounding */
export function outOfGamut(c: Rgba) {
  return [c.r, c.g, c.b].some((v) => v < -0.001 || v > 1.001);
}

export function clampColor(c: Rgba): Rgba {
  return { r: clamp01(c.r), g: clamp01(c.g), b: clamp01(c.b), a: clamp01(c.a) };
}

/* ---------- writing ---------- */

const r2 = (v: number, d: number) => {
  const p = 10 ** d;
  const x = Math.round(v * p) / p;
  return Object.is(x, -0) ? "0" : String(x);
};
const byte = (v: number) => Math.round(clamp01(v) * 255);
const hx = (v: number) => byte(v).toString(16).padStart(2, "0");
const pctA = (a: number) => r2(a * 100, 1) + "%";

export function toHex(c: Rgba, withAlpha = c.a < 1) {
  return `#${hx(c.r)}${hx(c.g)}${hx(c.b)}${withAlpha ? hx(c.a) : ""}`;
}

export function format(c0: Rgba, kind: Kind | "hex8" | "rgb-legacy"): string {
  const c = kind === "oklch" || kind === "oklab" ? c0 : clampColor(c0);
  const al = c.a < 1 ? ` / ${pctA(c.a)}` : "";
  switch (kind) {
    case "hex":
      return toHex(c);
    case "hex8":
      return toHex(c, true);
    case "rgb":
      return `rgb(${byte(c.r)} ${byte(c.g)} ${byte(c.b)}${al})`;
    case "rgb-legacy":
      return c.a < 1
        ? `rgba(${byte(c.r)}, ${byte(c.g)}, ${byte(c.b)}, ${r2(c.a, 3)})`
        : `rgb(${byte(c.r)}, ${byte(c.g)}, ${byte(c.b)})`;
    case "hsl": {
      const [h, s, l] = rgbToHsl(c);
      return `hsl(${r2(h, 1)} ${r2(s * 100, 1)}% ${r2(l * 100, 1)}%${al})`;
    }
    case "hwb": {
      const [h] = rgbToHsl(c);
      const w = Math.min(c.r, c.g, c.b);
      const bl = 1 - Math.max(c.r, c.g, c.b);
      return `hwb(${r2(h, 1)} ${r2(w * 100, 1)}% ${r2(bl * 100, 1)}%${al})`;
    }
    case "oklch": {
      const [L, C, H] = toOklch(c);
      return `oklch(${r2(L * 100, 2)}% ${r2(C, 4)} ${r2(H, 2)}${al})`;
    }
    case "oklab": {
      const [L, A, B] = toOklab(c);
      return `oklab(${r2(L * 100, 2)}% ${r2(A, 4)} ${r2(B, 4)}${al})`;
    }
    case "name":
      return (
        (c.a === 0 ? "transparent" : null) ??
        nameOf(toHex(c, false).slice(1)) ??
        ""
      );
  }
}

/** Same colour with another alpha */
export const withAlpha = (c: Rgba, a: number): Rgba => ({ ...c, a });

/* ---------- contrast (WCAG 2) ---------- */

/** Paints `top` over `bottom` (bottom is made opaque over white first) */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const b =
    bottom.a < 1
      ? over(bottom, { r: 1, g: 1, b: 1, a: 1 })
      : clampColor(bottom);
  const t = clampColor(top);
  const mix = (x: number, y: number) => x * t.a + y * (1 - t.a);
  return { r: mix(t.r, b.r), g: mix(t.g, b.g), b: mix(t.b, b.b), a: 1 };
}

export function luminance(c: Rgba): number {
  const f = (v: number) => {
    const x = clamp01(v);
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** Contrast ratio of text colour `fg` on background `bg`, 1–21 */
export function contrast(fg: Rgba, bg: Rgba): number {
  const back = bg.a < 1 ? over(bg, { r: 1, g: 1, b: 1, a: 1 }) : bg;
  const front = fg.a < 1 ? over(fg, back) : fg;
  const a = luminance(front);
  const b = luminance(back);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
