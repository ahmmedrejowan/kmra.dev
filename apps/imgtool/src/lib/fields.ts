/**
 * Every metadata field in a photo, for Strip metadata's checklist: its id (as strip.ts uses it),
 * a group, a readable name and value, and whether it's sensitive (says where, when or who).
 * Names and values come from exifr's dictionaries; the ids and the fields themselves from
 * strip.ts, so what's listed is exactly what can be removed.
 */
import { fieldIds, inspect, type Parsed } from "./strip";
import { IPTC_NAMES } from "./iptc";
import { readXmp } from "./xmp";

export type Group =
  | "Location"
  | "Date and time"
  | "People and rights"
  | "Device"
  | "Capture settings"
  | "Image"
  | "Preview copy"
  | "Editing data (XMP)"
  | "Caption and credits (IPTC)"
  | "Other";

export const GROUPS: Group[] = [
  "Location",
  "Date and time",
  "People and rights",
  "Device",
  "Preview copy",
  "Editing data (XMP)",
  "Caption and credits (IPTC)",
  "Capture settings",
  "Image",
  "Other",
];

export interface Field {
  id: string;
  group: Group;
  /** English name, translated by the caller when it's one of ours */
  label: string;
  value: string;
  sensitive: boolean;
  /** Needed for the picture to look the same (orientation, colour profile): kept by "Remove all" */
  display?: boolean;
}

const words = (s: string) =>
  s
    .replace(/^(GPS|XP)(?=[A-Z])/, "$1 ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());

/** Plain names for the tags people care about */
const NAMES: Record<string, string> = {
  Make: "Camera maker",
  Model: "Camera model",
  LensModel: "Lens",
  LensMake: "Lens maker",
  Software: "Software",
  HostComputer: "Computer",
  Artist: "Artist",
  Copyright: "Copyright",
  CameraOwnerName: "Owner",
  BodySerialNumber: "Serial number",
  SerialNumber: "Serial number",
  CameraSerialNumber: "Serial number",
  LensSerialNumber: "Lens serial number",
  DateTimeOriginal: "Taken",
  CreateDate: "Created",
  DateTime: "Modified",
  ModifyDate: "Modified",
  ImageDescription: "Description",
  UserComment: "Comment",
  Orientation: "Orientation",
  MakerNote: "Maker notes (the camera's private data)",
  ImageUniqueID: "Unique image ID",
  GPSLatitude: "Latitude",
  GPSLongitude: "Longitude",
  GPSAltitude: "Altitude",
  GPSLatitudeRef: "Latitude (north or south)",
  GPSLongitudeRef: "Longitude (east or west)",
  GPSAltitudeRef: "Altitude reference",
  GPSTimeStamp: "GPS time",
  GPSDateStamp: "GPS date",
  GPSImgDirection: "Facing direction",
  GPSSpeed: "Speed",
};

const SENSITIVE = /^(GPS|DateTime|CreateDate|ModifyDate|OffsetTime|SubSecTime|Artist|Copyright|CameraOwnerName|OwnerName|.*SerialNumber|ImageUniqueID|HostComputer|MakerNote|UserComment|ImageDescription|XP)/;

function groupOf(block: string, name: string): Group {
  if (block === "gps" || name.startsWith("GPS")) return "Location";
  if (/Date|Time|OffsetTime|SubSec/.test(name)) return "Date and time";
  if (/Artist|Copyright|Owner|Author|XP/.test(name)) return "People and rights";
  if (/Make|Model|Serial|Software|HostComputer|Lens|BodySerial|ImageUniqueID|MakerNote/.test(name)) return "Device";
  if (block === "exif" || block === "interop") return "Capture settings";
  return "Image";
}

const SIZES = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8, 4];

function show(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (v instanceof Date && !Number.isNaN(+v)) return v.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  if (v instanceof Uint8Array || ArrayBuffer.isView(v)) return `${(v as Uint8Array).byteLength} bytes`;
  if (Array.isArray(v)) return v.map(show).join(", ");
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(+v.toFixed(5));
  if (typeof v === "object") return JSON.stringify(v);
  return String(v).replace(/\0+$/, "").trim();
}

/** All fields of a file, grouped (null when the format isn't read field by field) */
export async function listFields(file: Blob): Promise<Field[] | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = inspect(bytes);
  if (!parsed) return null;
  let blocks: Record<string, Record<string, unknown>> = {};
  let keys: Map<string, Map<number, string>> = new Map();
  try {
    const mod = await import("exifr");
    const exifr = (mod.default ?? mod) as typeof mod.default & { tagKeys?: Map<string, Map<number, string>> };
    keys = (mod as unknown as { tagKeys?: typeof keys }).tagKeys ?? exifr.tagKeys ?? new Map();
    blocks =
      ((await exifr.parse(bytes, {
        tiff: true,
        exif: true,
        gps: true,
        interop: true,
        ifd1: true,
        iptc: true,
        xmp: false,
        icc: false,
        jfif: false,
        ihdr: false,
        makerNote: false,
        userComment: true,
        translateKeys: false,
        translateValues: true,
        reviveValues: true,
        mergeOutput: false,
        sanitize: false,
      })) as Record<string, Record<string, unknown>> | undefined) ?? {};
  } catch {
    blocks = {};
  }
  return fieldsOf(parsed, blocks, keys);
}

function fieldsOf(p: Parsed, blocks: Record<string, Record<string, unknown>>, keys: Map<string, Map<number, string>>): Field[] {
  const out: Field[] = [];
  const ids = new Set(fieldIds(p));
  if (p.tiff) {
    for (const block of ["ifd0", "exif", "gps", "interop"] as const) {
      for (const e of p.tiff[block]) {
        const id = `${block}:${e.tag}`;
        if (!ids.has(id)) continue;
        const name = keys.get(block === "interop" ? "interop" : block)?.get(e.tag) ?? `Tag ${e.tag}`;
        let value = show(blocks[block]?.[e.tag]);
        if (!value) value = e.type === 2 ? new TextDecoder().decode(e.data).replace(/\0+$/, "") : `${e.count * (SIZES[e.type] ?? 1)} bytes`;
        out.push({
          id,
          group: groupOf(block, name),
          label: NAMES[name] ?? words(name),
          value,
          sensitive: SENSITIVE.test(name),
          display: id === "ifd0:274",
        });
      }
    }
    if (ids.has("ifd1"))
      out.push({
        id: "ifd1",
        group: "Preview copy",
        label: "Preview copy (EXIF)",
        value: p.tiff.thumb ? `A small copy of the photo, ${Math.max(1, Math.round(p.tiff.thumb.length / 1024))} KB` : "Preview details",
        sensitive: true,
      });
  }
  if (p.xmp) {
    const props = readXmp(p.xmp);
    if (props)
      for (const x of props)
        out.push({
          id: x.id,
          group: "Editing data (XMP)",
          label: x.name,
          value: x.value || "(empty)",
          // History, document ids, creators, rights and places say who and where
          sensitive: /(xmpMM:|dc:creator|dc:rights|photoshop:(City|State|Country|Credit|AuthorsPosition)|Iptc4xmpCore:Location|exif:GPS|xmp:CreatorTool|photoshop:DateCreated|xmp:(Create|Modify|Metadata)Date)/.test(x.name),
        });
    else out.push({ id: "xmp", group: "Editing data (XMP)", label: "Editing data", value: `${p.xmp.length} characters`, sensitive: true });
  }
  const iptcSeen = new Set<string>();
  for (const r of p.iptc) {
    const id = r.record === 2 ? `iptc:${r.dataset}` : `iptc:r${r.record}:${r.dataset}`;
    const value = new TextDecoder().decode(r.data);
    const prev = out.find((f) => f.id === id);
    if (iptcSeen.has(id) && prev) {
      prev.value += `, ${value}`;
      continue;
    }
    iptcSeen.add(id);
    const name = r.record === 2 ? (IPTC_NAMES[r.dataset] ?? `Dataset ${r.dataset}`) : `Record ${r.record}, dataset ${r.dataset}`;
    out.push({
      id,
      group: "Caption and credits (IPTC)",
      label: name,
      value,
      sensitive: [55, 60, 62, 63, 80, 85, 90, 92, 95, 100, 101, 110, 115, 116, 118, 122].includes(r.dataset),
    });
  }
  if (p.comment !== null) out.push({ id: "comment", group: "Other", label: "Comment", value: p.comment.trim() || "(empty)", sensitive: true });
  if (p.jfxx) out.push({ id: "jfxx", group: "Preview copy", label: "Preview copy (JFIF)", value: "A small copy of the photo", sensitive: true });
  for (const t of p.pngText)
    out.push({ id: `png:text:${t.keyword}`, group: "Other", label: t.keyword, value: t.value, sensitive: /author|copyright|comment|description|source|location|creation/i.test(t.keyword) });
  if (p.pngTime) out.push({ id: "png:time", group: "Date and time", label: "Last edited", value: "Time stamp", sensitive: true });
  for (const e of p.extras)
    out.push({
      id: e.id,
      group: "Other",
      label: e.id === "extra:photoshop" ? "Photoshop data" : e.id === "extra:xmp-extension" ? "More editing data (XMP)" : `Extra data (${e.id.slice(6)})`,
      value: `${Math.max(1, Math.round(e.size / 1024))} KB`,
      sensitive: true,
    });
  if (p.icc) out.push({ id: "icc", group: "Image", label: "Colour profile", value: "Keeps the colours right", sensitive: false, display: true });
  return out;
}
