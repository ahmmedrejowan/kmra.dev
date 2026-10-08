/**
 * 2D codes (Data Matrix, PDF417, Aztec, Micro QR, rMQR) with zxing-wasm's writer (MIT; zxing-cpp,
 * Apache-2.0, which uses zint, BSD-3). Loaded only on the page that needs it; the wasm file is
 * served from this site instead of the library's default CDN.
 */
type Writer = typeof import("zxing-wasm/writer");
let writer: Promise<Writer> | null = null;

function zxing(): Promise<Writer> {
  writer ??= (async () => {
    const z = await import("zxing-wasm/writer");
    const wasm = (await import("zxing-wasm/writer/zxing_writer.wasm?url"))
      .default;
    await z.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? wasm : prefix + path,
      },
      fireImmediately: true,
    });
    return z;
  })();
  writer.catch(() => (writer = null));
  return writer;
}

export type Format2d =
  "DataMatrix" | "PDF417" | "Aztec" | "MicroQRCode" | "RMQRCode";

export const FORMATS_2D: {
  id: Format2d;
  label: string;
  hint: string;
  sample: string;
}[] = [
  {
    id: "DataMatrix",
    label: "Data Matrix",
    hint: "A small square that holds a lot. Parts, electronics and medicine packs.",
    sample: "KMRA-2026-001",
  },
  {
    id: "PDF417",
    label: "PDF417",
    hint: "A wide stacked strip for long text. IDs, tickets and boarding passes.",
    sample: "KMRA TICKET 2026 SEAT 12A",
  },
  {
    id: "Aztec",
    label: "Aztec",
    hint: "Reads from the centre, so it needs little border. Train and plane tickets.",
    sample: "https://kmra.dev",
  },
  {
    id: "MicroQRCode",
    label: "Micro QR",
    hint: "A tiny QR for short text: up to 35 digits or about 15 letters.",
    sample: "KMRA 2026",
  },
  {
    id: "RMQRCode",
    label: "rMQR",
    hint: "A rectangular QR for narrow spaces. Most phone cameras can't read it yet; use a scanner app.",
    sample: "https://kmra.dev",
  },
];

/** Preset names from the registry, including short aliases */
export function formatOf(v: unknown): Format2d {
  const s = String(v ?? "").toLowerCase();
  if (s.startsWith("micro")) return "MicroQRCode";
  if (s.startsWith("rmqr")) return "RMQRCode";
  if (s.startsWith("pdf")) return "PDF417";
  if (s.startsWith("aztec")) return "Aztec";
  return "DataMatrix";
}

/** Blank border in modules when the quiet zone is on */
const QUIET: Record<Format2d, number> = {
  DataMatrix: 2,
  PDF417: 2,
  Aztec: 2,
  MicroQRCode: 2,
  RMQRCode: 2,
};

export interface Matrix {
  /** Size including the quiet zone, in modules */
  w: number;
  h: number;
  /** Dark modules as one SVG path (module units) */
  d: string;
  /** The symbol alone, without the quiet zone, in modules */
  cols?: number;
  rows?: number;
}

export type Made =
  { ok: true; m: Matrix } | { ok: false; reason: "long" | "chars" | "other" };

export async function make(
  text: string,
  format: Format2d,
  quiet: boolean,
): Promise<Made> {
  const z = await zxing();
  let r: Awaited<ReturnType<Writer["writeBarcode"]>>;
  try {
    r = await z.writeBarcode(text, {
      format,
      scale: 1,
      withQuietZones: false,
      // Square Data Matrix: the rectangular sizes are read by fewer scanners
      options: format === "DataMatrix" ? "forceSquare" : "",
    });
  } catch (e) {
    return { ok: false, reason: why(String(e)) };
  }
  if (r.error || !r.symbol?.width) return { ok: false, reason: why(r.error) };
  const { data, width, height } = r.symbol;
  const q = quiet ? QUIET[format] : 0;
  // 0 = dark, 255 = light; merge runs into one rectangle per run
  const parts: string[] = [];
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      if (data[y * width + x] === 0) {
        let e = x;
        while (e + 1 < width && data[y * width + e + 1] === 0) e++;
        parts.push(`M${x + q} ${y + q}h${e - x + 1}v1h${-(e - x + 1)}Z`);
        x = e + 1;
      } else x++;
    }
  }
  return {
    ok: true,
    m: {
      w: width + 2 * q,
      h: height + 2 * q,
      d: parts.join(""),
      cols: width,
      rows: height,
    },
  };
}

function why(msg: string): "long" | "chars" | "other" {
  if (/too long|maximum|too many|exceed|capacity/i.test(msg)) return "long";
  if (/invalid char|character|not (?:in|supported)|encod/i.test(msg))
    return "chars";
  return "other";
}

/** `bg` "" = transparent. Width and height in px (longest side), scaled from modules. */
export function toSvg(m: Matrix, fg: string, bg: string, px?: number): string {
  const k = px ? px / Math.max(m.w, m.h) : 0;
  const size = k
    ? ` width="${Math.round(m.w * k)}" height="${Math.round(m.h * k)}"`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.w} ${m.h}"${size} shape-rendering="crispEdges">${
    bg ? `<rect width="${m.w}" height="${m.h}" fill="${bg}"/>` : ""
  }<path fill="${fg}" d="${m.d}"/></svg>`;
}

/** Whole pixels per module, so the edges stay sharp; the longest side comes close to `px`. */
export function pngSize(m: Matrix, px: number) {
  const k = Math.max(1, Math.round(px / Math.max(m.w, m.h)));
  return { k, w: m.w * k, h: m.h * k };
}

export function toPng(
  m: Matrix,
  fg: string,
  bg: string,
  px: number,
): Promise<Blob> {
  const { k, w, h } = pngSize(m, px);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  if (bg) {
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
  }
  x.scale(k, k);
  x.fillStyle = fg;
  x.fill(new Path2D(m.d));
  return new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
}
