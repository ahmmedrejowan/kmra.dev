/**
 * Metadata removal without re-encoding: the file's own image data is kept byte for byte and only
 * the blocks that carry metadata are cut out, so a photo loses its location, camera and dates but
 * not a bit of quality. JPEG, PNG and WebP; other formats return null (the caller re-renders them).
 *
 * Kept on purpose: the colour profile (colours would shift without it) and the orientation (the
 * photo would turn sideways), which a JPEG gets back as a tiny EXIF block holding only that.
 */

/** What was cut out, for the report */
export type Removed = "exif" | "xmp" | "iptc" | "comment" | "thumbnail" | "extra" | "text" | "time";

export interface Stripped {
  bytes: Uint8Array<ArrayBuffer>;
  removed: Removed[];
  /** The orientation the photo keeps (1 = upright), JPEG only */
  orientation: number;
}

const ascii = (b: Uint8Array, at: number, n: number) =>
  String.fromCharCode(...b.subarray(at, Math.min(b.length, at + n)));

export function stripMetadata(input: Uint8Array): Stripped | null {
  if (input[0] === 0xff && input[1] === 0xd8) return jpeg(input);
  if (ascii(input, 1, 3) === "PNG") return png(input);
  if (ascii(input, 0, 4) === "RIFF" && ascii(input, 8, 4) === "WEBP") return webp(input);
  return null;
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** The Orientation tag (0x0112) of a JPEG's EXIF block, or 1 */
function exifOrientation(seg: Uint8Array): number {
  // seg: "Exif\0\0" then a TIFF header
  const t = 6;
  if (seg.length < t + 8) return 1;
  const le = seg[t] === 0x49;
  const u16 = (o: number) => (le ? seg[o]! | (seg[o + 1]! << 8) : (seg[o]! << 8) | seg[o + 1]!);
  const u32 = (o: number) =>
    le
      ? (seg[o]! | (seg[o + 1]! << 8) | (seg[o + 2]! << 16) | (seg[o + 3]! << 24)) >>> 0
      : ((seg[o]! << 24) | (seg[o + 1]! << 16) | (seg[o + 2]! << 8) | seg[o + 3]!) >>> 0;
  const ifd = t + u32(t + 4);
  if (ifd + 2 > seg.length) return 1;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > seg.length) break;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

/** An APP1 EXIF block holding only the orientation */
function orientationOnly(o: number): Uint8Array {
  const body = [
    ...[0x45, 0x78, 0x69, 0x66, 0, 0], // "Exif\0\0"
    ...[0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8], // big-endian TIFF header, IFD at 8
    0, 1, // one entry
    0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, // Orientation, SHORT, 1, value
    0, 0, 0, 0, // no next IFD
  ];
  const len = body.length + 2;
  return new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff, ...body]);
}

function jpeg(b: Uint8Array): Stripped {
  const keep: Uint8Array[] = [b.subarray(0, 2)];
  const removed = new Set<Removed>();
  let orientation = 1;
  let pos = 2;
  let afterApp0 = 1; // where the orientation block goes: after SOI, or after the JFIF block
  while (pos + 4 <= b.length) {
    if (b[pos] !== 0xff) break;
    const m = b[pos + 1]!;
    if (m === 0xff) {
      pos++;
      continue;
    }
    // The image data starts here: keep everything from the first scan to the end
    if (m === 0xda || m === 0xd9) {
      keep.push(b.subarray(pos));
      pos = b.length;
      break;
    }
    const len = (b[pos + 2]! << 8) | b[pos + 3]!;
    const seg = b.subarray(pos, pos + 2 + len);
    const id = ascii(seg, 4, 29);
    let drop = false;
    if (m === 0xe0) {
      // JFIF stays (density); a JFXX block is a thumbnail
      if (id.startsWith("JFXX")) {
        drop = true;
        removed.add("thumbnail");
      }
    } else if (m === 0xe1) {
      drop = true;
      if (id.startsWith("Exif")) {
        orientation = exifOrientation(seg.subarray(4));
        removed.add("exif");
      } else removed.add("xmp");
    } else if (m === 0xe2) {
      // The ICC colour profile stays; FlashPix and MPF (extra images such as depth maps) go
      if (!id.startsWith("ICC_PROFILE")) {
        drop = true;
        removed.add("extra");
      }
    } else if (m === 0xed) {
      drop = true;
      removed.add("iptc");
    } else if (m === 0xfe) {
      drop = true;
      removed.add("comment");
    } else if (m >= 0xe3 && m <= 0xef && m !== 0xee) {
      // Other APPn blocks are maker data; APP14 (Adobe) stays, decoders need it for CMYK
      drop = true;
      removed.add("extra");
    }
    if (!drop) {
      keep.push(seg);
      if (m === 0xe0) afterApp0 = keep.length;
    }
    pos += 2 + len;
  }
  if (orientation !== 1) keep.splice(afterApp0, 0, orientationOnly(orientation));
  return { bytes: concat(keep), removed: [...removed], orientation };
}

/** PNG chunks that describe the pixels (and APNG frames); everything else is metadata */
const PNG_KEEP = new Set([
  "IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "bKGD",
  "pHYs", "cICP", "mDCV", "cLLI", "acTL", "fcTL", "fdAT",
]);

function png(b: Uint8Array): Stripped {
  const keep: Uint8Array[] = [b.subarray(0, 8)];
  const removed = new Set<Removed>();
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 8;
  while (pos + 12 <= b.length) {
    const len = v.getUint32(pos);
    const type = ascii(b, pos + 4, 4);
    const end = pos + 12 + len;
    if (PNG_KEEP.has(type)) keep.push(b.subarray(pos, end));
    else if (type === "eXIf") removed.add("exif");
    else if (type === "tIME") removed.add("time");
    else if (type === "tEXt" || type === "zTXt" || type === "iTXt")
      removed.add(ascii(b, pos + 8, 22).startsWith("XML:com.adobe.xmp") ? "xmp" : "text");
    else removed.add("extra");
    pos = end;
    if (type === "IEND") break;
  }
  return { bytes: concat(keep), removed: [...removed], orientation: 1 };
}

function webp(b: Uint8Array): Stripped {
  const parts: Uint8Array[] = [];
  const removed = new Set<Removed>();
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 12;
  while (pos + 8 <= b.length) {
    const type = ascii(b, pos, 4);
    const size = v.getUint32(pos + 4, true);
    const end = pos + 8 + size + (size & 1);
    if (type === "EXIF") removed.add("exif");
    else if (type === "XMP ") removed.add("xmp");
    else {
      const chunk = b.slice(pos, end);
      // VP8X flags: no EXIF (bit 3) or XMP (bit 2) any more
      if (type === "VP8X") chunk[8] = chunk[8]! & ~0x0c;
      parts.push(chunk);
    }
    pos = end;
  }
  const body = concat(parts);
  const out = new Uint8Array(12 + body.length);
  out.set(b.subarray(0, 12));
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set(body, 12);
  return { bytes: out, removed: [...removed], orientation: 1 };
}
