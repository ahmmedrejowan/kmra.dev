/**
 * EXIF as data: read a TIFF block (the payload of a JPEG APP1 "Exif", a PNG eXIf or a WebP EXIF
 * chunk) into its IFDs, drop fields, and write it back. Values are kept as their original bytes
 * (and byte order), so nothing is reinterpreted on the way through.
 *
 *   IFD0 (file, camera) ─▶ Exif IFD (capture) ─▶ Interop IFD
 *        ├─▶ GPS IFD (location)
 *        └─ next ─▶ IFD1 (the embedded preview: tags + its JPEG bytes)
 */

export interface Entry {
  tag: number;
  type: number;
  count: number;
  /** The value's bytes, count × size, in the block's byte order */
  data: Uint8Array;
}

export interface Tiff {
  le: boolean;
  ifd0: Entry[];
  exif: Entry[];
  gps: Entry[];
  interop: Entry[];
  ifd1: Entry[];
  /** The embedded preview JPEG (IFD1), if any */
  thumb: Uint8Array | null;
}

export type Block = "ifd0" | "exif" | "gps" | "interop" | "ifd1";

/** Bytes per value for TIFF types 1–13 */
const SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8, 4];
/** Tags that point to other IFDs or to the preview: rebuilt, never copied */
const POINTER = new Set([0x8769, 0x8825, 0xa005, 0x0201, 0x0202]);

export function readTiff(b: Uint8Array): Tiff | null {
  if (b.length < 8) return null;
  const le = b[0] === 0x49 && b[1] === 0x49;
  if (!le && !(b[0] === 0x4d && b[1] === 0x4d)) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (o: number) => v.getUint16(o, le);
  const u32 = (o: number) => v.getUint32(o, le);
  if (u16(2) !== 42) return null;
  const seen = new Set<number>();
  const readIfd = (
    at: number,
  ): { entries: Entry[]; ptr: Map<number, number>; next: number } => {
    const entries: Entry[] = [];
    const ptr = new Map<number, number>();
    if (!at || at + 2 > b.length || seen.has(at))
      return { entries, ptr, next: 0 };
    seen.add(at);
    const n = u16(at);
    for (let i = 0; i < n; i++) {
      const e = at + 2 + i * 12;
      if (e + 12 > b.length) break;
      const tag = u16(e);
      const type = u16(e + 2);
      const count = u32(e + 4);
      const size = (SIZE[type] ?? 0) * count;
      if (!SIZE[type] || size > b.length) continue;
      if (POINTER.has(tag)) {
        ptr.set(tag, u32(e + 8));
        continue;
      }
      const off = size <= 4 ? e + 8 : u32(e + 8);
      if (off + size > b.length) continue;
      entries.push({ tag, type, count, data: b.slice(off, off + size) });
    }
    const end = at + 2 + n * 12;
    return { entries, ptr, next: end + 4 <= b.length ? u32(end) : 0 };
  };
  const i0 = readIfd(u32(4));
  const ex = readIfd(i0.ptr.get(0x8769) ?? 0);
  const gps = readIfd(i0.ptr.get(0x8825) ?? 0);
  const iop = readIfd(ex.ptr.get(0xa005) ?? 0);
  const i1 = readIfd(i0.next);
  let thumb: Uint8Array | null = null;
  const tOff = i1.ptr.get(0x0201);
  const tLen = i1.ptr.get(0x0202);
  if (tOff && tLen && tOff + tLen <= b.length)
    thumb = b.slice(tOff, tOff + tLen);
  return {
    le,
    ifd0: i0.entries,
    exif: ex.entries,
    gps: gps.entries,
    interop: iop.entries,
    ifd1: i1.entries,
    thumb,
  };
}

/** True when there's nothing left worth writing */
export function emptyTiff(t: Tiff): boolean {
  return (
    !t.ifd0.length &&
    !t.exif.length &&
    !t.gps.length &&
    !t.interop.length &&
    !t.ifd1.length &&
    !t.thumb
  );
}

export function writeTiff(t: Tiff): Uint8Array<ArrayBuffer> {
  const le = t.le;
  const LONG = 4;
  type Plan = { entries: Entry[]; ptrs: [number, () => number][] };
  const hasInterop = t.interop.length > 0;
  const hasExif = t.exif.length > 0 || hasInterop;
  const hasGps = t.gps.length > 0;
  const hasIfd1 = t.ifd1.length > 0 || !!t.thumb;
  const at: Record<string, number> = {};
  const plans: [string, Plan][] = [
    [
      "ifd0",
      {
        entries: t.ifd0,
        ptrs: [
          ...(hasExif
            ? [[0x8769, () => at.exif!] as [number, () => number]]
            : []),
          ...(hasGps
            ? [[0x8825, () => at.gps!] as [number, () => number]]
            : []),
        ],
      },
    ],
    ...(hasExif
      ? [
          [
            "exif",
            {
              entries: t.exif,
              ptrs: hasInterop
                ? [[0xa005, () => at.interop!] as [number, () => number]]
                : [],
            },
          ] as [string, Plan],
        ]
      : []),
    ...(hasInterop
      ? [["interop", { entries: t.interop, ptrs: [] }] as [string, Plan]]
      : []),
    ...(hasGps
      ? [["gps", { entries: t.gps, ptrs: [] }] as [string, Plan]]
      : []),
    ...(hasIfd1
      ? [
          [
            "ifd1",
            {
              entries: t.ifd1,
              ptrs: t.thumb
                ? ([
                    [0x0201, () => at.thumb!],
                    [0x0202, () => t.thumb!.length],
                  ] as [number, () => number][])
                : [],
            },
          ] as [string, Plan],
        ]
      : []),
  ];
  // Layout: each IFD, then its long values; the preview last
  const ifdSize = (p: Plan) => 2 + (p.entries.length + p.ptrs.length) * 12 + 4;
  const dataSize = (p: Plan) =>
    p.entries.reduce(
      (n, e) =>
        n + (e.data.length > 4 ? e.data.length + (e.data.length & 1) : 0),
      0,
    );
  let pos = 8;
  for (const [name, p] of plans) {
    at[name] = pos;
    pos += ifdSize(p) + dataSize(p);
  }
  if (t.thumb) {
    at.thumb = pos;
    pos += t.thumb.length;
  }
  const out = new Uint8Array(pos);
  const v = new DataView(out.buffer);
  out[0] = out[1] = le ? 0x49 : 0x4d;
  v.setUint16(2, 42, le);
  v.setUint32(4, 8, le);
  for (const [name, p] of plans) {
    const start = at[name]!;
    const all = [
      ...p.entries.map((e) => ({
        tag: e.tag,
        write: (o: number, data: number) => writeEntry(o, e, data),
      })),
      ...p.ptrs.map(([tag, val]) => ({
        tag,
        write: (o: number) => {
          v.setUint16(o, tag, le);
          v.setUint16(o + 2, LONG, le);
          v.setUint32(o + 4, 1, le);
          v.setUint32(o + 8, val(), le);
        },
      })),
    ].sort((a, b) => a.tag - b.tag);
    v.setUint16(start, all.length, le);
    let data = start + ifdSize(p);
    function writeEntry(o: number, e: Entry, dataAt: number) {
      v.setUint16(o, e.tag, le);
      v.setUint16(o + 2, e.type, le);
      v.setUint32(o + 4, e.count, le);
      if (e.data.length <= 4) out.set(e.data, o + 8);
      else {
        v.setUint32(o + 8, dataAt, le);
        out.set(e.data, dataAt);
      }
    }
    all.forEach((x, i) => {
      const o = start + 2 + i * 12;
      const entry = p.entries.find((e) => e.tag === x.tag);
      if (entry && entry.data.length > 4) {
        x.write(o, data);
        data += entry.data.length + (entry.data.length & 1);
      } else x.write(o, 0);
    });
    // Next IFD: IFD0 links to IFD1
    v.setUint32(
      start + 2 + all.length * 12,
      name === "ifd0" && hasIfd1 ? at.ifd1! : 0,
      le,
    );
  }
  if (t.thumb) out.set(t.thumb, at.thumb!);
  return out;
}

/** A copy without the given fields ("block:tag"; "ifd1" alone drops the whole preview) */
export function withoutFields(t: Tiff, remove: Set<string>): Tiff {
  const keep = (block: Block) =>
    t[block].filter((e) => !remove.has(`${block}:${e.tag}`));
  const dropPreview = remove.has("ifd1");
  return {
    le: t.le,
    ifd0: keep("ifd0"),
    exif: keep("exif"),
    gps: keep("gps"),
    interop: keep("interop"),
    ifd1: dropPreview ? [] : t.ifd1,
    thumb: dropPreview ? null : t.thumb,
  };
}
