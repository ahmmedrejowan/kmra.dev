/**
 * What a photo says about itself, in plain words, for the Strip metadata report: where it was
 * taken, the camera, when, the software, who owns it, and how many other camera details there are.
 * Read with exifr (loaded on first use).
 */

export interface MetaRow {
  /** English label, translated by the caller */
  label: string;
  value: string;
  /** Sensitive rows (location, serial numbers, names) are shown first and marked */
  private?: boolean;
}

export interface MetaSummary {
  rows: MetaRow[];
  /** Further technical details (exposure, ISO, lens settings…) not listed one by one */
  more: number;
}

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());

function when(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(+v))
    return v.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return str(v);
}

/** Tags shown as their own rows (or deliberately not counted as "more") */
const LISTED = new Set([
  "latitude", "longitude", "GPSLatitude", "GPSLongitude", "GPSLatitudeRef", "GPSLongitudeRef",
  "GPSAltitude", "GPSAltitudeRef", "Make", "Model", "LensModel", "LensMake", "DateTimeOriginal",
  "CreateDate", "DateTime", "ModifyDate", "Software", "CreatorTool", "Artist", "Byline", "creator",
  "Copyright", "CopyrightNotice", "rights", "BodySerialNumber", "SerialNumber", "CameraSerialNumber",
  "LensSerialNumber", "CameraOwnerName", "OwnerName", "ImageDescription", "Caption", "description",
  "Keywords", "subject", "City", "Country", "State", "Sublocation", "HostComputer",
  "ThumbnailOffset", "ThumbnailLength", "JPEGInterchangeFormat", "JPEGInterchangeFormatLength",
  // Not personal, not worth counting
  "Orientation", "XResolution", "YResolution", "ResolutionUnit", "ExifImageWidth", "ExifImageHeight",
  "ColorSpace", "YCbCrPositioning", "ImageWidth", "ImageHeight", "BitDepth", "ColorType",
  "Compression", "Filter", "Interlace", "ExifVersion", "FlashpixVersion", "ComponentsConfiguration",
]);

const first = (o: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v) ? v.length : str(v)) return v;
  }
  return undefined;
};

/** The summary, or null when the file couldn't be read at all */
export async function readSummary(file: Blob): Promise<MetaSummary | null> {
  let o: Record<string, unknown> = {};
  try {
    const mod = await import("exifr");
    const exifr = (mod.default ?? mod) as typeof mod.default;
    o =
      ((await exifr.parse(file, {
        tiff: true,
        exif: true,
        gps: true,
        iptc: true,
        xmp: true,
        icc: false,
        ifd1: true,
        jfif: false,
        ihdr: false,
        mergeOutput: true,
        translateValues: true,
        reviveValues: true,
        sanitize: true,
      })) as Record<string, unknown> | undefined) ?? {};
  } catch {
    return null;
  }
  const rows: MetaRow[] = [];
  const add = (label: string, value: string, priv = false) => {
    if (value) rows.push({ label, value, private: priv });
  };
  const lat = o.latitude as number | undefined;
  const lon = o.longitude as number | undefined;
  if (typeof lat === "number" && typeof lon === "number")
    add("Location", `${lat.toFixed(5)}, ${lon.toFixed(5)}`, true);
  add("Place", [o.Sublocation, o.City, o.State, o.Country].map(str).filter(Boolean).join(", "), true);
  add("Camera", [str(o.Make), str(o.Model)].filter(Boolean).join(" ").replace(/^(\S+) \1 /, "$1 "));
  add("Lens", str(first(o, "LensModel")));
  add("Taken", when(first(o, "DateTimeOriginal", "CreateDate", "DateTime", "ModifyDate")));
  add("Serial number", str(first(o, "BodySerialNumber", "SerialNumber", "CameraSerialNumber")), true);
  add("Owner", str(first(o, "CameraOwnerName", "OwnerName")), true);
  const author = first(o, "Artist", "Byline", "creator");
  add("Author", Array.isArray(author) ? author.map(str).join(", ") : str(author), true);
  const rights = first(o, "Copyright", "CopyrightNotice", "rights");
  add("Copyright", typeof rights === "object" && rights ? str(Object.values(rights)[0]) : str(rights));
  add("Software", str(first(o, "Software", "CreatorTool", "HostComputer")));
  const desc = first(o, "ImageDescription", "Caption", "description");
  add("Description", typeof desc === "object" && desc ? str(Object.values(desc)[0]) : str(desc));
  const kw = first(o, "Keywords", "subject");
  add("Keywords", Array.isArray(kw) ? kw.map(str).join(", ") : str(kw));
  // A small copy of the photo inside the file: it can still show what was cropped out
  if (o.ThumbnailLength || o.ThumbnailOffset || o.JPEGInterchangeFormat)
    add("Preview copy", "A small copy of the photo inside the file", true);
  // Private rows first
  rows.sort((a, b) => Number(!!b.private) - Number(!!a.private));
  const more = Object.keys(o).filter((k) => !LISTED.has(k) && !k.startsWith("GPS") && str(o[k])).length;
  return { rows, more };
}
