import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { downloadBlob, formatBytes, isImageFile } from "@kmra/ui/lib/files";
import { stashFiles } from "@kmra/ui/lib/handoff";
import {
  baseName,
  CopyBtn,
  decode,
  DropCard,
  FileInput,
  ToolCard,
  useFiles,
} from "./kit";

/** Image info, EXIF viewer and histogram. Everything is read on this device. */
type Mode = "info" | "exif" | "histogram";

interface Entry {
  key: string;
  file: File;
  url: string;
  w: number;
  h: number;
  format: string;
  /** Pixel stats from a downscaled copy */
  stats: Stats;
  /** Grouped metadata from exifr, or null when there is none */
  meta: Record<string, Record<string, unknown>> | null;
}

interface Stats {
  hist: { r: number[]; g: number[]; b: number[]; l: number[] };
  alpha: boolean;
  avg: [number, number, number];
  mean: number;
  sd: number;
  dark: number;
  bright: number;
}

/** Real format from the first bytes, whatever the file name says */
async function sniff(file: File): Promise<string> {
  const b = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const s = String.fromCharCode(...b);
  if (b[0] === 0xff && b[1] === 0xd8) return "JPEG";
  if (s.startsWith("\x89PNG")) return "PNG";
  if (s.startsWith("GIF8")) return "GIF";
  if (s.startsWith("RIFF") && s.slice(8, 12) === "WEBP") return "WebP";
  if (s.slice(4, 8) === "ftyp") {
    const brand = s.slice(8, 12);
    if (/avi[fs]/.test(brand)) return "AVIF";
    if (/hei[cxms]|hev[cx]|mif1|msf1/.test(brand)) return "HEIC";
  }
  if (s.startsWith("BM")) return "BMP";
  if (s.startsWith("II*\0") || s.startsWith("MM\0*")) return "TIFF";
  if (/^\s*<(\?xml|svg)/i.test(s)) return "SVG";
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return "ICO";
  return file.type.replace("image/", "").toUpperCase() || "Unknown";
}

function analyse(bmp: ImageBitmap): Stats {
  const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const c = new OffscreenCanvas(w, h);
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(bmp, 0, 0, w, h);
  const p = x.getImageData(0, 0, w, h).data;
  const r = new Array(256).fill(0);
  const g = new Array(256).fill(0);
  const b = new Array(256).fill(0);
  const l = new Array(256).fill(0);
  let alpha = false;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let sl = 0;
  let sl2 = 0;
  let n = 0;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3]! < 250) alpha = true;
    if (p[i + 3] === 0) continue;
    const R = p[i]!;
    const G = p[i + 1]!;
    const B = p[i + 2]!;
    const L = Math.round(0.2126 * R + 0.7152 * G + 0.0722 * B);
    r[R]++;
    g[G]++;
    b[B]++;
    l[L]++;
    sr += R;
    sg += G;
    sb += B;
    sl += L;
    sl2 += L * L;
    n++;
  }
  n = n || 1;
  const mean = sl / n;
  const dark = (l.slice(0, 6).reduce((a, v) => a + v, 0) / n) * 100;
  const bright = (l.slice(250).reduce((a, v) => a + v, 0) / n) * 100;
  return {
    hist: { r, g, b, l },
    alpha,
    avg: [sr / n, sg / n, sb / n].map(Math.round) as [number, number, number],
    mean,
    sd: Math.sqrt(Math.max(0, sl2 / n - mean * mean)),
    dark,
    bright,
  };
}

async function readMeta(file: File) {
  try {
    const exifr = (await import("exifr")).default;
    const out = (await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      interop: false,
      ifd1: false,
      iptc: true,
      xmp: true,
      icc: true,
      jfif: true,
      ihdr: true,
      mergeOutput: false,
      translateValues: true,
      reviveValues: true,
      sanitize: true,
    })) as Record<string, Record<string, unknown>> | undefined;
    if (!out) return null;
    // Keep only groups that have something in them
    // Drop the embedded thumbnail's block and empty values
    const groups = Object.entries(out)
      .filter(([k, v]) => k !== "ifd1" && v && typeof v === "object")
      .map(
        ([k, v]) =>
          [
            k,
            Object.fromEntries(
              Object.entries(v).filter(
                ([, x]) => x !== "" && x !== null && x !== undefined,
              ),
            ),
          ] as const,
      )
      .filter(([, v]) => Object.keys(v).length);
    return groups.length ? Object.fromEntries(groups) : null;
  } catch {
    return null;
  }
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const COMMON: [number, number][] = [
  [1, 1],
  [4, 3],
  [3, 2],
  [16, 9],
  [5, 4],
  [4, 5],
  [3, 4],
  [2, 3],
  [9, 16],
  [21, 9],
];
function ratio(w: number, h: number): string {
  const d = gcd(w, h);
  const exact = `${w / d}:${h / d}`;
  if (w / d <= 32) return exact;
  const near = COMMON.find(([a, b]) => Math.abs(w / h - a / b) < 0.01);
  return near ? `≈ ${near[0]}:${near[1]}` : `${(w / h).toFixed(2)}:1`;
}

function fmt(v: unknown): string {
  if (v instanceof Date) return v.toLocaleString();
  if (Array.isArray(v)) return v.map(fmt).join(", ");
  if (v instanceof Uint8Array || ArrayBuffer.isView(v))
    return `${(v as Uint8Array).byteLength} bytes`;
  if (typeof v === "number")
    return Number.isInteger(v) ? String(v) : String(+v.toFixed(4));
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v ?? "");
}

/** Friendlier names for the groups exifr returns */
const GROUP: Record<string, string> = {
  ifd0: "Camera and file",
  exif: "Exposure and capture",
  gps: "Location (GPS)",
  iptc: "Caption and copyright (IPTC)",
  xmp: "Editing data (XMP)",
  icc: "Colour profile",
  jfif: "JPEG header",
  ihdr: "PNG header",
};

function pick(e: Entry, group: string, key: string): unknown {
  return e.meta?.[group]?.[key];
}

export default function Inspect({ mode }: { mode: Mode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cur, setCur] = useState(0);
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState<"rgb" | "l" | "r" | "g" | "b">("rgb");

  async function add(files: File[]) {
    setBusy(true);
    const out: Entry[] = [];
    for (const file of files) {
      try {
        const [bmp, format, meta] = await Promise.all([
          decode(file),
          sniff(file),
          readMeta(file),
        ]);
        out.push({
          key: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
          w: bmp.width,
          h: bmp.height,
          format,
          stats: analyse(bmp),
          meta,
        });
        bmp.close();
      } catch {
        // Still useful: metadata can often be read even when the browser can't show the image
        const meta = await readMeta(file);
        if (meta)
          out.push({
            key: crypto.randomUUID(),
            file,
            url: "",
            w: 0,
            h: 0,
            format: await sniff(file),
            stats: analyse(await createImageBitmap(new ImageData(1, 1))),
            meta,
          });
      }
    }
    setBusy(false);
    if (!out.length) return;
    setCur(entries.length);
    setEntries((p) => [...p, ...out]);
  }

  const {
    dragging,
    pickRef,
    pick: openPicker,
    take,
  } = useFiles({
    onFiles: (f) => void add(f),
    accept: isImageFile,
  });

  const e = entries[cur];
  const input = <FileInput inputRef={pickRef} onFiles={(f) => take(f)} />;

  if (!entries.length)
    return (
      <>
        <DropCard
          dragging={dragging}
          onPick={openPicker}
          title={busy ? "Reading…" : "Drop images here"}
          formats={["JPG", "PNG", "WebP", "HEIC", "GIF", "AVIF"]}
        />
        {input}
      </>
    );

  const filebar = (
    <div className="filebar">
      {entries.map((it, i) => (
        <button
          key={it.key}
          type="button"
          className="fchip"
          aria-pressed={i === cur}
          onClick={() => setCur(i)}
        >
          {it.url && <img src={it.url} alt="" />}
          <span>{it.file.name}</span>
        </button>
      ))}
      <button type="button" className="fchip add" onClick={openPicker}>
        + Add
      </button>
    </div>
  );

  const stage = (
    <>
      {e!.url ? (
        <img className="still" src={e!.url} alt={e!.file.name} />
      ) : (
        <p className="muted">
          This format can't be shown, but its data is below.
        </p>
      )}
      {filebar}
    </>
  );

  const panel =
    mode === "info" ? (
      <InfoPanel e={e!} />
    ) : mode === "exif" ? (
      <ExifPanel e={e!} />
    ) : (
      <HistPanel e={e!} channel={channel} setChannel={setChannel} />
    );

  return (
    <>
      <ToolCard
        stage={stage}
        panel={panel}
        dragging={dragging}
        wide={mode === "exif"}
      />
      {input}
    </>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Open the file in another tool on this site (kept on this device) */
async function handOff(file: File, path: string) {
  await stashFiles([file]);
  location.href = path;
}
const cleanCopy = (file: File) => handOff(file, "/strip-metadata");

function InfoPanel({ e }: { e: Entry }) {
  const make = pick(e, "ifd0", "Make");
  const model = pick(e, "ifd0", "Model");
  const taken =
    pick(e, "exif", "DateTimeOriginal") ?? pick(e, "ifd0", "ModifyDate");
  const lat = pick(e, "gps", "latitude");
  const dpi =
    pick(e, "ifd0", "XResolution") ?? pick(e, "jfif", "Xdensity") ?? null;
  const profile = pick(e, "icc", "ProfileDescription");
  const [r, g, b] = e.stats.avg;
  const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  const mp = (e.w * e.h) / 1e6;
  const rows: [string, React.ReactNode][] = [
    ["Format", e.format],
    [
      "File size",
      `${formatBytes(e.file.size)} (${e.file.size.toLocaleString()} bytes)`,
    ],
    ["Dimensions", `${e.w} × ${e.h} px`],
    [
      "Megapixels",
      mp >= 0.1 ? `${mp.toFixed(1)} MP` : `${(e.w * e.h).toLocaleString()} px`,
    ],
    ["Aspect ratio", ratio(e.w, e.h)],
    [
      "Orientation",
      e.w === e.h ? "Square" : e.w > e.h ? "Landscape" : "Portrait",
    ],
    ["Transparency", e.stats.alpha ? "Yes" : "No"],
    [
      "Average colour",
      <span className="avg">
        <i style={{ background: hex }} />
        {hex}
      </span>,
    ],
  ];
  if (dpi) rows.push(["Resolution", `${fmt(dpi)} dpi`]);
  if (profile) rows.push(["Colour profile", fmt(profile)]);
  if (make || model)
    rows.push(["Camera", [make, model].filter(Boolean).map(fmt).join(" ")]);
  if (taken) rows.push(["Taken", fmt(taken)]);
  rows.push(["Location data", lat !== undefined ? "Yes" : "No"]);
  rows.push([
    "Print size at 300 dpi",
    `${((e.w / 300) * 2.54).toFixed(1)} × ${((e.h / 300) * 2.54).toFixed(1)} cm`,
  ]);
  const text = rows
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : hex}`)
    .join("\n");
  return (
    <div className="panel-stack">
      <h3 className="ptitle-sm">{e.file.name}</h3>
      <Rows rows={rows} />
      {lat !== undefined && (
        <div className="note warn">
          <Icon name="shield" />
          <span>
            This photo includes where it was taken.{" "}
            <button
              type="button"
              className="linkbtn"
              onClick={() => void cleanCopy(e.file)}
            >
              Remove location and other data
            </button>
          </span>
        </div>
      )}
      <div className="acts-row">
        <CopyBtn text={text} label="Copy details" what="Details copied" />
        {e.meta && (
          <button
            type="button"
            className="btn sm"
            onClick={() => void handOff(e.file, "/exif")}
          >
            <Icon name="camera" />
            All metadata
          </button>
        )}
      </div>
    </div>
  );
}

function ExifPanel({ e }: { e: Entry }) {
  const lat = pick(e, "gps", "latitude") as number | undefined;
  const lon = pick(e, "gps", "longitude") as number | undefined;
  const json = useMemo(
    () =>
      JSON.stringify(
        e.meta ?? {},
        (_, v) =>
          ArrayBuffer.isView(v) ? `${(v as Uint8Array).byteLength} bytes` : v,
        2,
      ),
    [e],
  );
  if (!e.meta)
    return (
      <div className="panel-stack">
        <h3 className="ptitle-sm">{e.file.name}</h3>
        <p className="muted">
          No metadata found. This file has no camera, date or location info.
          Screenshots and images saved by apps often have none.
        </p>
      </div>
    );
  return (
    <div className="panel-stack">
      <h3 className="ptitle-sm">{e.file.name}</h3>
      {lat !== undefined && lon !== undefined && (
        <div className="note warn">
          <Icon name="shield" />
          <span>
            Taken at {lat.toFixed(5)}, {lon.toFixed(5)}.{" "}
            <a
              href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              See on a map
            </a>
          </span>
        </div>
      )}
      <div className="acts-row">
        <button
          type="button"
          className="btn sm acc"
          onClick={() => void cleanCopy(e.file)}
        >
          <Icon name="shield" />
          Remove all metadata
        </button>
        <CopyBtn text={json} label="Copy JSON" what="Metadata copied" />
        <button
          type="button"
          className="btn sm"
          onClick={() =>
            downloadBlob(
              new Blob([json], { type: "application/json" }),
              `${baseName(e.file.name)}-metadata.json`,
            )
          }
        >
          <Icon name="download" />
          JSON
        </button>
      </div>
      {Object.entries(e.meta).map(([group, tags]) => (
        <details
          key={group}
          className="mgroup"
          open={group !== "xmp" && group !== "icc"}
        >
          <summary>
            {GROUP[group] ?? group}
            <span>{Object.keys(tags).length}</span>
          </summary>
          <Rows
            rows={Object.entries(tags).map(([k, v]) => [
              k.replace(/([a-z])([A-Z])/g, "$1 $2"),
              fmt(v),
            ])}
          />
        </details>
      ))}
    </div>
  );
}

const CH = {
  r: "#ff4d4f",
  g: "#2fbf71",
  b: "#3b82f6",
  l: "#8a8f98",
} as const;

function HistPanel({
  e,
  channel,
  setChannel,
}: {
  e: Entry;
  channel: "rgb" | "l" | "r" | "g" | "b";
  setChannel: (c: "rgb" | "l" | "r" | "g" | "b") => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = (c.width = 512);
    const H = (c.height = 220);
    const x = c.getContext("2d")!;
    x.clearRect(0, 0, W, H);
    const shown =
      channel === "rgb" ? (["r", "g", "b"] as const) : ([channel] as const);
    // Ignore the extreme bins when scaling, so a clipped edge doesn't flatten everything else
    const peak = Math.max(
      1,
      ...shown.flatMap((k) => e.stats.hist[k].slice(2, 254)),
    );
    x.globalCompositeOperation = channel === "rgb" ? "lighter" : "source-over";
    for (const k of shown) {
      const h = e.stats.hist[k];
      x.fillStyle = CH[k];
      x.globalAlpha = channel === "rgb" ? 0.75 : 0.9;
      x.beginPath();
      x.moveTo(0, H);
      for (let i = 0; i < 256; i++)
        x.lineTo((i / 255) * W, H - Math.min(1, h[i]! / peak) * (H - 6));
      x.lineTo(W, H);
      x.closePath();
      x.fill();
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
  }, [e, channel]);
  const s = e.stats;
  const tone =
    s.mean < 70 ? "Mostly dark" : s.mean > 185 ? "Mostly bright" : "Balanced";
  const contrast = s.sd < 40 ? "Low" : s.sd > 75 ? "High" : "Normal";
  return (
    <div className="panel-stack">
      <div className="seg" role="group" aria-label="Channel">
        {(
          [
            ["rgb", "RGB"],
            ["l", "Brightness"],
            ["r", "Red"],
            ["g", "Green"],
            ["b", "Blue"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={channel === v}
            onClick={() => setChannel(v)}
          >
            {l}
          </button>
        ))}
      </div>
      <canvas ref={ref} className="hist" aria-label="Histogram" />
      <div className="hist-axis">
        <span>Shadows</span>
        <span>Midtones</span>
        <span>Highlights</span>
      </div>
      <Rows
        rows={[
          ["Overall", tone],
          ["Average brightness", `${Math.round((s.mean / 255) * 100)}%`],
          ["Contrast", `${contrast} (${Math.round(s.sd)})`],
          ["Pure black", `${s.dark.toFixed(1)}% of pixels`],
          ["Pure white", `${s.bright.toFixed(1)}% of pixels`],
        ]}
      />
      {(s.dark > 3 || s.bright > 3) && (
        <p className="muted small">
          {s.bright > 3
            ? "Highlights are clipped: some bright detail is lost. "
            : ""}
          {s.dark > 3 ? "Shadows are clipped: some dark detail is lost. " : ""}
          <a href="/adjust">Adjust brightness and contrast</a>
        </p>
      )}
    </div>
  );
}
