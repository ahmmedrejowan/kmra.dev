import QRCode from "qrcode";

/** What a QR code contains, by type. Everything is built on this device. */
export type Kind =
  | "url"
  | "text"
  | "wifi"
  | "vcard"
  | "email"
  | "phone"
  | "sms"
  | "whatsapp"
  | "geo";

export const KINDS: { id: Kind; label: string }[] = [
  { id: "url", label: "Link" },
  { id: "text", label: "Text" },
  { id: "wifi", label: "Wi-Fi" },
  { id: "vcard", label: "Contact" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "sms", label: "SMS" },
  { id: "geo", label: "Location" },
];

export type Fields = Record<string, string>;

/** Wi-Fi and MeCard fields escape \ ; , : and " with a backslash */
const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
const digits = (s: string) => s.replace(/[^\d+]/g, "");

/** The text stored in the code, or "" when required fields are missing. */
export function payload(kind: Kind, f: Fields): string {
  switch (kind) {
    case "url": {
      const u = (f.url ?? "").trim();
      if (!u) return "";
      return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
    }
    case "text":
      return f.text ?? "";
    case "wifi": {
      if (!f.ssid) return "";
      const sec = f.security || "WPA";
      return `WIFI:T:${sec === "none" ? "nopass" : sec};S:${esc(f.ssid)};${
        sec === "none" ? "" : `P:${esc(f.password ?? "")};`
      }${f.hidden === "1" ? "H:true;" : ""};`;
    }
    case "vcard": {
      if (!f.first && !f.last && !f.org) return "";
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${f.last ?? ""};${f.first ?? ""};;;`,
        `FN:${[f.first, f.last].filter(Boolean).join(" ") || f.org}`,
        f.org && `ORG:${f.org}`,
        f.title && `TITLE:${f.title}`,
        f.phone && `TEL;TYPE=CELL:${f.phone}`,
        f.email && `EMAIL:${f.email}`,
        f.website && `URL:${f.website}`,
        f.address && `ADR:;;${f.address};;;;`,
        "END:VCARD",
      ];
      return lines.filter(Boolean).join("\n");
    }
    case "email": {
      if (!f.email) return "";
      const q = new URLSearchParams();
      if (f.subject) q.set("subject", f.subject);
      if (f.body) q.set("body", f.body);
      const qs = q.toString().replace(/\+/g, "%20");
      return `mailto:${f.email}${qs ? `?${qs}` : ""}`;
    }
    case "phone":
      return f.phone ? `tel:${digits(f.phone)}` : "";
    case "sms":
      return f.phone ? `SMSTO:${digits(f.phone)}:${f.message ?? ""}` : "";
    case "whatsapp": {
      const n = digits(f.phone ?? "").replace(/^\+/, "");
      if (!n) return "";
      return `https://wa.me/${n}${f.message ? `?text=${encodeURIComponent(f.message)}` : ""}`;
    }
    case "geo": {
      const m = /(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/.exec(
        f.coords ?? "",
      );
      return m ? `geo:${m[1]},${m[2]}` : "";
    }
  }
}

/* ---------- Drawing ---------- */

export type Dots = "square" | "rounded" | "dots" | "fluid";
export type Eyes = "square" | "rounded" | "circle";

export interface Style {
  fg: string;
  /** "" = transparent */
  bg: string;
  dots: Dots;
  eyes: Eyes;
  /** Quiet zone in modules */
  margin: number;
  ecc: "L" | "M" | "Q" | "H";
}

export const DEFAULT_STYLE: Style = {
  fg: "#111111",
  bg: "#ffffff",
  dots: "square",
  eyes: "square",
  margin: 3,
  ecc: "M",
};

export interface Shape {
  /** Size including margins, in modules */
  size: number;
  /** SVG path for the data modules and the eyes (module units) */
  d: string;
  /** Grid size without margin */
  n: number;
}

const r2 = (v: number) => Math.round(v * 1000) / 1000;

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return `M${x} ${y}h${w}v${h}h${-w}Z`;
  return `M${r2(x + r)} ${y}h${r2(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${r2(h - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${r}h${r2(-(w - 2 * r))}a${r} ${r} 0 0 1 ${-r} ${-r}v${r2(-(h - 2 * r))}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
}
function circle(cx: number, cy: number, r: number) {
  return `M${r2(cx - r)} ${cy}a${r} ${r} 0 1 0 ${r2(2 * r)} 0a${r} ${r} 0 1 0 ${r2(-2 * r)} 0Z`;
}

/** Build the code's outline. `hole` (fraction of the grid) keeps the middle clear for a logo. */
export function shape(text: string, s: Style, hole = 0): Shape {
  const qr = QRCode.create(text, { errorCorrectionLevel: s.ecc });
  const n = qr.modules.size;
  const on = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < n && y < n && qr.modules.get(y, x) === 1;
  const m = s.margin;
  const inEye = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const h0 = (n * (1 - hole)) / 2;
  const h1 = n - h0;
  const inHole = (x: number, y: number) =>
    hole > 0 && x + 1 > h0 && x < h1 && y + 1 > h0 && y < h1;
  const parts: string[] = [];
  for (let y = 0; y < n; y++) {
    if (s.dots === "square") {
      // Merge runs into one rectangle per run
      let x = 0;
      while (x < n) {
        if (on(x, y) && !inEye(x, y) && !inHole(x, y)) {
          let e = x;
          while (
            e + 1 < n &&
            on(e + 1, y) &&
            !inEye(e + 1, y) &&
            !inHole(e + 1, y)
          )
            e++;
          parts.push(`M${x + m} ${y + m}h${e - x + 1}v1h${-(e - x + 1)}Z`);
          x = e + 1;
        } else x++;
      }
      continue;
    }
    for (let x = 0; x < n; x++) {
      if (!on(x, y) || inEye(x, y) || inHole(x, y)) continue;
      const X = x + m;
      const Y = y + m;
      if (s.dots === "dots") parts.push(circle(X + 0.5, Y + 0.5, 0.42));
      else if (s.dots === "rounded")
        parts.push(roundRect(X + 0.06, Y + 0.06, 0.88, 0.88, 0.3));
      else {
        // Fluid: round only the corners that have no neighbour
        const t = on(x, y - 1),
          b = on(x, y + 1),
          l = on(x - 1, y),
          r = on(x + 1, y);
        const R = 0.5;
        const tl = !t && !l ? R : 0;
        const tr = !t && !r ? R : 0;
        const br = !b && !r ? R : 0;
        const bl = !b && !l ? R : 0;
        parts.push(
          `M${X + tl} ${Y}h${1 - tl - tr}${tr ? `a${R} ${R} 0 0 1 ${R} ${R}` : ""}v${1 - tr - br}${
            br ? `a${R} ${R} 0 0 1 ${-R} ${R}` : ""
          }h${-(1 - br - bl)}${bl ? `a${R} ${R} 0 0 1 ${-R} ${-R}` : ""}v${-(1 - bl - tl)}${
            tl ? `a${R} ${R} 0 0 1 ${R} ${-R}` : ""
          }Z`,
        );
      }
    }
  }
  // Eyes: a 7×7 ring around a 3×3 centre, in the chosen shape
  for (const [ex, ey] of [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ] as const) {
    const X = ex + m;
    const Y = ey + m;
    if (s.eyes === "circle") {
      parts.push(circle(X + 3.5, Y + 3.5, 3.5), circle(X + 3.5, Y + 3.5, 2.5));
      parts.push(circle(X + 3.5, Y + 3.5, 1.5));
    } else {
      const r = s.eyes === "rounded" ? 1.6 : 0;
      parts.push(
        roundRect(X, Y, 7, 7, r),
        roundRect(X + 1, Y + 1, 5, 5, r ? 1 : 0),
      );
      parts.push(roundRect(X + 2, Y + 2, 3, 3, r ? 0.8 : 0));
    }
  }
  return { size: n + m * 2, d: parts.join(""), n };
}

export interface Logo {
  url: string;
  /** Natural size, to keep the shape */
  w: number;
  h: number;
}

/** Share of the grid a logo covers (kept small enough for high error correction to recover) */
export const LOGO_SIZE = 0.22;

export function svg(
  text: string,
  s: Style,
  logo: Logo | null,
  px = 1024,
): string {
  const sh = shape(text, s, logo ? LOGO_SIZE + 0.04 : 0);
  const S = sh.size;
  let logoSvg = "";
  if (logo) {
    const box = sh.n * LOGO_SIZE;
    const ratio = logo.w / logo.h;
    const w = ratio >= 1 ? box : box * ratio;
    const h = ratio >= 1 ? box / ratio : box;
    logoSvg = `<image href="${logo.url}" x="${r2((S - w) / 2)}" y="${r2((S - h) / 2)}" width="${r2(w)}" height="${r2(h)}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${px}" height="${px}" shape-rendering="${
    s.dots === "square" && s.eyes === "square"
      ? "crispEdges"
      : "geometricPrecision"
  }">${s.bg ? `<rect width="${S}" height="${S}" fill="${s.bg}"/>` : ""}<path fill="${s.fg}" fill-rule="evenodd" d="${sh.d}"/>${logoSvg}</svg>`;
}

/** Draw to a canvas at `px` pixels (logo drawn separately so the canvas stays exportable). */
export async function png(
  text: string,
  s: Style,
  logo: Logo | null,
  px: number,
): Promise<Blob> {
  const sh = shape(text, s, logo ? LOGO_SIZE + 0.04 : 0);
  const S = sh.size;
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const x = c.getContext("2d")!;
  if (s.bg) {
    x.fillStyle = s.bg;
    x.fillRect(0, 0, px, px);
  }
  x.save();
  x.scale(px / S, px / S);
  x.fillStyle = s.fg;
  x.fill(new Path2D(sh.d), "evenodd");
  x.restore();
  if (logo) {
    const img = new Image();
    img.src = logo.url;
    await img.decode();
    const box = (sh.n * LOGO_SIZE * px) / S;
    const ratio = logo.w / logo.h;
    const w = ratio >= 1 ? box : box * ratio;
    const h = ratio >= 1 ? box / ratio : box;
    x.imageSmoothingQuality = "high";
    x.drawImage(img, (px - w) / 2, (px - h) / 2, w, h);
  }
  return new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
}

/** Contrast check: dark code on a light background scans best. */
export function lowContrast(fg: string, bg: string): boolean {
  if (!bg) return false;
  const lum = (h: string) => {
    const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const c = v.map((u) =>
      u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const a = lum(fg);
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) < 3 || a > b;
}
