/**
 * URL helpers for the URL parser: the query string as raw key/value pairs (order and duplicates
 * kept, untouched pairs written back exactly as they were), percent-decoding that never throws,
 * default ports, and Punycode → Unicode for international domain names (RFC 3492).
 */

export interface Param {
  /** Key and value as they appear in the URL (still percent-encoded) */
  key: string;
  value: string;
  /** Had an "=" (so "a=" and "a" stay different) */
  eq: boolean;
}

/** "?a=1&b=2&a=3" → pairs, in order, duplicates kept */
export function readQuery(search: string): Param[] {
  const s = search.replace(/^\?/, "");
  if (!s) return [];
  return s.split("&").map((part) => {
    const i = part.indexOf("=");
    return i < 0
      ? { key: part, value: "", eq: false }
      : { key: part.slice(0, i), value: part.slice(i + 1), eq: true };
  });
}

export function writeQuery(params: Param[]): string {
  if (!params.length) return "";
  return (
    "?" +
    params
      .map((p) => (p.eq || p.value ? `${p.key}=${p.value}` : p.key))
      .join("&")
  );
}

/** Percent-decoding for query parts (+ is a space); bad escapes are left as they are */
export function decodeQuery(s: string): string {
  return decodeLoose(s.replace(/\+/g, " "));
}

/** decodeURIComponent that keeps any broken %XX sequence instead of throwing */
export function decodeLoose(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s.replace(/(%[0-9a-f]{2})+/gi, (m) => {
      try {
        return decodeURIComponent(m);
      } catch {
        return m;
      }
    });
  }
}

/** Encode typed text for a query key or value (keeps readable characters readable) */
export function encodeQuery(s: string): string {
  return encodeURIComponent(s)
    .replace(/%20/g, "+")
    .replace(/%(2C|3A|2F|40|24|21|27|28|29|2A|3B)/gi, (m) =>
      decodeURIComponent(m),
    );
}

export const DEFAULT_PORTS: Record<string, string> = {
  "http:": "80",
  "https:": "443",
  "ws:": "80",
  "wss:": "443",
  "ftp:": "21",
};

/* ---------- Punycode (RFC 3492), decoding only ---------- */

const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;
const SKEW = 38;
const DAMP = 700;

function adapt(delta: number, points: number, first: boolean): number {
  delta = first ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / points);
  let k = 0;
  while (delta > ((BASE - T_MIN) * T_MAX) >> 1) {
    delta = Math.floor(delta / (BASE - T_MIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - T_MIN + 1) * delta) / (delta + SKEW));
}

function digit(c: number): number {
  if (c >= 48 && c < 58) return c - 22; // 0-9 → 26-35
  if (c >= 65 && c < 91) return c - 65; // A-Z
  if (c >= 97 && c < 123) return c - 97; // a-z
  return BASE;
}

/** One Punycode label (without "xn--") → Unicode; throws on bad input */
export function punyDecode(input: string): string {
  const out: number[] = [];
  let n = 128;
  let i = 0;
  let bias = 72;
  const b = input.lastIndexOf("-");
  for (let j = 0; j < Math.max(b, 0); j++) {
    const c = input.charCodeAt(j);
    if (c >= 128) throw new Error("not basic");
    out.push(c);
  }
  for (let idx = b > 0 ? b + 1 : 0; idx < input.length;) {
    const old = i;
    for (let w = 1, k = BASE; ; k += BASE) {
      if (idx >= input.length) throw new Error("bad input");
      const d = digit(input.charCodeAt(idx++));
      if (d >= BASE) throw new Error("bad digit");
      i += d * w;
      const t = k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias;
      if (d < t) break;
      w *= BASE - t;
    }
    bias = adapt(i - old, out.length + 1, old === 0);
    n += Math.floor(i / (out.length + 1));
    i %= out.length + 1;
    out.splice(i++, 0, n);
  }
  return String.fromCodePoint(...out);
}

/** "xn--bcher-kva.example" → "bücher.example" (labels that aren't valid Punycode stay as they are) */
export function hostToUnicode(host: string): string {
  return host
    .split(".")
    .map((label) => {
      if (!/^xn--/i.test(label)) return label;
      try {
        return punyDecode(label.slice(4));
      } catch {
        return label;
      }
    })
    .join(".");
}
