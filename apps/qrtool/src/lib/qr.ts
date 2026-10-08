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
  | "geo"
  | "event"
  | "social"
  | "pay";

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
  { id: "event", label: "Event" },
  { id: "social", label: "Social" },
  { id: "pay", label: "Payment" },
];

export type Platform =
  | "instagram"
  | "facebook"
  | "youtube"
  | "tiktok"
  | "x"
  | "linkedin"
  | "telegram";

export const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "telegram", label: "Telegram" },
];

export type PayMethod = "upi" | "epc" | "bitcoin" | "paypal";

export const PAY_METHODS: { id: PayMethod; label: string }[] = [
  { id: "upi", label: "UPI" },
  { id: "epc", label: "SEPA (EPC)" },
  { id: "bitcoin", label: "Bitcoin" },
  { id: "paypal", label: "PayPal" },
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
    case "event":
      return eventPayload(f);
    case "social":
      return socialUrl((f.platform as Platform) || "instagram", f.handle ?? "");
    case "pay":
      return payPayload(f);
  }
}

/* ---------- Event (iCalendar VEVENT) ---------- */

/** RFC 5545 text escaping: \ ; , and newlines */
export const icsEsc = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-09T10:00" (datetime-local) → Date in local time */
export function localDate(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(v);
  if (!m) return null;
  return new Date(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0));
}

/** Date → "2026-10-09T10:00" for <input type="datetime-local"> */
export function inputDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const icsDay = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const icsTime = (d: Date) =>
  `${icsDay(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

function eventPayload(f: Fields): string {
  const title = (f.title ?? "").trim();
  const start = localDate(f.start ?? "");
  if (!title || !start) return "";
  let end = localDate(f.end ?? "");
  const allDay = f.allday === "1";
  let when: string[];
  if (allDay) {
    // DTEND is exclusive: the day after the last day
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    let e = end
      ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
      : null;
    if (!e || e <= s)
      e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
    when = [`DTSTART;VALUE=DATE:${icsDay(s)}`, `DTEND;VALUE=DATE:${icsDay(e)}`];
  } else {
    if (!end || end <= start) end = new Date(start.getTime() + 3600_000);
    when = [`DTSTART:${icsTime(start)}`, `DTEND:${icsTime(end)}`];
  }
  return [
    "BEGIN:VEVENT",
    `SUMMARY:${icsEsc(title)}`,
    ...when,
    f.location?.trim() && `LOCATION:${icsEsc(f.location.trim())}`,
    f.notes?.trim() && `DESCRIPTION:${icsEsc(f.notes.trim())}`,
    "END:VEVENT",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ---------- Social profiles ---------- */

const SOCIAL_HOSTS: Record<Platform, RegExp> = {
  instagram: /^(www\.)?instagram\.com$/i,
  facebook: /^((www|m|web)\.)?(facebook|fb)\.com$/i,
  youtube: /^((www|m)\.)?(youtube\.com|youtu\.be)$/i,
  tiktok: /^((www|vm)\.)?tiktok\.com$/i,
  x: /^(www\.|mobile\.)?(x|twitter)\.com$/i,
  linkedin: /^([a-z]{2,3}\.|www\.)?linkedin\.com$/i,
  telegram: /^(t\.me|telegram\.me)$/i,
};

/** Tracking parameters added by share buttons */
const TRACKING = /^(utm_\w+|igsh|igshid|si|fbclid|ref_src|s)$/i;

/** The handle as typed or pulled out of a pasted link ("" if none) */
export function socialHandle(input: string): string {
  return input.trim().replace(/^@+/, "").replace(/\/+$/, "");
}

/** Profile link for a username, or a pasted link to that platform kept as it is */
export function socialUrl(p: Platform, input: string): string {
  const v = input.trim();
  if (!v) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (SOCIAL_HOSTS[p].test(u.hostname) && /[./]/.test(v)) {
      u.protocol = "https:";
      for (const k of [...u.searchParams.keys()])
        if (TRACKING.test(k)) u.searchParams.delete(k);
      return u.toString().replace(/\/$/, "");
    }
  } catch {}
  const h = encodeURIComponent(socialHandle(v.replace(/^.*\//, "")));
  if (!h) return "";
  switch (p) {
    case "instagram":
      return `https://instagram.com/${h}`;
    case "facebook":
      return `https://facebook.com/${h}`;
    case "youtube":
      return `https://youtube.com/@${h}`;
    case "tiktok":
      return `https://tiktok.com/@${h}`;
    case "x":
      return `https://x.com/${h}`;
    case "linkedin":
      return `https://linkedin.com/in/${h}`;
    case "telegram":
      return `https://t.me/${h}`;
  }
}

/* ---------- Payments ---------- */

const num = (s: string | undefined) => {
  const n = Number((s ?? "").replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
};
/** encodeURIComponent, but keep @ readable (UPI IDs) */
const enc = (s: string) => encodeURIComponent(s).replace(/%40/g, "@");

/** ISO 13616 check: move the first four characters to the end, letters → numbers, mod 97 = 1 */
function mod97(s: string): number {
  let r = 0;
  for (const c of s) {
    const v = /\d/.test(c) ? c : String(c.charCodeAt(0) - 55);
    for (const d of v) r = (r * 10 + +d) % 97;
  }
  return r;
}
export const cleanIban = (s: string) => s.replace(/\s+/g, "").toUpperCase();
export function ibanValid(iban: string): boolean {
  const s = cleanIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  return mod97(s.slice(4) + s.slice(0, 4)) === 1;
}
/** ISO 11649 creditor reference (RF…), which EPC codes carry as a structured reference */
function rfValid(ref: string): boolean {
  return (
    /^RF\d{2}[A-Z0-9]{1,21}$/.test(ref) &&
    mod97(ref.slice(4) + ref.slice(0, 4)) === 1
  );
}

export const upiValid = (pa: string) =>
  /^[\w.\-]{2,}@[a-z][\w.\-]*$/i.test(pa.trim());
export const btcValid = (a: string) =>
  /^(bc1[02-9ac-hj-np-z]{8,87}|BC1[02-9AC-HJ-NP-Z]{8,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(
    a.trim(),
  );
export const EPC_MAX = 999999999.99;

function payPayload(f: Fields): string {
  switch ((f.method as PayMethod) || "upi") {
    case "upi": {
      const pa = (f.upi ?? "").trim();
      if (!pa.includes("@")) return "";
      const am = num(f.upi_amount);
      const q = [
        `pa=${enc(pa)}`,
        f.payee?.trim() && `pn=${enc(f.payee.trim())}`,
        am && `am=${am.toFixed(2)}`,
        "cu=INR",
        f.upi_note?.trim() && `tn=${enc(f.upi_note.trim())}`,
      ];
      return `upi://pay?${q.filter(Boolean).join("&")}`;
    }
    case "epc": {
      const name = (f.payee ?? "").trim().slice(0, 70);
      const iban = cleanIban(f.iban ?? "");
      if (!name || !iban) return "";
      const am = num(f.eur);
      const ref = (f.ref ?? "").trim();
      const rf = cleanIban(ref);
      const structured = rfValid(rf);
      const lines = [
        "BCD",
        "002",
        "1",
        "SCT",
        cleanIban(f.bic ?? ""),
        name,
        iban,
        am >= 0.01 && am <= EPC_MAX ? `EUR${am.toFixed(2)}` : "",
        "",
        structured ? rf : "",
        structured ? "" : ref.slice(0, 140),
      ];
      // The last filled line must not be followed by a line break
      return lines.join("\n").replace(/\n+$/, "");
    }
    case "bitcoin": {
      const addr = (f.btc ?? "").trim().replace(/^bitcoin:/i, "");
      if (!addr) return "";
      const am = num(f.btc_amount);
      const q = [
        am && `amount=${am.toFixed(8).replace(/\.?0+$/, "")}`,
        f.btc_label?.trim() &&
          `label=${encodeURIComponent(f.btc_label.trim())}`,
        f.btc_message?.trim() &&
          `message=${encodeURIComponent(f.btc_message.trim())}`,
      ].filter(Boolean);
      return `bitcoin:${addr}${q.length ? `?${q.join("&")}` : ""}`;
    }
    case "paypal": {
      const user = (f.paypal ?? "")
        .trim()
        .replace(/^(https?:\/\/)?(www\.)?paypal\.me\//i, "")
        .replace(/^@/, "")
        .split("/")[0]!;
      if (!user) return "";
      const am = num(f.pp_amount);
      return `https://paypal.me/${encodeURIComponent(user)}${am ? `/${am.toFixed(2)}` : ""}`;
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
