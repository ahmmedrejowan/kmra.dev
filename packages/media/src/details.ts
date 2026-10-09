/**
 * The finer details `probe()` adds for people (the Video info tool): codec profile and level from
 * the codec string, bit depth, colour description and HDR, coded size, and descriptive tags
 * (creation date, encoder, camera, location). Used by the fast reader (./wc.worker.ts) and by the
 * ffprobe reader (./ffmpeg.ts). Pure apart from `mp4Created`, which reads a few bytes of a File.
 */
import type { Input, InputAudioTrack, InputVideoTrack } from "mediabunny";
import type { MediaInfo } from "./types";

const AVC_PROFILES: Record<number, string> = {
  66: "Baseline",
  77: "Main",
  88: "Extended",
  100: "High",
  110: "High 10",
  122: "High 4:2:2",
  244: "High 4:4:4",
};
const AAC_PROFILES: Record<string, string> = {
  "2": "AAC-LC",
  "5": "HE-AAC",
  "29": "HE-AAC v2",
  "23": "AAC-LD",
  "39": "AAC-ELD",
};

/** Profile, level and bit depth from a codec string ("avc1.64001f" → High, level 3.1, 8-bit) */
export function codecDetails(s: string | null | undefined): {
  profile?: string;
  bitDepth?: number;
} {
  if (!s) return {};
  const p = s.split(".");
  const tag = p[0]!.toLowerCase();
  if ((tag === "avc1" || tag === "avc3") && p[1]?.length === 6) {
    const prof = parseInt(p[1].slice(0, 2), 16);
    const level = parseInt(p[1].slice(4, 6), 16) / 10;
    const name = AVC_PROFILES[prof] ?? `Profile ${prof}`;
    return {
      profile: `${name}, level ${level}`,
      bitDepth: prof === 110 || prof === 122 || prof === 244 ? undefined : 8,
    };
  }
  if (tag === "hvc1" || tag === "hev1") {
    const prof = Number((p[1] ?? "").replace(/\D/g, ""));
    const lv = /L(\d+)/i.exec(s);
    const name =
      prof === 1
        ? "Main"
        : prof === 2
          ? "Main 10"
          : prof === 3
            ? "Main Still"
            : `Profile ${prof}`;
    return {
      profile: lv ? `${name}, level ${Number(lv[1]) / 30}` : name,
      bitDepth: prof === 2 ? 10 : prof === 1 ? 8 : undefined,
    };
  }
  if (tag === "vp09" && p.length >= 4)
    return {
      profile: `Profile ${Number(p[1])}, level ${Number(p[2]) / 10}`,
      bitDepth: Number(p[3]) || undefined,
    };
  if (tag === "av01" && p.length >= 4) {
    const prof = Number(p[1]);
    return {
      profile: `${prof === 0 ? "Main" : prof === 1 ? "High" : "Professional"}, level ${p[2]}`,
      bitDepth: Number(p[3]) || undefined,
    };
  }
  if (tag === "mp4a" && p[1] === "40" && p[2])
    return { profile: AAC_PROFILES[p[2]] ?? undefined };
  return {};
}

/** HDR when the transfer is PQ (HDR10, Dolby Vision) or HLG */
export function isHdr(transfer?: string | null): boolean {
  return /pq|smpte2084|hlg|arib-std-b67/i.test(transfer ?? "");
}

/** Readable names for the tags people look for; other text tags keep their own key */
const TAG_NAMES: [RegExp, string][] = [
  [
    /^(creation_?time|com\.apple\.quicktime\.creationdate|©day|date)$/i,
    "Created",
  ],
  [
    /^(encoder|©too|com\.apple\.quicktime\.software|writing_?app|encoded_by)$/i,
    "Encoder",
  ],
  [
    /^(location(-eng)?|©xyz|com\.apple\.quicktime\.location\.iso6709)$/i,
    "Location",
  ],
  [/^(com\.apple\.quicktime\.make|make)$/i, "Camera make"],
  [/^(com\.apple\.quicktime\.model|model)$/i, "Camera model"],
  [/^(title|©nam)$/i, "Title"],
  [/^(comment|©cmt|description|©des)$/i, "Comment"],
  [/^(artist|©art)$/i, "Artist"],
  [/^(major_brand)$/i, "Brand"],
  [
    /^(handler_name|vendor_id|minor_version|compatible_brands|language|duration)$/i,
    "",
  ],
];

/** Tag key → readable name ("" = not worth showing) */
export function tagName(key: string): string {
  const hit = TAG_NAMES.find(([re]) => re.test(key));
  if (hit) return hit[1];
  return key
    .replace(/^com\.apple\.quicktime\./i, "")
    .replace(/^©/, "")
    .replace(/[_.]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Add tags (raw key → value) to a MediaInfo under readable names; first value wins */
export function addTags(info: MediaInfo, raw: Record<string, unknown>) {
  for (const [k, v] of Object.entries(raw)) {
    const value =
      v instanceof Date
        ? v.toISOString()
        : typeof v === "string"
          ? v.trim()
          : typeof v === "number"
            ? String(v)
            : null;
    if (!value || value.length > 300) continue;
    const name = tagName(k);
    if (!name) continue;
    info.tags ??= {};
    info.tags[name] ??= value;
  }
}

/** True for tags that say where a video was filmed */
export function isLocationTag(key: string): boolean {
  return /xyz|location|^loci$/i.test(key);
}

/**
 * A 3GPP location box (`loci`, what ffmpeg and some cameras write in MP4) as ISO 6709
 * ("+40.7128-074.0060/"), or null. Layout: version/flags, language, name (NUL-ended), role,
 * longitude, latitude, altitude (16.16 fixed point) …
 */
export function lociText(b: Uint8Array): string | null {
  if (b.length < 20) return null;
  let i = 6;
  while (i < b.length && b[i] !== 0) i++;
  i += 2;
  if (i + 8 > b.length) return null;
  const d = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const lon = d.getInt32(i) / 65536;
  const lat = d.getInt32(i + 4) / 65536;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (!lat && !lon)) return null;
  const f = (v: number, w: number) =>
    `${v < 0 ? "-" : "+"}${Math.abs(v)
      .toFixed(4)
      .padStart(w + 5, "0")}`;
  return `${f(lat, 2)}${f(lon, 3)}/`;
}

/**
 * Creation time from an MP4/MOV header (`mvhd`), or null. Reads only box headers: a few small
 * slices of the file, wherever the `moov` box is.
 */
export async function mp4Created(file: Blob): Promise<Date | null> {
  const read = async (at: number, n: number) =>
    new DataView(await file.slice(at, at + n).arrayBuffer());
  const box = async (at: number) => {
    const d = await read(at, 16);
    if (d.byteLength < 8) return null;
    let size = d.getUint32(0);
    const type = String.fromCharCode(
      d.getUint8(4),
      d.getUint8(5),
      d.getUint8(6),
      d.getUint8(7),
    );
    let head = 8;
    if (size === 1 && d.byteLength >= 16) {
      size = Number(d.getBigUint64(8));
      head = 16;
    } else if (size === 0) size = file.size - at;
    return size >= head ? { type, size, head } : null;
  };
  let at = 0;
  for (let i = 0; i < 64 && at < file.size; i++) {
    const b = await box(at);
    if (!b) return null;
    if (b.type === "moov") {
      let c = at + b.head;
      const end = at + b.size;
      for (let j = 0; j < 64 && c < end; j++) {
        const k = await box(c);
        if (!k) return null;
        if (k.type === "mvhd") {
          const d = await read(c + k.head, 12);
          const secs =
            d.getUint8(0) === 1 ? Number(d.getBigUint64(4)) : d.getUint32(4);
          if (!secs) return null;
          // Seconds since 1904-01-01 (UTC)
          const date = new Date(Date.UTC(1904, 0, 1) + secs * 1000);
          return date.getUTCFullYear() > 1970 ? date : null;
        }
        c += k.size;
      }
      return null;
    }
    at += b.size;
  }
  return null;
}

/** Fill in the finer details of a MediaInfo from Mediabunny's reader (never throws) */
export async function describe(
  input: Input,
  v: InputVideoTrack | null,
  a: InputAudioTrack | null,
  info: MediaInfo,
  file: Blob,
) {
  try {
    if (v && info.video) {
      const cs = await v.getCodecParameterString().catch(() => null);
      const col = await v.getColorSpace().catch(() => null);
      const hdr = await v.hasHighDynamicRange().catch(() => false);
      Object.assign(info.video, {
        ...(cs ? { codecString: cs } : {}),
        ...codecDetails(cs),
        codedWidth: await v.getCodedWidth(),
        codedHeight: await v.getCodedHeight(),
        ...(col && (col.primaries || col.transfer || col.matrix)
          ? {
              colour: {
                primaries: col.primaries ?? undefined,
                transfer: col.transfer ?? undefined,
                matrix: col.matrix ?? undefined,
                fullRange: col.fullRange ?? undefined,
              },
            }
          : {}),
        hdr: hdr || isHdr(col?.transfer),
      });
    }
    if (a && info.audio) {
      const cs = await a.getCodecParameterString().catch(() => null);
      if (cs)
        Object.assign(info.audio, { codecString: cs, ...codecDetails(cs) });
    }
    const t = await input.getMetadataTags().catch(() => null);
    const loci = t?.raw?.loci;
    if (loci instanceof Uint8Array) {
      const iso = lociText(loci);
      if (iso) addTags(info, { location: iso });
    }
    if (t)
      addTags(info, {
        date: t.date,
        title: t.title,
        comment: t.comment,
        artist: t.artist,
        ...(t.raw ?? {}),
      });
    if (/^(mp4|mov)$/.test(info.container) && !info.tags?.Created) {
      const d = await mp4Created(file).catch(() => null);
      if (d) addTags(info, { creation_time: d });
    }
  } catch {
    /* the basics are enough */
  }
}
