/**
 * Reading QR codes and barcodes with zxing-wasm (MIT; zxing-cpp, Apache-2.0). The wasm file is
 * served from this site instead of the library's default CDN.
 */
type Reader = typeof import("zxing-wasm/reader");
let reader: Promise<Reader> | null = null;

function zxing(): Promise<Reader> {
  reader ??= (async () => {
    const z = await import("zxing-wasm/reader");
    const wasm = (await import("zxing-wasm/reader/zxing_reader.wasm?url"))
      .default;
    z.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? wasm : prefix + path,
      },
      fireImmediately: true,
    });
    return z;
  })();
  return reader;
}

export interface Found {
  text: string;
  format: string;
}

/** Every code in an image (file, blob or frame). */
export async function read(input: Blob | ImageData): Promise<Found[]> {
  const z = await zxing();
  const results = await z.readBarcodes(input, {
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: true,
    maxNumberOfSymbols: 8,
  });
  return results
    .filter((r) => r.isValid && r.text)
    .map((r) => ({ text: r.text, format: r.format }));
}

/* ---------- Understanding what was read ---------- */

export type Parsed =
  | { kind: "url"; url: URL }
  | {
      kind: "wifi";
      ssid: string;
      password: string;
      security: string;
      hidden: boolean;
    }
  | {
      kind: "vcard";
      name: string;
      phone?: string;
      email?: string;
      org?: string;
      raw: string;
    }
  | { kind: "email"; to: string; subject?: string; body?: string }
  | { kind: "phone"; number: string }
  | { kind: "sms"; number: string; message?: string }
  | { kind: "geo"; lat: string; lng: string }
  | {
      kind: "event";
      title: string;
      /** Local time for floating and UTC times; date only when allDay */
      start?: Date;
      end?: Date;
      allDay: boolean;
      location?: string;
      notes?: string;
      /** The VEVENT block as scanned */
      raw: string;
    }
  | {
      kind: "upi";
      /** UPI ID */
      pa: string;
      /** Payee name, as the code claims it */
      pn?: string;
      amount?: string;
      currency?: string;
      note?: string;
    }
  | {
      kind: "epc";
      name: string;
      iban: string;
      bic?: string;
      /** "12.50" */
      amount?: string;
      reference?: string;
    }
  | {
      kind: "bitcoin";
      address: string;
      amount?: string;
      label?: string;
      message?: string;
    }
  | { kind: "text" };

/** Split "K:V;K:V;" with backslash escapes */
function fieldsOf(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let key = "";
  let cur = "";
  let inKey = true;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "\\" && i + 1 < s.length) {
      cur += s[++i];
    } else if (inKey && c === ":") {
      key = cur;
      cur = "";
      inKey = false;
    } else if (!inKey && c === ";") {
      out[key.toUpperCase()] = cur;
      cur = "";
      inKey = true;
    } else cur += c;
  }
  return out;
}

export function parse(text: string): Parsed {
  const t = text.trim();
  if (/^BEGIN:(VEVENT|VCALENDAR)/i.test(t) && /BEGIN:VEVENT/i.test(t)) {
    const block = /BEGIN:VEVENT[\s\S]*?(END:VEVENT|$)/i.exec(t)?.[0] ?? t;
    // Unfold continuation lines, then read "NAME;PARAMS:value"
    const lines = block.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
    const prop = (k: string) => {
      for (const l of lines) {
        const m = /^([A-Z-]+)((?:;[^:]*)?):(.*)$/i.exec(l);
        if (m && m[1]!.toUpperCase() === k)
          return { params: m[2]!, value: m[3]! };
      }
      return undefined;
    };
    const unesc = (v?: string) =>
      v
        ?.replace(/\\([nN\\;,])/g, (_, c: string) =>
          c === "n" || c === "N" ? "\n" : c,
        )
        .trim() || undefined;
    const when = (k: string) => {
      const p = prop(k);
      const m =
        p &&
        /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(
          p.value.trim(),
        );
      if (!m) return undefined;
      const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(
        (x) => +(x ?? 0),
      ) as [number, number, number, number, number, number];
      return {
        date: m[7]
          ? new Date(Date.UTC(y, mo - 1, d, h, mi, s))
          : new Date(y, mo - 1, d, h, mi, s),
        day: !m[4],
      };
    };
    const start = when("DTSTART");
    let end = when("DTEND");
    // All-day DTEND is exclusive: show the last day of the event
    if (end?.day)
      end = {
        ...end,
        date: new Date(
          end.date.getFullYear(),
          end.date.getMonth(),
          end.date.getDate() - 1,
        ),
      };
    return {
      kind: "event",
      title: unesc(prop("SUMMARY")?.value) ?? "",
      start: start?.date,
      end: end && start && end.date >= start.date ? end.date : undefined,
      allDay: !!start?.day,
      location: unesc(prop("LOCATION")?.value),
      notes: unesc(prop("DESCRIPTION")?.value),
      raw: block,
    };
  }
  if (/^upi:\/\/pay\?/i.test(t)) {
    const q = new URLSearchParams(t.slice(t.indexOf("?") + 1));
    const get = (k: string) => q.get(k)?.trim() || undefined;
    return {
      kind: "upi",
      pa: get("pa") ?? "",
      pn: get("pn"),
      amount: get("am"),
      currency: get("cu"),
      note: get("tn"),
    };
  }
  if (/^BCD\r?\n/.test(t)) {
    const l = t.split(/\r?\n/).map((x) => x.trim());
    const am = /^EUR(\d+(?:\.\d{1,2})?)$/i.exec(l[7] ?? "");
    return {
      kind: "epc",
      bic: l[4] || undefined,
      name: l[5] ?? "",
      iban: l[6] ?? "",
      amount: am ? Number(am[1]).toFixed(2) : undefined,
      reference: l[9] || l[10] || undefined,
    };
  }
  const btc = /^bitcoin:([^?]*)(?:\?(.*))?$/i.exec(t);
  if (btc) {
    const q = new URLSearchParams(btc[2] ?? "");
    return {
      kind: "bitcoin",
      address: btc[1]!,
      amount: q.get("amount") ?? undefined,
      label: q.get("label") ?? undefined,
      message: q.get("message") ?? undefined,
    };
  }
  if (/^WIFI:/i.test(t)) {
    const f = fieldsOf(t.slice(5));
    return {
      kind: "wifi",
      ssid: f.S ?? "",
      password: f.P ?? "",
      security: f.T ?? "",
      hidden: /true/i.test(f.H ?? ""),
    };
  }
  if (/^BEGIN:VCARD/i.test(t)) {
    const line = (k: string) =>
      new RegExp(`^${k}[^:\\n]*:(.*)$`, "im").exec(t)?.[1]?.trim();
    return {
      kind: "vcard",
      name:
        line("FN") ??
        line("N")?.split(";").reverse().join(" ").trim() ??
        "Contact",
      phone: line("TEL"),
      email: line("EMAIL"),
      org: line("ORG"),
      raw: t,
    };
  }
  if (/^MECARD:/i.test(t)) {
    const f = fieldsOf(t.slice(7));
    return {
      kind: "vcard",
      name: (f.N ?? "Contact").split(",").reverse().join(" ").trim(),
      phone: f.TEL,
      email: f.EMAIL,
      raw: t,
    };
  }
  const mail = /^mailto:([^?]+)(\?.*)?$/i.exec(t);
  if (mail) {
    const q = new URLSearchParams(mail[2]?.slice(1) ?? "");
    return {
      kind: "email",
      to: decodeURIComponent(mail[1]!),
      subject: q.get("subject") ?? undefined,
      body: q.get("body") ?? undefined,
    };
  }
  const tel = /^tel:(.+)$/i.exec(t);
  if (tel) return { kind: "phone", number: tel[1]! };
  const sms = /^(?:SMSTO|sms):([^:?]+)(?::|\?body=)?(.*)$/i.exec(t);
  if (sms)
    return {
      kind: "sms",
      number: sms[1]!,
      message: decodeURIComponent(sms[2] ?? "") || undefined,
    };
  const geo = /^geo:(-?[\d.]+),(-?[\d.]+)/i.exec(t);
  if (geo) return { kind: "geo", lat: geo[1]!, lng: geo[2]! };
  try {
    const u = new URL(t);
    if (/^https?:$/.test(u.protocol)) return { kind: "url", url: u };
  } catch {}
  return { kind: "text" };
}

/** Link shorteners hide where a link goes */
const SHORTENERS =
  /^(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|rb\.gy|tiny\.cc|qrco\.de|qr\.page|l\.ead\.me)$/i;

export function linkWarnings(u: URL): string[] {
  const w: string[] = [];
  if (u.protocol === "http:")
    w.push("Not secure (http). Don't enter passwords on this site.");
  if (SHORTENERS.test(u.hostname))
    w.push("A short link: it hides the real address.");
  if (/xn--/.test(u.hostname))
    w.push("The address uses look-alike characters.");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname))
    w.push("The address is a bare IP number, not a name.");
  if (u.username || u.password) w.push("The link contains a login.");
  return w;
}

/* ---------- Checker, cleaner and batch scanner ---------- */

export interface Pt {
  x: number;
  y: number;
}

/** A code with where it sits and how it was built. */
export interface Detail extends Found {
  /** Corners in image pixels: top-left, top-right, bottom-right, bottom-left */
  corners: [Pt, Pt, Pt, Pt];
  /** "L" | "M" | "Q" | "H", a percentage for other symbologies, or "" */
  ecLevel: string;
  version: string;
  /** Modules across and down (0 when unknown) */
  cols: number;
  rows: number;
  inverted: boolean;
  mirrored: boolean;
}

type Formats = NonNullable<Parameters<Reader["readBarcodes"]>[1]>["formats"];

/** Every code in an image, with position, version and error correction. */
export async function readDetailed(
  input: Blob | ImageData,
  opts: { formats?: string[]; max?: number; harder?: boolean } = {},
): Promise<Detail[]> {
  const z = await zxing();
  const harder = opts.harder ?? true;
  const results = await z.readBarcodes(input, {
    tryHarder: harder,
    tryRotate: harder,
    tryInvert: true,
    tryDownscale: harder,
    maxNumberOfSymbols: opts.max ?? 8,
    ...(opts.formats ? { formats: opts.formats as Formats } : {}),
  });
  return results
    .filter((r) => r.isValid && r.text)
    .map((r) => {
      let extra: Record<string, unknown> = {};
      try {
        extra = r.extra ? (JSON.parse(r.extra) as Record<string, unknown>) : {};
      } catch {}
      const p = r.position;
      return {
        text: r.text,
        format: r.format,
        corners: [p.topLeft, p.topRight, p.bottomRight, p.bottomLeft].map(
          (q) => ({ x: q.x, y: q.y }),
        ) as Detail["corners"],
        ecLevel: String(extra.ECLevel ?? ""),
        version: String(extra.Version ?? ""),
        cols: r.symbol?.width ?? 0,
        rows: r.symbol?.height ?? 0,
        inverted: r.isInverted,
        mirrored: r.isMirrored,
      };
    });
}

/** Pixels in the shape of ImageData (so the helpers below also run outside a browser). */
export interface Px {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Axis-aligned box around a code's corners */
export function boxOf(c: Pt[]): Box {
  const xs = c.map((p) => p.x);
  const ys = c.map((p) => p.y);
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}

/** Side length of a code in pixels (mean of its four edges) */
export function sideOf(c: Pt[]): number {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = c[i]!;
    const b = c[(i + 1) % 4]!;
    s += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return s / 4;
}

/** WCAG relative luminance of an sRGB colour (0–255 channels) */
export function luminance(r: number, g: number, b: number): number {
  const f = (v: number) => {
    const u = v / 255;
    return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio of two luminances, 1–21 */
export function contrastRatio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const grayOf = (d: Uint8ClampedArray, i: number) =>
  Math.round(0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!);

/** Otsu's threshold for a 256-bin histogram */
export function otsu(hist: ArrayLike<number>): number {
  let total = 0;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    total += hist[i]!;
    sum += i * hist[i]!;
  }
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > best) {
      best = v;
      thr = i;
    }
  }
  return thr;
}

export interface Colours {
  /** Typical dark and light colours inside the box (RGB) */
  dark: [number, number, number];
  light: [number, number, number];
  ratio: number;
  /** Gray level splitting dark from light */
  threshold: number;
}

/**
 * The two colours a code is made of: split the box's pixels into dark and light (Otsu), then take
 * the median shade of each side, which ignores the blurry edges between modules.
 */
export function colours(img: Px, box: Box): Colours {
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(img.width, Math.ceil(box.x1));
  const y1 = Math.min(img.height, Math.ceil(box.y1));
  const step = Math.max(
    1,
    Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 400_000)),
  );
  const hist = new Float64Array(256);
  const rs = new Float64Array(256);
  const gs = new Float64Array(256);
  const bs = new Float64Array(256);
  const d = img.data;
  for (let y = y0; y < y1; y += step)
    for (let x = x0; x < x1; x += step) {
      const i = (y * img.width + x) * 4;
      if (d[i + 3]! < 128) {
        // Transparent pixels show as the page behind: count them as white
        hist[255]!++;
        rs[255]! += 255;
        gs[255]! += 255;
        bs[255]! += 255;
        continue;
      }
      const g = grayOf(d, i);
      hist[g]!++;
      rs[g]! += d[i]!;
      gs[g]! += d[i + 1]!;
      bs[g]! += d[i + 2]!;
    }
  const thr = otsu(hist);
  const median = (lo: number, hi: number): [number, number, number] => {
    let n = 0;
    for (let i = lo; i <= hi; i++) n += hist[i]!;
    let acc = 0;
    for (let i = lo; i <= hi; i++) {
      acc += hist[i]!;
      if (acc >= n / 2 && hist[i]!)
        return [rs[i]! / hist[i]!, gs[i]! / hist[i]!, bs[i]! / hist[i]!].map(
          Math.round,
        ) as [number, number, number];
    }
    const v = lo ? 255 : 0;
    return [v, v, v];
  };
  const dark = median(0, thr);
  const light = median(thr + 1, 255);
  return {
    dark,
    light,
    ratio: contrastRatio(luminance(...dark), luminance(...light)),
    threshold: thr,
  };
}

export interface Quiet {
  /** Blank margin on each side, in modules (capped at `cap`) */
  top: number;
  right: number;
  bottom: number;
  left: number;
  min: number;
  /** The margin ends at the image's edge rather than at something drawn */
  atEdge: boolean;
}

/**
 * How much blank space surrounds a code: walk outwards from each side of its box, one line of
 * pixels at a time, until a line holds enough "ink" (the code's colour) or the image ends.
 */
export function quietZone(
  img: Px,
  box: Box,
  modulePx: number,
  threshold: number,
  inkIsDark: boolean,
  cap = 8,
): Quiet {
  const { width: W, height: H, data: d } = img;
  const isInk = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    if (d[i + 3]! < 128) return !inkIsDark;
    const g = grayOf(d, i);
    return inkIsDark ? g <= threshold : g > threshold;
  };
  const x0 = Math.max(0, Math.round(box.x0));
  // The box's far edges are exclusive: step back to the code's last pixel
  const x1 = Math.min(W - 1, Math.round(box.x1) - 1);
  const y0 = Math.max(0, Math.round(box.y0));
  const y1 = Math.min(H - 1, Math.round(box.y1) - 1);
  const maxPx = Math.ceil(cap * modulePx);
  // Skip the soft edge of the code itself
  const skip = Math.max(1, Math.round(modulePx * 0.3));
  let atEdge = false;
  const walk = (
    limit: number,
    lineHasInk: (dist: number) => boolean,
  ): number => {
    for (let dist = skip; dist <= maxPx; dist++) {
      if (dist > limit) {
        atEdge = true;
        return Math.min(cap, (dist - 1) / modulePx);
      }
      if (lineHasInk(dist)) return Math.min(cap, (dist - 1) / modulePx);
    }
    return cap;
  };
  const strip = (count: (k: number) => boolean, len: number) => {
    // A line counts as ink once 3% of it is ink (noise and dust are ignored)
    let n = 0;
    const need = Math.max(2, len * 0.03);
    for (let k = 0; k < len; k++) if (count(k) && ++n >= need) return true;
    return false;
  };
  const top = walk(y0, (t) => strip((k) => isInk(x0 + k, y0 - t), x1 - x0 + 1));
  const bottom = walk(H - 1 - y1, (t) =>
    strip((k) => isInk(x0 + k, y1 + t), x1 - x0 + 1),
  );
  const left = walk(x0, (t) =>
    strip((k) => isInk(x0 - t, y0 + k), y1 - y0 + 1),
  );
  const right = walk(W - 1 - x1, (t) =>
    strip((k) => isInk(x1 + t, y0 + k), y1 - y0 + 1),
  );
  return {
    top,
    right,
    bottom,
    left,
    min: Math.min(top, right, bottom, left),
    atEdge,
  };
}

/**
 * Blur a copy of the pixels: three box passes of radius `r` each, close to a Gaussian with a
 * spread (sigma) of about √(r(r+1)) px.
 */
export function boxBlur(img: Px, r: number): Px {
  const { width: W, height: H } = img;
  let src = new Uint8ClampedArray(img.data);
  let dst = new Uint8ClampedArray(src.length);
  const rad = Math.max(1, Math.round(r));
  const pass = (horizontal: boolean) => {
    const len = horizontal ? W : H;
    const lines = horizontal ? H : W;
    for (let l = 0; l < lines; l++)
      for (let c = 0; c < 4; c++) {
        let acc = 0;
        const at = (p: number) => {
          const q = Math.min(len - 1, Math.max(0, p));
          return (horizontal ? l * W + q : q * W + l) * 4 + c;
        };
        for (let p = -rad; p <= rad; p++) acc += src[at(p)]!;
        for (let p = 0; p < len; p++) {
          dst[at(p)] = acc / (2 * rad + 1);
          acc += src[at(p + rad + 1)]! - src[at(p - rad)]!;
        }
      }
    [src, dst] = [dst, src];
  };
  for (let i = 0; i < 3; i++) {
    pass(true);
    pass(false);
  }
  return { data: src, width: W, height: H };
}

/** One CSV field: quoted when it holds a comma, quote or line break; formulas defused */
export function csvField(v: string): string {
  // A leading = + - @ makes spreadsheets run the cell as a formula
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows to CSV with a UTF-8 byte-order mark, so Excel shows Bangla and other scripts */
export function toCsv(rows: string[][]): string {
  return (
    "\uFEFF" + rows.map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n"
  );
}

/** Short names for what a code holds, by parse() kind (translate with T()) */
export const KIND_LABEL: Record<string, string> = {
  url: "Link",
  wifi: "Wi-Fi",
  vcard: "Contact",
  email: "Email",
  phone: "Phone",
  sms: "SMS",
  geo: "Location",
  event: "Event",
  upi: "UPI payment",
  epc: "Bank transfer",
  bitcoin: "Bitcoin",
  text: "Text",
};

/**
 * Decode any image the browser can show (WebP, AVIF and SVG included) to pixels, at most `max`
 * pixels on the longest side.
 */
export async function pixelsOf(
  file: Blob,
  max = 4096,
): Promise<{ canvas: HTMLCanvasElement; pixels: ImageData }> {
  let src: ImageBitmap | HTMLImageElement;
  let url = "";
  try {
    src = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // SVG and a few others only decode through an <img>
    url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    src = img;
  }
  try {
    const w = src.width || 512;
    const h = src.height || 512;
    const k = Math.min(1, max / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * k));
    canvas.height = Math.max(1, Math.round(h * k));
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    return {
      canvas,
      pixels: ctx.getImageData(0, 0, canvas.width, canvas.height),
    };
  } finally {
    if (src instanceof ImageBitmap) src.close();
    if (url) URL.revokeObjectURL(url);
  }
}
