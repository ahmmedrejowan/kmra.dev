/**
 * Codecs for the Encode tools: Base64, percent-encoding, HTML entities, Unicode escapes and
 * byte dumps. Pure functions on strings and bytes (UTF-8 throughout). Decoders throw
 * `DecodeError` with the position of the first problem, so the pane can point at it. Messages
 * are English; the tools translate them and append `detail` (the offending text) as is.
 */

export class DecodeError extends Error {
  /** Offset into the input (UTF-16 index) */
  index?: number;
  /** The offending text, shown in quotes after the message */
  detail?: string;
  constructor(message: string, index?: number, detail?: string) {
    super(message);
    this.index = index;
    this.detail = detail;
  }
}

/** 1-based line and column of an offset */
export function lineCol(text: string, index: number) {
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  return { line, col: index - before.lastIndexOf("\n") };
}

export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Bytes as UTF-8 text; `valid` is false when some bytes aren't UTF-8 (they become �) */
export function fromUtf8(b: Uint8Array): { text: string; valid: boolean } {
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(b),
      valid: true,
    };
  } catch {
    return { text: new TextDecoder().decode(b), valid: false };
  }
}

/** Readable text: valid UTF-8 without control characters (tabs and line breaks are fine) */
export function isText(b: Uint8Array): boolean {
  const { text, valid } = fromUtf8(b);
  return valid && !/[\x00-\x08\x0b\x0e-\x1f\x7f]/.test(text);
}

/** Index of the first unpaired surrogate, or -1 */
export function loneSurrogate(s: string): number {
  const m =
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.exec(
      s,
    );
  return m ? m.index : -1;
}

/* ---------- Base64 ---------- */

export function toBase64(
  bytes: Uint8Array,
  { urlSafe = false, pad = true, wrap = 0 } = {},
): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  let s = btoa(bin);
  if (urlSafe) s = s.replace(/\+/g, "-").replace(/\//g, "_");
  if (!pad) s = s.replace(/=+$/, "");
  if (wrap > 0) s = s.replace(new RegExp(`.{${wrap}}(?=.)`, "g"), "$&\n");
  return s;
}

const B64: Record<string, number> = {};
"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  .split("")
  .forEach((c, i) => (B64[c] = i));
B64["-"] = 62;
B64["_"] = 63;

export interface Base64Decoded {
  bytes: Uint8Array;
  /** Media type from a data: URI */
  mime?: string;
  /** Uses - and _ */
  urlSafe: boolean;
}

/**
 * Base64 (standard or URL-safe, padding optional, line breaks ignored) or a data: URI to bytes.
 */
export function fromBase64(input: string): Base64Decoded {
  let start = 0;
  let mime: string | undefined;
  const lead = /^\s*/.exec(input)![0].length;
  const uri = /^data:([^,]*?),/i.exec(input.slice(lead));
  if (uri) {
    const params = uri[1]!.split(";");
    mime = params[0] || "text/plain";
    start = lead + uri[0].length;
    if (!params.some((p) => p.toLowerCase() === "base64")) {
      // A plain data: URI is percent-encoded, not Base64
      const { bytes } = percentBytes(input.slice(start).trim(), false, start);
      return { bytes, mime, urlSafe: false };
    }
  }
  const vals: number[] = [];
  let urlSafe = false;
  let padAt = -1;
  for (let i = start; i < input.length; i++) {
    const c = input[i]!;
    if (c === " " || c === "\n" || c === "\r" || c === "\t") continue;
    if (c === "=") {
      if (padAt < 0) padAt = i;
      continue;
    }
    const v = B64[c];
    if (v === undefined)
      throw new DecodeError(
        "Not valid Base64: unexpected character",
        i,
        String.fromCodePoint(input.codePointAt(i)!),
      );
    if (padAt >= 0)
      throw new DecodeError(
        "Not valid Base64: padding (=) can only come at the end",
        padAt,
      );
    if (c === "-" || c === "_") urlSafe = true;
    vals.push(v);
  }
  if (vals.length % 4 === 1)
    throw new DecodeError(
      "Not valid Base64: the last group has only one character. Part of it may be missing.",
      input.trimEnd().length - 1,
    );
  const out = new Uint8Array(Math.floor((vals.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < vals.length; i += 4) {
    const n =
      (vals[i]! << 18) |
      ((vals[i + 1] ?? 0) << 12) |
      ((vals[i + 2] ?? 0) << 6) |
      (vals[i + 3] ?? 0);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < vals.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < vals.length) out[o++] = n & 255;
  }
  return { bytes: out, mime, urlSafe };
}

/* ---------- File types by their first bytes ---------- */

export interface Sniffed {
  mime: string;
  ext: string;
  /** Plain name, e.g. "PNG image" (English; translate in the tool) */
  label: string;
}

const MAGIC: [number, string, string, string, string][] = [
  // offset, signature (latin1), mime, ext, label
  [0, "\x89PNG\r\n\x1a\n", "image/png", "png", "PNG image"],
  [0, "\xff\xd8\xff", "image/jpeg", "jpg", "JPEG image"],
  [0, "GIF87a", "image/gif", "gif", "GIF image"],
  [0, "GIF89a", "image/gif", "gif", "GIF image"],
  [0, "%PDF-", "application/pdf", "pdf", "PDF document"],
  [0, "PK\x03\x04", "application/zip", "zip", "ZIP archive"],
  [0, "PK\x05\x06", "application/zip", "zip", "ZIP archive"],
  [0, "\x1f\x8b", "application/gzip", "gz", "Gzip archive"],
  [
    0,
    "7z\xbc\xaf\x27\x1c",
    "application/x-7z-compressed",
    "7z",
    "7-Zip archive",
  ],
  [0, "Rar!\x1a\x07", "application/vnd.rar", "rar", "RAR archive"],
  [0, "\xfd7zXZ\x00", "application/x-xz", "xz", "XZ archive"],
  [0, "BZh", "application/x-bzip2", "bz2", "Bzip2 archive"],
  [0, "BM", "image/bmp", "bmp", "BMP image"],
  [0, "\x00\x00\x01\x00", "image/x-icon", "ico", "Icon"],
  [0, "II*\x00", "image/tiff", "tif", "TIFF image"],
  [0, "MM\x00*", "image/tiff", "tif", "TIFF image"],
  [0, "8BPS", "image/vnd.adobe.photoshop", "psd", "Photoshop file"],
  [0, "ID3", "audio/mpeg", "mp3", "MP3 audio"],
  [0, "\xff\xfb", "audio/mpeg", "mp3", "MP3 audio"],
  [0, "\xff\xf3", "audio/mpeg", "mp3", "MP3 audio"],
  [0, "OggS", "audio/ogg", "ogg", "Ogg audio"],
  [0, "fLaC", "audio/flac", "flac", "FLAC audio"],
  [0, "\x1aE\xdf\xa3", "video/webm", "webm", "WebM video"],
  [0, "\x00asm", "application/wasm", "wasm", "WebAssembly module"],
  [0, "wOFF", "font/woff", "woff", "WOFF font"],
  [0, "wOF2", "font/woff2", "woff2", "WOFF2 font"],
  [0, "\x00\x01\x00\x00\x00", "font/ttf", "ttf", "TrueType font"],
  [0, "OTTO", "font/otf", "otf", "OpenType font"],
  [
    0,
    "SQLite format 3\x00",
    "application/vnd.sqlite3",
    "sqlite",
    "SQLite database",
  ],
  [0, "\x7fELF", "application/x-elf", "elf", "Linux program"],
  [
    0,
    "MZ",
    "application/vnd.microsoft.portable-executable",
    "exe",
    "Windows program",
  ],
  [0, "\xca\xfe\xba\xbe", "application/java-vm", "class", "Java class"],
];

function at(b: Uint8Array, off: number, sig: string) {
  if (b.length < off + sig.length) return false;
  for (let i = 0; i < sig.length; i++)
    if (b[off + i] !== sig.charCodeAt(i)) return false;
  return true;
}

/** What the bytes are, from their signature (or from the text for text formats) */
export function sniff(b: Uint8Array): Sniffed {
  if (at(b, 0, "RIFF") && b.length >= 12) {
    if (at(b, 8, "WEBP"))
      return { mime: "image/webp", ext: "webp", label: "WebP image" };
    if (at(b, 8, "WAVE"))
      return { mime: "audio/wav", ext: "wav", label: "WAV audio" };
    if (at(b, 8, "AVI "))
      return { mime: "video/x-msvideo", ext: "avi", label: "AVI video" };
  }
  if (at(b, 4, "ftyp")) {
    const brand = String.fromCharCode(...b.subarray(8, 12));
    if (/^avi[fs]/.test(brand))
      return { mime: "image/avif", ext: "avif", label: "AVIF image" };
    if (/^(heic|heix|mif1|msf1)/.test(brand))
      return { mime: "image/heic", ext: "heic", label: "HEIC image" };
    if (brand === "qt  ")
      return { mime: "video/quicktime", ext: "mov", label: "QuickTime video" };
    if (brand === "M4A ")
      return { mime: "audio/mp4", ext: "m4a", label: "M4A audio" };
    return { mime: "video/mp4", ext: "mp4", label: "MP4 video" };
  }
  for (const [off, sig, mime, ext, label] of MAGIC)
    if (at(b, off, sig)) return { mime, ext, label };
  if (isText(b)) {
    const t = fromUtf8(b.subarray(0, 4096)).text.trimStart();
    if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(t))
      return { mime: "image/svg+xml", ext: "svg", label: "SVG image" };
    if (/^<!doctype html|^<html[\s>]/i.test(t))
      return { mime: "text/html", ext: "html", label: "HTML" };
    if (/^<\?xml/.test(t))
      return { mime: "application/xml", ext: "xml", label: "XML" };
    if (/^[{[]/.test(t)) {
      try {
        JSON.parse(fromUtf8(b).text);
        return { mime: "application/json", ext: "json", label: "JSON" };
      } catch {}
    }
    return { mime: "text/plain", ext: "txt", label: "Text" };
  }
  return { mime: "application/octet-stream", ext: "bin", label: "Binary data" };
}

/** Extension for a media type from a data: URI */
export function extOf(mime: string): string {
  const known: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
    "image/x-icon": "ico",
    "text/plain": "txt",
    "text/javascript": "js",
    "application/javascript": "js",
    "audio/mpeg": "mp3",
    "application/octet-stream": "bin",
  };
  return (
    known[mime] ?? /\/([a-z0-9]+)/i.exec(mime)?.[1]?.toLowerCase() ?? "bin"
  );
}

/* ---------- Percent-encoding (URLs) ---------- */

export type UrlPart = "component" | "uri";

/**
 * encodeURIComponent / encodeURI, with + for spaces as in HTML forms. Throws on a broken
 * character (an unpaired surrogate), which neither can encode.
 */
export function percentEncode(
  s: string,
  part: UrlPart,
  plusSpace = false,
): string {
  const bad = loneSurrogate(s);
  if (bad >= 0)
    throw new DecodeError(
      "The text has a broken character (half of an emoji or symbol) that can't be encoded",
      bad,
    );
  if (part === "uri") return encodeURI(s);
  const out = encodeURIComponent(s);
  return plusSpace ? out.replace(/%20/g, "+") : out;
}

/** Characters encodeURI leaves encoded when decoding a full URL */
const RESERVED = new Set(";/?:@&=+$,#".split("").map((c) => c.charCodeAt(0)));

function percentBytes(
  s: string,
  plusSpace: boolean,
  offset = 0,
  keepReserved = false,
): { bytes: Uint8Array } {
  const out: number[] = [];
  const enc = new TextEncoder();
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "%") {
      const hex = s.slice(i + 1, i + 3);
      if (!/^[0-9a-f]{2}$/i.test(hex))
        throw new DecodeError(
          "Not valid percent-encoding: % must be followed by two hex digits",
          offset + i,
          s.slice(i, i + 3),
        );
      const v = parseInt(hex, 16);
      if (keepReserved && RESERVED.has(v))
        out.push(37, s.charCodeAt(i + 1), s.charCodeAt(i + 2));
      else out.push(v);
      i += 2;
    } else if (c === "+" && plusSpace) out.push(32);
    else {
      const cp = s.codePointAt(i)!;
      if (cp > 0xffff) i++;
      for (const b of enc.encode(String.fromCodePoint(cp))) out.push(b);
    }
  }
  return { bytes: Uint8Array.from(out) };
}

/** Percent-decoding; `valid` is false when the bytes aren't UTF-8 */
export function percentDecode(
  s: string,
  part: UrlPart,
  plusSpace: boolean,
): { text: string; valid: boolean; escapes: number } {
  const { bytes } = percentBytes(s, plusSpace, 0, part === "uri");
  const escapes = (s.match(/%[0-9a-f]{2}/gi) ?? []).length;
  return { ...fromUtf8(bytes), escapes };
}

/* ---------- HTML entities ---------- */

export type EntityScope = "minimal" | "nonascii";
export type EntityStyle = "named" | "decimal" | "hex";

const BASIC: Record<string, string> = {
  "&": "amp",
  "<": "lt",
  ">": "gt",
  '"': "quot",
};

/**
 * Escape & < > " ' (always), and with "nonascii" every character beyond ASCII, as a name
 * where one exists (named style) or as a numeric reference.
 */
export function htmlEscape(
  s: string,
  scope: EntityScope,
  style: EntityStyle,
  names: Map<number, string> | null,
): { text: string; count: number } {
  let count = 0;
  const num = (cp: number) =>
    style === "hex" ? `&#x${cp.toString(16).toUpperCase()};` : `&#${cp};`;
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch in BASIC || ch === "'") {
      count++;
      out += style === "named" && ch !== "'" ? `&${BASIC[ch]};` : num(cp);
    } else if (scope === "nonascii" && cp > 126) {
      count++;
      const name = style === "named" ? names?.get(cp) : undefined;
      out += name ? `&${name};` : num(cp);
    } else out += ch;
  }
  return { text: out, count };
}

const REF = /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);?/gi;

/**
 * Turn every character reference back into text, using the browser's own HTML parser (a
 * detached <textarea> is parsed as plain text, so markup in the input never runs).
 */
export function htmlUnescape(s: string): { text: string; count: number } {
  const ta = document.createElement("textarea");
  ta.innerHTML = s;
  let count = 0;
  const seen = new Map<string, boolean>();
  const one = document.createElement("textarea");
  for (const [ref] of s.matchAll(REF)) {
    let known = seen.get(ref);
    if (known === undefined) {
      one.innerHTML = ref;
      known = one.value !== ref;
      seen.set(ref, known);
    }
    if (known) count++;
  }
  return { text: ta.value, count };
}

/* ---------- Unicode escapes ---------- */

export type UStyle = "u" | "ubrace" | "codepoint" | "json" | "html";

const JSON_SHORT: Record<string, string> = {
  '"': '\\"',
  "\\": "\\\\",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\b": "\\b",
  "\f": "\\f",
};

/**
 * Text to escapes. `all` escapes ASCII too (otherwise only non-ASCII and, for JSON, the
 * characters a JSON string can't hold). Code points list every character as U+XXXX.
 */
export function uEscape(
  s: string,
  style: UStyle,
  { all = false, upper = true } = {},
): string {
  const hex = (n: number, w = 4) => {
    const h = n.toString(16).padStart(w, "0");
    return upper ? h.toUpperCase() : h;
  };
  const u16 = (ch: string) =>
    Array.from(
      { length: ch.length },
      (_, i) => `\\u${hex(ch.charCodeAt(i))}`,
    ).join("");
  if (style === "codepoint")
    return Array.from(s, (ch) => `U+${hex(ch.codePointAt(0)!)}`).join(" ");
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (style === "json") {
      if (JSON_SHORT[ch] && !(all && cp > 31 && ch !== '"' && ch !== "\\"))
        out += JSON_SHORT[ch];
      else if (cp < 32 || cp > 126 || all) out += u16(ch);
      else out += ch;
      continue;
    }
    if (cp < 128 && !all) {
      out += ch;
      continue;
    }
    if (style === "u") out += u16(ch);
    else if (style === "ubrace") out += `\\u{${hex(cp)}}`;
    else out += `&#x${hex(cp)};`;
  }
  return out;
}

const UESC =
  /\\u\{([0-9a-f]{1,6})\}|\\u([0-9a-f]{4})|\\U([0-9a-f]{8})|\\x([0-9a-f]{2})|\bU\+([0-9a-f]{4,6})\b(?:[ \t,]+(?=U\+[0-9a-f]{4}))?|&#x([0-9a-f]{1,6});|&#(\d{1,7});|\\([nrtbf0"'\\/])|\\[uUx]/gi;

const SHORT_BACK: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  b: "\b",
  f: "\f",
  "0": "\0",
};

/**
 * Every escape form back to text: \uXXXX (surrogate pairs join up), \u{…}, \UXXXXXXXX, \xXX,
 * U+XXXX (with the spaces between a run of them), &#x…; &#…; and the JSON/JS short escapes.
 * A JSON string with its quotes is read as JSON.
 */
export function uUnescape(s: string): { text: string; count: number } {
  const t = s.trim();
  if (/^"(?:[^"\\\n]|\\.)*"$/.test(t)) {
    try {
      const v = JSON.parse(t) as string;
      return { text: v, count: (t.match(/\\/g) ?? []).length };
    } catch {}
  }
  let count = 0;
  const text = s.replace(
    UESC,
    (
      m: string,
      br?: string,
      u4?: string,
      u8?: string,
      x2?: string,
      cp?: string,
      hx?: string,
      dec?: string,
      sh?: string,
      i = 0,
    ) => {
      const h = br ?? u4 ?? u8 ?? x2 ?? cp ?? hx;
      const code =
        h !== undefined
          ? parseInt(h, 16)
          : dec !== undefined
            ? parseInt(dec, 10)
            : undefined;
      if (sh !== undefined) {
        count++;
        return SHORT_BACK[sh] ?? sh;
      }
      if (code === undefined)
        throw new DecodeError(
          "Incomplete escape",
          i,
          s.slice(i, i + 6).trimEnd(),
        );
      if (code > 0x10ffff)
        throw new DecodeError(
          "Code point out of range (the highest is U+10FFFF)",
          i,
          m.trim(),
        );
      count++;
      // 👋 arrives as two halves; joined in the string they form one character
      return u4 !== undefined || x2 !== undefined
        ? String.fromCharCode(code)
        : String.fromCodePoint(code);
    },
  );
  return { text, count };
}

/* ---------- Bytes as hex, binary or decimal ---------- */

export type ByteFmt = "hex" | "bin" | "dec";
export type ByteSep = " " | "" | ", " | "\n";

export function bytesTo(
  b: Uint8Array,
  fmt: ByteFmt,
  { sep = " " as ByteSep, prefix = false, upper = false } = {},
): string {
  const parts = Array.from(b, (v) => {
    if (fmt === "bin") return v.toString(2).padStart(8, "0");
    if (fmt === "dec") return String(v);
    const h = v.toString(16).padStart(2, "0");
    return (prefix ? "0x" : "") + (upper ? h.toUpperCase() : h);
  });
  // Decimal bytes need something between them to be read back
  return parts.join(fmt === "dec" && sep === "" ? " " : sep);
}

const TOKEN = /[^\s,;:|[\](){}"'`-]+/g;

/** Guess the format of a byte dump */
export function guessFmt(s: string): ByteFmt {
  const t = s.replace(/0x|\\x|%|0b(?=[01]{8})/gi, " ");
  const tokens = t.match(TOKEN) ?? [];
  if (!tokens.length) return "hex";
  if (
    tokens.every((x) => /^[01]+$/.test(x)) &&
    tokens.every((x) => x.length === 8 || (x.length > 8 && x.length % 8 === 0))
  )
    return "bin";
  if (/0x|\\x/i.test(s) || /[a-f]/i.test(t)) return "hex";
  if (tokens.every((x) => x.length === 2)) return "hex";
  if (tokens.every((x) => /^\d{1,3}$/.test(x))) return "dec";
  return "hex";
}

/**
 * Read a byte dump. Tolerant of 0x / \x / % / 0b prefixes, any separators (spaces, commas,
 * colons, dashes, brackets, line breaks) and runs without separators (hex pairs, 8-bit groups).
 */
export function parseBytes(s: string, fmt: ByteFmt): Uint8Array {
  const out: number[] = [];
  // Blank out prefixes in place so positions stay true
  const t = s
    .replace(fmt === "bin" ? /0b/gi : /0x|\\x/gi, (m) => " ".repeat(m.length))
    .replace(/%(?=[0-9a-f]{2})/gi, fmt === "hex" ? " " : "%");
  for (const m of t.matchAll(TOKEN)) {
    const tok = m[0];
    const i = m.index!;
    if (fmt === "hex") {
      const bad = /[^0-9a-f]/i.exec(tok);
      if (bad)
        throw new DecodeError(
          "Not valid hex: unexpected character",
          i + bad.index,
          bad[0],
        );
      if (tok.length === 1) out.push(parseInt(tok, 16));
      else if (tok.length % 2)
        throw new DecodeError(
          "Odd number of hex digits. Each byte is two digits.",
          i,
          tok.length > 16 ? tok.slice(0, 16) + "…" : tok,
        );
      else
        for (let k = 0; k < tok.length; k += 2)
          out.push(parseInt(tok.slice(k, k + 2), 16));
    } else if (fmt === "bin") {
      const bad = /[^01]/.exec(tok);
      if (bad)
        throw new DecodeError(
          "Not valid binary: only 0 and 1 are allowed",
          i + bad.index,
          bad[0],
        );
      if (tok.length <= 8) out.push(parseInt(tok, 2));
      else if (tok.length % 8)
        throw new DecodeError(
          "Binary bytes are groups of 8 bits. Separate them with spaces.",
          i,
          tok.length > 16 ? tok.slice(0, 16) + "…" : tok,
        );
      else
        for (let k = 0; k < tok.length; k += 8)
          out.push(parseInt(tok.slice(k, k + 8), 2));
    } else {
      const bad = /\D/.exec(tok);
      if (bad)
        throw new DecodeError(
          "Not valid decimal: unexpected character",
          i + bad.index,
          bad[0],
        );
      const v = parseInt(tok, 10);
      if (v > 255)
        throw new DecodeError("Not a byte (bytes go from 0 to 255)", i, tok);
      out.push(v);
    }
  }
  return Uint8Array.from(out);
}
