/**
 * Whole numbers in any base from 2 to 36, as BigInt so there's no size limit. Messages are
 * English; the tool translates them.
 */

export const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

export class BaseError extends Error {
  /** Offset of the bad character in the input */
  index?: number;
  detail?: string;
  constructor(message: string, index?: number, detail?: string) {
    super(message);
    this.index = index;
    this.detail = detail;
  }
}

export interface Parsed {
  value: bigint;
  base: number;
  /** The base came from a 0b/0o/0x prefix or from hex letters */
  detected: boolean;
}

const PREFIX: Record<string, number> = { "0b": 2, "0o": 8, "0x": 16 };

/**
 * Reads a whole number. `base` 0 means detect: a 0b/0o/0x prefix, hex letters, or decimal.
 * Spaces, underscores and commas between digits are ignored (digit grouping).
 */
export function parseBase(input: string, base: number): Parsed {
  let i = 0;
  const s = input;
  while (i < s.length && /\s/.test(s[i]!)) i++;
  let neg = false;
  if (s[i] === "-" || s[i] === "+") {
    neg = s[i] === "-";
    i++;
  }
  let b = base;
  let detected = false;
  const pre = s.slice(i, i + 2).toLowerCase();
  if (PREFIX[pre] && (b === 0 || b === PREFIX[pre])) {
    // "0b" is also a valid hex number; with base 16 chosen, 0b1 stays hex
    b = PREFIX[pre]!;
    detected = base === 0;
    i += 2;
  }
  const body = s.slice(i);
  const clean: number[] = []; // indexes of digits
  for (let k = 0; k < body.length; k++) {
    const c = body[k]!;
    if (/[\s_,']/.test(c)) continue;
    clean.push(k);
  }
  if (!clean.length) throw new BaseError("Type some digits.");
  if (b === 0) {
    const letters = clean.some((k) => /[a-f]/i.test(body[k]!));
    b = letters ? 16 : 10;
    detected = letters;
  }
  let v = 0n;
  const big = BigInt(b);
  for (const k of clean) {
    const c = body[k]!;
    const d = DIGITS.indexOf(c.toLowerCase());
    if (d < 0 || d >= b)
      throw new BaseError(
        b === 10 && c === "."
          ? "Only whole numbers are supported."
          : "This character isn't a digit in this base:",
        i + k,
        c,
      );
    v = v * big + BigInt(d);
  }
  return { value: neg ? -v : v, base: b, detected };
}

/** Digits of `n` in `base`, with a leading "-" for negative numbers */
export function toBase(n: bigint, base: number, upper = false): string {
  const s = (n < 0n ? -n : n).toString(base);
  return (n < 0n ? "-" : "") + (upper ? s.toUpperCase() : s);
}

/** Splits the digits into groups from the right: 11111111 → 1111 1111 */
export function group(digits: string, size: number, sep = " "): string {
  const neg = digits.startsWith("-");
  const d = neg ? digits.slice(1) : digits;
  const parts: string[] = [];
  for (let end = d.length; end > 0; end -= size)
    parts.unshift(d.slice(Math.max(0, end - size), end));
  return (neg ? "-" : "") + parts.join(sep);
}

/**
 * Two's complement bits of `n` in a fixed width, or null when it doesn't fit (it must be within
 * the signed or the unsigned range). `signed` is the same bits read as a signed number.
 */
export function twos(
  n: bigint,
  bits: number,
): { bin: string; hex: string; signed: bigint; unsigned: bigint } | null {
  const w = BigInt(bits);
  const min = -(1n << (w - 1n));
  const max = (1n << w) - 1n;
  if (n < min || n > max) return null;
  const unsigned = BigInt.asUintN(bits, n);
  return {
    bin: unsigned.toString(2).padStart(bits, "0"),
    hex: unsigned.toString(16).padStart(bits / 4, "0"),
    signed: BigInt.asIntN(bits, n),
    unsigned,
  };
}

/** Number of bits needed for |n| */
export function bitLength(n: bigint): number {
  const a = n < 0n ? -n : n;
  return a === 0n ? 0 : a.toString(2).length;
}
