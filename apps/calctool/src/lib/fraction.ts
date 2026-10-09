/** Exact fractions with BigInt, so big denominators never lose precision. */

export interface Frac {
  n: bigint;
  d: bigint; // always > 0
}

export function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

export function simplify(f: Frac): Frac {
  if (f.n === 0n) return { n: 0n, d: 1n };
  const g = gcd(f.n, f.d);
  const s = f.d < 0n ? -1n : 1n;
  return { n: (s * f.n) / g, d: (s * f.d) / g };
}

/**
 * Read "3/4", "-3/4", "2 1/4" (a mixed number), "5", "0.75" or "1.5/2". Returns null when empty,
 * a string key (English message) when it can't be read.
 */
export function parseFrac(raw: string): Frac | null | string {
  const s = raw
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/[−–]/g, "-")
    .replace(/[⁄∕÷]/g, "/")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return null;
  let m = /^([-+]?)(\d+) (\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) {
    const d = BigInt(m[4]!);
    if (d === 0n) return "The bottom number can't be 0.";
    const n = BigInt(m[2]!) * d + BigInt(m[3]!);
    return simplify({ n: m[1] === "-" ? -n : n, d });
  }
  m = /^([-+]?[\d.]+)\s*(?:\/\s*([-+]?[\d.]+))?$/.exec(s);
  if (m) {
    const a = dec(m[1]!);
    const b = m[2] === undefined ? { n: 1n, d: 1n } : dec(m[2]);
    if (!a || !b) return "Type a fraction like 3/4, 2 1/4 or 0.75.";
    if (b.n === 0n) return "The bottom number can't be 0.";
    return simplify({ n: a.n * b.d, d: a.d * b.n });
  }
  return "Type a fraction like 3/4, 2 1/4 or 0.75.";
}

/** "0.75" → 3/4 exactly */
function dec(s: string): Frac | null {
  const m = /^([-+]?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (!m[2] && !m[3])) return null;
  const frac = m[3] ?? "";
  const n = BigInt((m[2] || "0") + frac);
  const d = 10n ** BigInt(frac.length);
  return simplify({ n: m[1] === "-" ? -n : n, d });
}

export type Op = "+" | "-" | "*" | "/";

export function apply(a: Frac, op: Op, b: Frac): Frac | null {
  switch (op) {
    case "+":
      return simplify({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
    case "-":
      return simplify({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
    case "*":
      return simplify({ n: a.n * b.n, d: a.d * b.d });
    case "/":
      if (b.n === 0n) return null;
      return simplify({ n: a.n * b.d, d: a.d * b.n });
  }
}

/** Whole part and remainder: -7/4 → { whole: -1, n: 3, d: 4 } */
export function mixed(f: Frac): {
  neg: boolean;
  whole: bigint;
  n: bigint;
  d: bigint;
} {
  const neg = f.n < 0n;
  const an = neg ? -f.n : f.n;
  return { neg, whole: an / f.d, n: an % f.d, d: f.d };
}

export function toNumber(f: Frac): number {
  return Number(f.n) / Number(f.d);
}

export function str(f: Frac): string {
  return f.d === 1n ? String(f.n) : `${f.n}/${f.d}`;
}

/** Least common multiple of two denominators */
export function lcm(a: bigint, b: bigint): bigint {
  return (a / gcd(a, b)) * b;
}
