/**
 * Secure random helpers on crypto.getRandomValues, plus UUID v4/v7 and ULID.
 * `randomInt` uses rejection sampling, so every value in the range is equally likely
 * (a plain `x % n` would favour the low values).
 */

/** Uniform integer in [0, n), n ≤ 2^32 */
export function randomInt(n: number): number {
  if (n <= 0 || n > 0x1_0000_0000) throw new RangeError("range");
  if (n === 1) return 0;
  // Largest multiple of n that fits in 32 bits; values at or above it are thrown away
  const limit = 0x1_0000_0000 - (0x1_0000_0000 % n);
  const buf = new Uint32Array(16);
  for (;;) {
    crypto.getRandomValues(buf);
    for (const x of buf) if (x < limit) return x % n;
  }
}

/** A random pick from a list */
export function pick<T>(list: readonly T[]): T {
  return list[randomInt(list.length)]!;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

const hex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

function dashed(h: string) {
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function uuidV4(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = randomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  return dashed(hex(b));
}

/**
 * UUID v7 (RFC 9562): 48-bit Unix milliseconds, then 74 random bits. Within the same
 * millisecond the random part counts up (RFC 9562 §6.2, method 3), so a batch stays in order.
 */
let v7Last = { ms: -1, rand: 0n };
const RAND74 = (1n << 74n) - 1n;

function rand74(): bigint {
  const b = randomBytes(10);
  let v = 0n;
  for (const x of b) v = (v << 8n) | BigInt(x);
  // Keep the top bit clear so there's room to count up
  return v & (RAND74 >> 1n);
}

export function uuidV7(now = Date.now()): string {
  let ms = now;
  let rand: bigint;
  if (ms <= v7Last.ms) {
    ms = v7Last.ms;
    rand = v7Last.rand + 1n + BigInt(randomInt(1 << 16));
    if (rand > RAND74) {
      ms += 1;
      rand = rand74();
    }
  } else rand = rand74();
  v7Last = { ms, rand };
  const randA = Number(rand >> 62n); // 12 bits
  const randB = rand & ((1n << 62n) - 1n); // 62 bits
  const h =
    ms.toString(16).padStart(12, "0") +
    (0x7000 | randA).toString(16).padStart(4, "0") +
    ((2n << 62n) | randB).toString(16).padStart(16, "0");
  return dashed(h);
}

/** ULID: 48-bit milliseconds + 80 random bits in Crockford Base32; monotonic within a ms. */
export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
let ulidLast = { ms: -1, rand: 0n };
const RAND80 = (1n << 80n) - 1n;

export function ulid(now = Date.now()): string {
  let ms = now;
  let rand: bigint;
  if (ms <= ulidLast.ms) {
    ms = ulidLast.ms;
    rand = ulidLast.rand + 1n;
    if (rand > RAND80) {
      ms += 1;
      rand = rand80();
    }
  } else rand = rand80();
  ulidLast = { ms, rand };
  let t = "";
  let m = ms;
  for (let i = 0; i < 10; i++) {
    t = CROCKFORD[m % 32] + t;
    m = Math.floor(m / 32);
  }
  let r = "";
  let x = rand;
  for (let i = 0; i < 16; i++) {
    r = CROCKFORD[Number(x & 31n)] + r;
    x >>= 5n;
  }
  return t + r;
}

function rand80(): bigint {
  let v = 0n;
  for (const x of randomBytes(10)) v = (v << 8n) | BigInt(x);
  // Leave headroom so counting up within one millisecond rarely overflows
  return v >> 1n;
}

export interface IdInfo {
  kind: "uuid" | "ulid";
  /** Normalized form */
  canonical: string;
  version?: number;
  variant?: string;
  /** Milliseconds since 1970 for time-based IDs */
  time?: number;
  special?: "nil" | "max";
}

/** Read a UUID (any version, with or without dashes or braces, urn:uuid:) or a ULID. */
export function inspectId(raw: string): IdInfo | null {
  const s = raw
    .trim()
    .replace(/^urn:uuid:/i, "")
    .replace(/^\{|\}$/g, "");
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(s)) {
    const u = s.toUpperCase();
    let ms = 0;
    for (const c of u.slice(0, 10)) ms = ms * 32 + CROCKFORD.indexOf(c);
    if (u[0]! > "7") return null; // over 48 bits
    return { kind: "ulid", canonical: u, time: ms };
  }
  const h = s.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(h)) return null;
  if (
    s.includes("-") &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  )
    return null;
  const canonical = dashed(h);
  if (/^0+$/.test(h)) return { kind: "uuid", canonical, special: "nil" };
  if (/^f+$/.test(h)) return { kind: "uuid", canonical, special: "max" };
  const version = parseInt(h[12]!, 16);
  const v = parseInt(h[16]!, 16);
  const variant =
    v < 8 ? "NCS" : v < 12 ? "RFC 9562" : v < 14 ? "Microsoft" : "Reserved";
  let time: number | undefined;
  if (version === 7) time = parseInt(h.slice(0, 12), 16);
  else if (version === 1 || version === 6) {
    // 60-bit count of 100 ns intervals since 15 Oct 1582
    const t =
      version === 1
        ? BigInt("0x" + h.slice(13, 16) + h.slice(8, 12) + h.slice(0, 8))
        : BigInt("0x" + h.slice(0, 12) + h.slice(13, 16));
    time = Number((t - 122192928000000000n) / 10000n);
  }
  return { kind: "uuid", canonical, version, variant, time };
}
