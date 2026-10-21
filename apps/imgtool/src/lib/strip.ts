/**
 * Metadata removal without re-encoding: the file's own image data is kept byte for byte and only
 * metadata changes, so a photo loses its location, camera and dates but not a bit of quality.
 * JPEG, PNG and WebP; other formats return null (the caller re-renders them).
 *
 * Every piece of metadata has a field id, and the caller says which to remove:
 *   EXIF        "ifd0:271" (block:tag), "ifd1" for the whole embedded preview
 *   XMP         "xmp:photoshop:City" (or "xmp" when the packet can't be read field by field)
 *   IPTC        "iptc:116" (record 2 dataset)
 *   others      "comment", "icc" (colour profile), "jfxx" (JFIF preview), "png:text:Author",
 *               "png:time", "extra:<name>" (maker blocks, extra images)
 * REMOVE_ALL removes everything but the orientation (ifd0:274) and the colour profile, which the
 * picture needs to look the same.
 */
import {
  emptyTiff,
  readTiff,
  withoutFields,
  writeTiff,
  type Tiff,
} from "./tiff";
import { readIptc, writeIptc, type IptcRecord } from "./iptc";
import { readXmp, writeXmp } from "./xmp";

/** Kinds of block that lost something, for the report */
export type Removed =
  | "exif"
  | "xmp"
  | "iptc"
  | "comment"
  | "thumbnail"
  | "extra"
  | "text"
  | "time"
  | "icc";

export interface Stripped {
  bytes: Uint8Array<ArrayBuffer>;
  removed: Removed[];
  /** The orientation the photo keeps (1 = upright) */
  orientation: number;
}

/** Everything in the file, for listing its fields */
export interface Parsed {
  format: "jpeg" | "png" | "webp";
  tiff: Tiff | null;
  xmp: string | null;
  iptc: IptcRecord[];
  comment: string | null;
  icc: boolean;
  jfxx: boolean;
  pngText: { keyword: string; value: string }[];
  pngTime: boolean;
  extras: { id: string; size: number }[];
}

export const REMOVE_ALL = (id: string) => id !== "ifd0:274" && id !== "icc";

const ascii = (b: Uint8Array, at: number, n: number) =>
  String.fromCharCode(...b.subarray(at, Math.min(b.length, at + n)));
const latin1 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 8192)
    s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
};
const utf8 = (b: Uint8Array) => new TextDecoder().decode(b);
const encode = (s: string) => new TextEncoder().encode(s);

const XMP_ID = "http://ns.adobe.com/xap/1.0/\0";
const XMP_EXT = "http://ns.adobe.com/xmp/extension/\0";
const EXIF_ID = "Exif\0\0";

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const orientationOf = (t: Tiff | null) => {
  const e = t?.ifd0.find((x) => x.tag === 0x0112);
  if (!e) return 1;
  const v = t!.le
    ? e.data[0]! | (e.data[1]! << 8)
    : (e.data[0]! << 8) | e.data[1]!;
  return v >= 1 && v <= 8 ? v : 1;
};

/** Is any field of this kind marked for removal? */
const anyRemoved = (ids: string[], remove: (id: string) => boolean) =>
  ids.some(remove);

function tiffIds(t: Tiff): string[] {
  const ids: string[] = [];
  for (const b of ["ifd0", "exif", "gps", "interop"] as const)
    for (const e of t[b]) ids.push(`${b}:${e.tag}`);
  if (t.ifd1.length || t.thumb) ids.push("ifd1");
  return ids;
}

function xmpIds(xml: string): string[] {
  const props = readXmp(xml);
  return props ? props.map((p) => p.id) : ["xmp"];
}

/** The XMP packet after removal: unchanged, rewritten, or gone (null) */
function xmpAfter(xml: string, remove: (id: string) => boolean): string | null {
  const props = readXmp(xml);
  if (!props) return remove("xmp") ? null : xml;
  if (
    !anyRemoved(
      props.map((p) => p.id),
      remove,
    )
  )
    return xml;
  return writeXmp(xml, remove);
}

const iptcId = (r: IptcRecord) =>
  r.record === 2 ? `iptc:${r.dataset}` : `iptc:r${r.record}:${r.dataset}`;

/* ---------- JPEG ---------- */

interface JpegSeg {
  m: number;
  seg: Uint8Array;
}

function jpegSegments(b: Uint8Array): { head: JpegSeg[]; rest: Uint8Array } {
  const head: JpegSeg[] = [];
  let pos = 2;
  while (pos + 4 <= b.length) {
    if (b[pos] !== 0xff) break;
    const m = b[pos + 1]!;
    if (m === 0xff) {
      pos++;
      continue;
    }
    // The image data starts here: everything from the first scan to the end stays
    if (m === 0xda || m === 0xd9) break;
    const len = (b[pos + 2]! << 8) | b[pos + 3]!;
    head.push({ m, seg: b.subarray(pos, pos + 2 + len) });
    pos += 2 + len;
  }
  return { head, rest: b.subarray(pos) };
}

const app = (marker: number, body: Uint8Array) => {
  const len = body.length + 2;
  const out = new Uint8Array(len + 2);
  out.set([0xff, marker, len >> 8, len & 0xff]);
  out.set(body, 4);
  return out;
};

function jpegParse(b: Uint8Array): Parsed {
  const p: Parsed = {
    format: "jpeg",
    tiff: null,
    xmp: null,
    iptc: [],
    comment: null,
    icc: false,
    jfxx: false,
    pngText: [],
    pngTime: false,
    extras: [],
  };
  for (const { m, seg } of jpegSegments(b).head) {
    const id = ascii(seg, 4, 35);
    const payload = seg.subarray(4);
    if (m === 0xe0) {
      if (id.startsWith("JFXX")) p.jfxx = true;
    } else if (m === 0xe1 && id.startsWith("Exif"))
      p.tiff = readTiff(payload.subarray(6));
    else if (m === 0xe1 && id.startsWith(XMP_ID))
      p.xmp = utf8(payload.subarray(XMP_ID.length));
    else if (m === 0xe1 && id.startsWith(XMP_EXT))
      p.extras.push({ id: "extra:xmp-extension", size: seg.length });
    else if (m === 0xe2 && id.startsWith("ICC_PROFILE")) p.icc = true;
    else if (m === 0xed) {
      p.iptc = readIptc(payload);
      p.extras.push({ id: "extra:photoshop", size: seg.length });
    } else if (m === 0xfe) p.comment = latin1(payload);
    else if (m >= 0xe1 && m <= 0xef && m !== 0xee)
      p.extras.push({ id: `extra:${extraName(m, id)}`, size: seg.length });
  }
  return p;
}

function extraName(m: number, id: string): string {
  const name = id
    .replace(/\0[\s\S]*$/, "")
    .replace(/[^\w.-]/g, "")
    .slice(0, 16);
  return `APP${m - 0xe0}${name ? `-${name}` : ""}`;
}

function jpeg(b: Uint8Array, remove: (id: string) => boolean): Stripped {
  const { head, rest } = jpegSegments(b);
  const keep: Uint8Array[] = [b.subarray(0, 2)];
  const removed = new Set<Removed>();
  let orientation = 1;
  let photoshopAt = -1;
  let iptcKept: IptcRecord[] | null = null;
  for (const { m, seg } of head) {
    const id = ascii(seg, 4, 35);
    const payload = seg.subarray(4);
    if (m === 0xe0) {
      if (id.startsWith("JFXX") && remove("jfxx")) removed.add("thumbnail");
      else keep.push(seg);
    } else if (m === 0xe1 && id.startsWith("Exif")) {
      const t = readTiff(payload.subarray(6));
      if (!t) {
        removed.add("exif");
        continue;
      }
      const ids = tiffIds(t);
      // A damaged or empty block carries nothing worth keeping
      if (!ids.length) {
        removed.add("exif");
        continue;
      }
      if (!anyRemoved(ids, remove)) {
        keep.push(seg);
        orientation = orientationOf(t);
        continue;
      }
      removed.add("exif");
      const after = withoutFields(t, new Set(ids.filter(remove)));
      orientation = orientationOf(after);
      if (!emptyTiff(after))
        keep.push(app(0xe1, concat([encode(EXIF_ID), writeTiff(after)])));
    } else if (m === 0xe1 && id.startsWith(XMP_ID)) {
      const xml = utf8(payload.subarray(XMP_ID.length));
      const after = xmpAfter(xml, remove);
      if (after === xml) keep.push(seg);
      else {
        removed.add("xmp");
        if (after)
          keep.push(app(0xe1, concat([encode(XMP_ID), encode(after)])));
      }
    } else if (m === 0xe1 && id.startsWith(XMP_EXT)) {
      if (remove("extra:xmp-extension")) removed.add("xmp");
      else keep.push(seg);
    } else if (m === 0xe2 && id.startsWith("ICC_PROFILE")) {
      if (remove("icc")) removed.add("icc");
      else keep.push(seg);
    } else if (m === 0xed) {
      const recs = readIptc(payload);
      const gone = recs.filter((r) => remove(iptcId(r)));
      if (!gone.length && !remove("extra:photoshop")) keep.push(seg);
      else {
        if (gone.length) removed.add("iptc");
        if (remove("extra:photoshop")) removed.add("extra");
        iptcKept = recs.filter((r) => !remove(iptcId(r)));
        // Written back below, where the Photoshop block stood
        photoshopAt = keep.length;
      }
    } else if (m === 0xfe) {
      if (remove("comment")) removed.add("comment");
      else keep.push(seg);
    } else if (m >= 0xe1 && m <= 0xef && m !== 0xee) {
      // Maker blocks and extra images (MPF); APP14 (Adobe) stays, decoders need it for CMYK
      if (remove(`extra:${extraName(m, id)}`)) removed.add("extra");
      else keep.push(seg);
    } else keep.push(seg);
  }
  if (photoshopAt >= 0 && iptcKept?.length)
    keep.splice(photoshopAt, 0, app(0xed, writeIptc(iptcKept)));
  keep.push(rest);
  return { bytes: concat(keep), removed: [...removed], orientation };
}

/* ---------- PNG ---------- */

/** PNG chunks that describe the pixels (and APNG frames) */
const PNG_PICTURE = new Set([
  "IHDR",
  "PLTE",
  "IDAT",
  "IEND",
  "tRNS",
  "gAMA",
  "cHRM",
  "sRGB",
  "sBIT",
  "bKGD",
  "pHYs",
  "cICP",
  "mDCV",
  "cLLI",
  "acTL",
  "fcTL",
  "fdAT",
]);

interface PngChunk {
  type: string;
  data: Uint8Array;
  raw: Uint8Array;
}

function pngChunks(b: Uint8Array): PngChunk[] {
  const out: PngChunk[] = [];
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 8;
  while (pos + 12 <= b.length) {
    const len = v.getUint32(pos);
    const type = ascii(b, pos + 4, 4);
    out.push({
      type,
      data: b.subarray(pos + 8, pos + 8 + len),
      raw: b.subarray(pos, pos + 12 + len),
    });
    pos += 12 + len;
    if (type === "IEND") break;
  }
  return out;
}

/** A tEXt/zTXt/iTXt chunk's keyword and (for tEXt and iTXt) its text */
function pngText(c: PngChunk): {
  keyword: string;
  value: string;
  xmp: boolean;
} {
  const z = c.data.indexOf(0);
  const keyword = latin1(c.data.subarray(0, z));
  if (c.type === "tEXt")
    return { keyword, value: latin1(c.data.subarray(z + 1)), xmp: false };
  if (c.type === "iTXt") {
    const compressed = c.data[z + 1] === 1;
    let p = z + 3;
    p = c.data.indexOf(0, p) + 1; // language
    p = c.data.indexOf(0, p) + 1; // translated keyword
    const value = compressed ? "" : utf8(c.data.subarray(p));
    return { keyword, value, xmp: keyword === "XML:com.adobe.xmp" };
  }
  return { keyword, value: "", xmp: false };
}

// CRC-32 for rewritten chunks
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(encode(type), 4);
  out.set(data, 8);
  let c = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i++)
    c = CRC[(c ^ out[i]!) & 0xff]! ^ (c >>> 8);
  v.setUint32(8 + data.length, (c ^ 0xffffffff) >>> 0);
  return out;
}

function pngParse(b: Uint8Array): Parsed {
  const p: Parsed = {
    format: "png",
    tiff: null,
    xmp: null,
    iptc: [],
    comment: null,
    icc: false,
    jfxx: false,
    pngText: [],
    pngTime: false,
    extras: [],
  };
  for (const c of pngChunks(b)) {
    if (PNG_PICTURE.has(c.type)) continue;
    if (c.type === "iCCP") p.icc = true;
    else if (c.type === "eXIf") p.tiff = readTiff(c.data);
    else if (c.type === "tIME") p.pngTime = true;
    else if (c.type === "tEXt" || c.type === "zTXt" || c.type === "iTXt") {
      const t = pngText(c);
      if (t.xmp) p.xmp = t.value;
      else
        p.pngText.push({
          keyword: t.keyword,
          value: t.value || "(compressed text)",
        });
    } else p.extras.push({ id: `extra:${c.type}`, size: c.raw.length });
  }
  return p;
}

function png(b: Uint8Array, remove: (id: string) => boolean): Stripped {
  const keep: Uint8Array[] = [b.subarray(0, 8)];
  const removed = new Set<Removed>();
  let orientation = 1;
  for (const c of pngChunks(b)) {
    if (PNG_PICTURE.has(c.type)) {
      keep.push(c.raw);
      continue;
    }
    if (c.type === "iCCP") {
      if (remove("icc")) removed.add("icc");
      else keep.push(c.raw);
    } else if (c.type === "eXIf") {
      const t = readTiff(c.data);
      if (!t) {
        removed.add("exif");
        continue;
      }
      const ids = tiffIds(t);
      if (!ids.length) {
        removed.add("exif");
        continue;
      }
      if (!anyRemoved(ids, remove)) {
        keep.push(c.raw);
        orientation = orientationOf(t);
        continue;
      }
      removed.add("exif");
      const after = withoutFields(t, new Set(ids.filter(remove)));
      orientation = orientationOf(after);
      if (!emptyTiff(after)) keep.push(pngChunk("eXIf", writeTiff(after)));
    } else if (c.type === "tIME") {
      if (remove("png:time")) removed.add("time");
      else keep.push(c.raw);
    } else if (c.type === "tEXt" || c.type === "zTXt" || c.type === "iTXt") {
      const t = pngText(c);
      if (t.xmp) {
        const after = xmpAfter(t.value, remove);
        if (after === t.value) keep.push(c.raw);
        else {
          removed.add("xmp");
          if (after) {
            const head = encode("XML:com.adobe.xmp\0\0\0\0\0");
            keep.push(pngChunk("iTXt", concat([head, encode(after)])));
          }
        }
      } else if (remove(`png:text:${t.keyword}`)) removed.add("text");
      else keep.push(c.raw);
    } else if (remove(`extra:${c.type}`)) removed.add("extra");
    else keep.push(c.raw);
  }
  return { bytes: concat(keep), removed: [...removed], orientation };
}

/* ---------- WebP ---------- */

function webpChunks(
  b: Uint8Array,
): { type: string; data: Uint8Array; raw: Uint8Array }[] {
  const out: { type: string; data: Uint8Array; raw: Uint8Array }[] = [];
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 12;
  while (pos + 8 <= b.length) {
    const type = ascii(b, pos, 4);
    const size = v.getUint32(pos + 4, true);
    const end = Math.min(b.length, pos + 8 + size + (size & 1));
    out.push({
      type,
      data: b.subarray(pos + 8, pos + 8 + size),
      raw: b.subarray(pos, end),
    });
    pos = end;
  }
  return out;
}

function webpChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + data.length + (data.length & 1));
  out.set(encode(type));
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}

function webpParse(b: Uint8Array): Parsed {
  const p: Parsed = {
    format: "webp",
    tiff: null,
    xmp: null,
    iptc: [],
    comment: null,
    icc: false,
    jfxx: false,
    pngText: [],
    pngTime: false,
    extras: [],
  };
  for (const c of webpChunks(b)) {
    if (c.type === "EXIF")
      p.tiff = readTiff(
        c.data.subarray(ascii(c.data, 0, 6) === EXIF_ID ? 6 : 0),
      );
    else if (c.type === "XMP ") p.xmp = utf8(c.data);
    else if (c.type === "ICCP") p.icc = true;
  }
  return p;
}

function webp(b: Uint8Array, remove: (id: string) => boolean): Stripped {
  const parts: Uint8Array[] = [];
  const removed = new Set<Removed>();
  let orientation = 1;
  let flagsAt = -1;
  let hasExif = false;
  let hasXmp = false;
  let hasIcc = false;
  for (const c of webpChunks(b)) {
    if (c.type === "EXIF") {
      const prefixed = ascii(c.data, 0, 6) === EXIF_ID;
      const t = readTiff(c.data.subarray(prefixed ? 6 : 0));
      const ids = t ? tiffIds(t) : [];
      if (t && ids.length && !anyRemoved(ids, remove)) {
        parts.push(c.raw);
        hasExif = true;
        orientation = orientationOf(t);
        continue;
      }
      removed.add("exif");
      if (!t) continue;
      const after = withoutFields(t, new Set(ids.filter(remove)));
      orientation = orientationOf(after);
      if (!emptyTiff(after)) {
        parts.push(webpChunk("EXIF", writeTiff(after)));
        hasExif = true;
      }
    } else if (c.type === "XMP ") {
      const xml = utf8(c.data);
      const after = xmpAfter(xml, remove);
      if (after === xml) {
        parts.push(c.raw);
        hasXmp = true;
      } else {
        removed.add("xmp");
        if (after) {
          parts.push(webpChunk("XMP ", encode(after)));
          hasXmp = true;
        }
      }
    } else if (c.type === "ICCP") {
      if (remove("icc")) removed.add("icc");
      else {
        parts.push(c.raw);
        hasIcc = true;
      }
    } else {
      const chunk = c.raw.slice();
      if (c.type === "VP8X") flagsAt = parts.length;
      parts.push(chunk);
    }
  }
  // VP8X flags: ICC (bit 5), EXIF (bit 3), XMP (bit 2) say what's left
  if (flagsAt >= 0) {
    const f = parts[flagsAt]!;
    f[8] =
      (f[8]! & ~0x2c) |
      (hasIcc ? 0x20 : 0) |
      (hasExif ? 0x08 : 0) |
      (hasXmp ? 0x04 : 0);
  }
  const body = concat(parts);
  const out = new Uint8Array(12 + body.length);
  out.set(b.subarray(0, 12));
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set(body, 12);
  return { bytes: out, removed: [...removed], orientation };
}

/* ---------- entry points ---------- */

type Kind = "jpeg" | "png" | "webp";
const kindOf = (b: Uint8Array): Kind | null =>
  b[0] === 0xff && b[1] === 0xd8
    ? "jpeg"
    : ascii(b, 1, 3) === "PNG"
      ? "png"
      : ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP"
        ? "webp"
        : null;

/** What's in the file, for listing its fields (null for formats handled by re-rendering) */
export function inspect(b: Uint8Array): Parsed | null {
  const k = kindOf(b);
  return k === "jpeg"
    ? jpegParse(b)
    : k === "png"
      ? pngParse(b)
      : k === "webp"
        ? webpParse(b)
        : null;
}

/** The file without the fields `remove` picks (everything but orientation and colour by default) */
export function stripMetadata(
  b: Uint8Array,
  remove: (id: string) => boolean = REMOVE_ALL,
): Stripped | null {
  const k = kindOf(b);
  return k === "jpeg"
    ? jpeg(b, remove)
    : k === "png"
      ? png(b, remove)
      : k === "webp"
        ? webp(b, remove)
        : null;
}

/** Every field id in a parsed file */
export function fieldIds(p: Parsed): string[] {
  return [
    ...(p.tiff ? tiffIds(p.tiff) : []),
    ...(p.xmp ? xmpIds(p.xmp) : []),
    ...p.iptc.map(iptcId),
    ...(p.comment !== null ? ["comment"] : []),
    ...(p.icc ? ["icc"] : []),
    ...(p.jfxx ? ["jfxx"] : []),
    ...p.pngText.map((t) => `png:text:${t.keyword}`),
    ...(p.pngTime ? ["png:time"] : []),
    ...p.extras.map((e) => e.id),
  ];
}
