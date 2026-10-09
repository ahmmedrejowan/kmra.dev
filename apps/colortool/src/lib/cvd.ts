/**
 * Colour vision deficiency simulation (Machado, Oliveira and Fernandes 2009). The matrices act on
 * linear RGB. "-opia" types use severity 1.0 (that cone type is missing); "-anomaly" types use
 * the paper's severity 0.6 (the cone is shifted). Achromatopsia keeps only luminance.
 */
import { fromLinear, toLinear, type Rgba } from "./color";

export type Cvd =
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "protanomaly"
  | "deuteranomaly"
  | "tritanomaly"
  | "achromatopsia";

export const CVD_TYPES: { id: Cvd; name: string; about: string }[] = [
  { id: "protanopia", name: "Protanopia", about: "No red cones" },
  { id: "deuteranopia", name: "Deuteranopia", about: "No green cones" },
  { id: "tritanopia", name: "Tritanopia", about: "No blue cones" },
  { id: "protanomaly", name: "Protanomaly", about: "Weak red" },
  { id: "deuteranomaly", name: "Deuteranomaly", about: "Weak green, the most common" },
  { id: "tritanomaly", name: "Tritanomaly", about: "Weak blue" },
  { id: "achromatopsia", name: "Achromatopsia", about: "No colour" },
];

type M = readonly [number, number, number, number, number, number, number, number, number];

export const MATRICES: Record<Cvd, M> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882,
    -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182,
    0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733,
    0.691367, 0.3039,
  ],
  protanomaly: [
    0.38545, 0.769005, -0.154455, 0.100526, 0.829802, 0.069673, -0.007442,
    -0.02219, 1.029632,
  ],
  deuteranomaly: [
    0.547494, 0.607765, -0.155259, 0.181692, 0.781742, 0.036566, -0.01041,
    0.027275, 0.983136,
  ],
  tritanomaly: [
    1.104996, -0.046633, -0.058363, -0.032137, 0.971635, 0.060503, 0.001336,
    0.317922, 0.680742,
  ],
  // Luminance (Rec. 709 / sRGB weights) in every channel
  achromatopsia: [
    0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722,
  ],
};

const c01 = (v: number) => Math.min(1, Math.max(0, v));

/** One colour as seen with `type` */
export function simulate(c: Rgba, type: Cvd): Rgba {
  const m = MATRICES[type];
  const r = toLinear(c01(c.r));
  const g = toLinear(c01(c.g));
  const b = toLinear(c01(c.b));
  return {
    r: c01(fromLinear(c01(m[0] * r + m[1] * g + m[2] * b))),
    g: c01(fromLinear(c01(m[3] * r + m[4] * g + m[5] * b))),
    b: c01(fromLinear(c01(m[6] * r + m[7] * g + m[8] * b))),
    a: c.a,
  };
}

/** Lookup tables for pixel work: 8-bit sRGB → linear, linear (4096 steps) → 8-bit sRGB */
const TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) TO_LIN[i] = toLinear(i / 255);
const N = 4096;
const TO_SRGB = new Uint8ClampedArray(N + 1);
for (let i = 0; i <= N; i++) TO_SRGB[i] = Math.round(fromLinear(i / N) * 255);

/** Simulates `type` on RGBA pixels in place */
export function simulatePixels(px: Uint8ClampedArray, type: Cvd): void {
  const m = MATRICES[type];
  const enc = (v: number) => TO_SRGB[v <= 0 ? 0 : v >= 1 ? N : (v * N + 0.5) | 0]!;
  for (let i = 0; i < px.length; i += 4) {
    const r = TO_LIN[px[i]!]!;
    const g = TO_LIN[px[i + 1]!]!;
    const b = TO_LIN[px[i + 2]!]!;
    px[i] = enc(m[0] * r + m[1] * g + m[2] * b);
    px[i + 1] = enc(m[3] * r + m[4] * g + m[5] * b);
    px[i + 2] = enc(m[6] * r + m[7] * g + m[8] * b);
  }
}
