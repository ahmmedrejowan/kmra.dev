import { useEffect, useRef, useState } from "react";
import { zlibSync } from "fflate";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { Colors, Seg, Toggle } from "@kmra/ui/components/controls";
import { downloadBlob } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useT } from "@kmra/ui/lib/i18n-react";
import { DEFAULT_STYLE, payload, shape } from "../lib/qr";

/** A printable Wi-Fi card: QR code, network name and password, drawn on a canvas in millimetres. */
type Size = "a6" | "card" | "a4";
const SIZES: Record<
  Size,
  { label: string; w: number; h: number; css: number }
> = {
  a6: { label: "Table card (A6)", w: 105, h: 148, css: 300 },
  card: { label: "Business card", w: 85, h: 55, css: 400 },
  a4: { label: "A4 poster", w: 210, h: 297, css: 340 },
};
const ACCENTS = [
  "#ea580c",
  "#2563eb",
  "#0b6e4f",
  "#7a1fa2",
  "#e5484d",
  "#18181b",
];
const DPI = 300;
const MONO =
  'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

interface Spec {
  size: Size;
  title: string;
  note: string;
  ssid: string;
  /** "" = don't print it */
  password: string;
  qr: string;
  accent: string;
  dark: boolean;
  labels: { network: string; password: string };
  font: string;
}

export default function WifiCard({ lang }: { lang?: Locale; preset?: Preset }) {
  return (
    <LangProvider lang={lang}>
      <WifiCardView />
    </LangProvider>
  );
}

function WifiCardView() {
  const T = useT();
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [security, setSecurity] = useState("WPA");
  const [hidden, setHidden] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [size, setSize] = useState<Size>("a6");
  const [accent, setAccent] = useState(ACCENTS[0]!);
  const [dark, setDark] = useState(false);
  const [printPass, setPrintPass] = useState(true);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const open = security === "none";
  const qrText = payload("wifi", {
    ssid: ssid || T("Your network"),
    password,
    security,
    hidden: hidden ? "1" : "",
  });
  const titleText = title ?? T("Free Wi-Fi");
  const noteText = note ?? T("Scan with your phone camera to join");

  function spec(): Spec {
    const el = canvasRef.current;
    return {
      size,
      title: titleText.trim(),
      note: noteText.trim(),
      ssid: ssid || T("Your network"),
      password: !open && printPass ? password : "",
      qr: qrText,
      accent,
      dark,
      labels: { network: T("Network"), password: T("Password") },
      font: (el && getComputedStyle(el).fontFamily) || "sans-serif",
    };
  }

  // Live preview at screen resolution
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    let live = true;
    const s = spec();
    void fontsFor(s).then(() => {
      if (!live) return;
      const S = SIZES[s.size];
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const k = (S.css * dpr) / S.w;
      c.width = Math.round(S.w * k);
      c.height = Math.round(S.h * k);
      c.style.aspectRatio = `${S.w} / ${S.h}`;
      draw(c.getContext("2d")!, s, k);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    qrText,
    titleText,
    noteText,
    size,
    accent,
    dark,
    printPass,
    password,
    ssid,
  ]);

  async function render(): Promise<HTMLCanvasElement> {
    const s = spec();
    await fontsFor(s);
    const S = SIZES[s.size];
    const k = DPI / 25.4;
    const c = document.createElement("canvas");
    c.width = Math.round(S.w * k);
    c.height = Math.round(S.h * k);
    draw(c.getContext("2d")!, s, k);
    return c;
  }
  const fileName = `wifi-card-${size}`;

  function ok() {
    if (ssid.trim()) return true;
    toast(T("Type the network name first."));
    return false;
  }

  async function savePng() {
    if (!ok()) return;
    setBusy(true);
    try {
      const c = await render();
      const b = await new Promise<Blob>((r) =>
        c.toBlob((x) => r(x!), "image/png"),
      );
      downloadBlob(b, `${fileName}.png`);
    } finally {
      setBusy(false);
    }
  }

  async function savePdf() {
    if (!ok()) return;
    setBusy(true);
    try {
      const c = await render();
      const S = SIZES[size];
      downloadBlob(pdfOf(c, S.w, S.h), `${fileName}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  async function print() {
    if (!ok()) return;
    setBusy(true);
    let url = "";
    try {
      const c = await render();
      const b = await new Promise<Blob>((r) =>
        c.toBlob((x) => r(x!), "image/png"),
      );
      url = URL.createObjectURL(b);
      const S = SIZES[size];
      const box = document.createElement("div");
      box.className = "wc-print";
      const img = new Image();
      img.alt = "";
      img.src = url;
      img.style.width = `${S.w}mm`;
      img.style.height = `${S.h}mm`;
      box.append(img);
      const page = document.createElement("style");
      page.textContent = `@page { size: ${S.w}mm ${S.h}mm; margin: 0; }`;
      document.head.append(page);
      document.body.append(box);
      await img.decode();
      const root = document.documentElement;
      root.classList.add("wc-printing");
      let done = false;
      const clean = () => {
        if (done) return;
        done = true;
        root.classList.remove("wc-printing");
        box.remove();
        page.remove();
        URL.revokeObjectURL(url);
        window.removeEventListener("afterprint", clean);
      };
      window.addEventListener("afterprint", clean);
      window.print();
      // Browsers whose print() returns before the dialog closes still fire afterprint
      setTimeout(clean, 60_000);
    } catch {
      if (url) URL.revokeObjectURL(url);
      toast(T("Couldn't open printing. Download the PDF and print that."));
    } finally {
      setBusy(false);
    }
  }

  const S = SIZES[size];
  return (
    <div className="toolcard qrcard">
      <div className="stage qr-stage wc-stage">
        <canvas
          ref={canvasRef}
          className={`wc-canvas wc-${size}${ssid ? "" : " placeholder"}`}
          style={{ width: S.css, aspectRatio: `${S.w} / ${S.h}` }}
          role="img"
          aria-label={T("Wi-Fi card preview")}
        />
        <p className="qr-caption">
          {ssid ? (
            <>
              <Icon name="check" />{" "}
              {T("{w} × {h} mm. Prints at real size.", { w: S.w, h: S.h })}
            </>
          ) : (
            T("Example card. Type your network name to make yours.")
          )}
        </p>
      </div>
      <div className="controls">
        <div className="ctl">
          <label htmlFor="wc-ssid">{T("Network name (SSID)")}</label>
          <input
            id="wc-ssid"
            className="num"
            value={ssid}
            placeholder={T("Home Wi-Fi")}
            autoComplete="off"
            onChange={(e) => setSsid(e.target.value)}
          />
        </div>
        {!open && (
          <div className="ctl">
            <label htmlFor="wc-pass">{T("Password")}</label>
            <div className="wc-pass">
              <input
                id="wc-pass"
                className="num"
                type={reveal ? "text" : "password"}
                value={password}
                autoComplete="off"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="btn sm"
                aria-pressed={reveal}
                onClick={() => setReveal(!reveal)}
              >
                {reveal ? T("Hide") : T("Show")}
              </button>
            </div>
          </div>
        )}
        <Seg<string>
          label={T("Security")}
          options={[
            ["WPA", "WPA/WPA2/WPA3"],
            ["WEP", "WEP"],
            ["none", T("None")],
          ]}
          value={security}
          onPick={setSecurity}
        />
        <Toggle label={T("Hidden network")} on={hidden} onChange={setHidden} />
        {!open && (
          <Toggle
            label={T("Show the password on the card")}
            on={printPass}
            onChange={setPrintPass}
          />
        )}
        <div className="ctl">
          <label htmlFor="wc-title">{T("Card title")}</label>
          <input
            id="wc-title"
            className="num"
            value={titleText}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="ctl">
          <label htmlFor="wc-note">{T("Small note (optional)")}</label>
          <input
            id="wc-note"
            className="num"
            value={noteText}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="ctl">
          <span className="lbl">{T("Size")}</span>
          <div className="chips">
            {(Object.keys(SIZES) as Size[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={size === k}
                onClick={() => setSize(k)}
              >
                {T(SIZES[k].label)}
              </button>
            ))}
          </div>
        </div>
        <Colors
          label={T("Accent colour")}
          value={accent}
          onPick={setAccent}
          list={ACCENTS}
        />
        <Seg<boolean>
          label={T("Theme")}
          options={[
            [false, T("Light")],
            [true, T("Dark")],
          ]}
          value={dark}
          onPick={setDark}
        />
        <div className="result">
          <div className="acts">
            <button
              type="button"
              className="btn acc"
              disabled={busy}
              onClick={() => void print()}
            >
              <Icon name="file" />
              {T("Print")}
            </button>
            <div className="dl-row">
              <button
                type="button"
                className="btn sm"
                disabled={busy}
                onClick={() => void savePng()}
              >
                <Icon name="download" />
                PNG
              </button>
              <button
                type="button"
                className="btn sm"
                disabled={busy}
                onClick={() => void savePdf()}
              >
                <Icon name="download" />
                PDF
              </button>
            </div>
            <small>{T("PNG and PDF at 300 dpi, ready to print.")}</small>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Drawing (all sizes in millimetres) ---------- */

/** Make sure the page's fonts (incl. Bangla) are loaded before drawing text. */
async function fontsFor(s: Spec) {
  if (!document.fonts) return;
  const text = [
    s.title,
    s.note,
    s.ssid,
    s.labels.network,
    s.labels.password,
  ].join(" ");
  await Promise.all(
    [400, 600, 700].map((w) =>
      document.fonts.load(`${w} 16px ${s.font}`, text).catch(() => []),
    ),
  );
}

function draw(x: CanvasRenderingContext2D, s: Spec, k: number) {
  const S = SIZES[s.size];
  const W = S.w;
  const H = S.h;
  const ink = s.dark ? "#f4f4f5" : "#18181b";
  const muted = s.dark ? "#a1a1aa" : "#71717a";
  x.setTransform(k, 0, 0, k, 0, 0);
  x.fillStyle = s.dark ? "#16181d" : "#ffffff";
  x.fillRect(0, 0, W, H);
  x.textBaseline = "alphabetic";

  const font = (w: number, px: number, fam = s.font) =>
    (x.font = `${w} ${px}px ${fam}`);
  /** Largest size (down to `min`) at which `t` fits `maxW` */
  const fit = (
    t: string,
    w: number,
    px: number,
    min: number,
    maxW: number,
    fam?: string,
  ) => {
    let p = px;
    font(w, p, fam);
    while (p > min && x.measureText(t).width > maxW) font(w, (p *= 0.94), fam);
    return p;
  };
  /** Split into lines that fit `maxW` (by words, or by characters for long words) */
  const wrap = (t: string, maxW: number, max: number) => {
    const lines: string[] = [];
    let cur = "";
    for (const ch of t.includes(" ") ? t.split(/(\s+)/) : [...t]) {
      const next = cur + ch;
      if (cur && x.measureText(next).width > maxW) {
        lines.push(cur.trimEnd());
        cur = ch.trimStart();
        if (lines.length === max) return lines;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, max);
  };
  /** Draw text lines; returns the y after the last line */
  const lines = (
    t: string,
    w: number,
    px: number,
    min: number,
    maxW: number,
    cx: number,
    y: number,
    color: string,
    align: CanvasTextAlign,
    max = 2,
    fam?: string,
  ) => {
    const p = fit(t, w, px, min, maxW, fam);
    x.fillStyle = color;
    x.textAlign = align;
    const ls =
      p > min || x.measureText(t).width <= maxW ? [t] : wrap(t, maxW, max);
    for (const l of ls) {
      y += p;
      x.fillText(l, cx, y);
      y += p * 0.28;
    }
    return y;
  };

  const qrShape = shape(s.qr, {
    ...DEFAULT_STYLE,
    margin: 0,
    eyes: "rounded",
    ecc: "M",
  });
  const tile = (tx: number, ty: number, size: number, pad: number) => {
    x.fillStyle = "#ffffff";
    roundRect(x, tx, ty, size, size, size * 0.06);
    x.fill();
    if (!s.dark) {
      x.strokeStyle = "#e4e4e7";
      x.lineWidth = size * 0.006;
      x.stroke();
    }
    const q = size - pad * 2;
    x.save();
    x.translate(tx + pad, ty + pad);
    x.scale(q / qrShape.size, q / qrShape.size);
    x.fillStyle = "#111111";
    x.fill(new Path2D(qrShape.d), "evenodd");
    x.restore();
  };

  if (s.size === "card") {
    // Landscape: code on the left, text on the right
    const u = H / 55;
    x.fillStyle = s.accent;
    x.fillRect(0, H - 2.2 * u, W, 2.2 * u);
    const qs = 40 * u;
    const qy = (H - 2.2 * u - qs) / 2;
    tile(5 * u, qy, qs, 2.2 * u);
    const lx = 50 * u;
    const maxW = W - lx - 4.5 * u;
    wifiIcon(x, lx + 3.6 * u, 9.5 * u, 3.6 * u, s.accent);
    let y = 14.5 * u;
    if (s.title)
      y = lines(s.title, 700, 5.2 * u, 3 * u, maxW, lx, y, ink, "left");
    if (s.note)
      y = lines(s.note, 400, 2.4 * u, 1.9 * u, maxW, lx, y, muted, "left", 2);
    y += 1.6 * u;
    y = lines(
      s.labels.network,
      400,
      2.3 * u,
      1.8 * u,
      maxW,
      lx,
      y,
      muted,
      "left",
      1,
    );
    y = lines(s.ssid, 700, 3.6 * u, 2.2 * u, maxW, lx, y, ink, "left");
    if (s.password) {
      y += 0.8 * u;
      y = lines(
        s.labels.password,
        400,
        2.3 * u,
        1.8 * u,
        maxW,
        lx,
        y,
        muted,
        "left",
        1,
      );
      lines(
        s.password,
        600,
        3.4 * u,
        2.1 * u,
        maxW,
        lx,
        y,
        ink,
        "left",
        3,
        MONO,
      );
    }
    return;
  }

  // Portrait (A6 and A4 share the proportions): icon, title, note, code, network, password
  const u = W / 100;
  const cx = W / 2;
  const maxW = 84 * u;
  x.fillStyle = s.accent;
  x.fillRect(0, H - 3 * u, W, 3 * u);
  wifiIcon(x, cx, 15 * u, 7 * u, s.accent);
  let y = 25 * u;
  if (s.title)
    y = lines(s.title, 700, 9 * u, 5 * u, maxW, cx, y, ink, "center");
  if (s.note)
    y = lines(
      s.note,
      400,
      3.8 * u,
      3 * u,
      maxW,
      cx,
      y + 0.5 * u,
      muted,
      "center",
    );
  const qs = 56 * u;
  const qy = Math.max(y + 3 * u, 44 * u);
  tile(cx - qs / 2, qy, qs, 3 * u);
  y = qy + qs + 3 * u;
  y = lines(
    s.labels.network,
    400,
    3.4 * u,
    2.8 * u,
    maxW,
    cx,
    y,
    muted,
    "center",
    1,
  );
  y = lines(s.ssid, 700, 6 * u, 3.6 * u, maxW, cx, y, ink, "center");
  if (s.password) {
    y += 1.2 * u;
    y = lines(
      s.labels.password,
      400,
      3.4 * u,
      2.8 * u,
      maxW,
      cx,
      y,
      muted,
      "center",
      1,
    );
    lines(
      s.password,
      600,
      5.6 * u,
      3.4 * u,
      maxW,
      cx,
      y,
      ink,
      "center",
      2,
      MONO,
    );
  }
}

function roundRect(
  x: CanvasRenderingContext2D,
  l: number,
  t: number,
  w: number,
  h: number,
  r: number,
) {
  x.beginPath();
  x.moveTo(l + r, t);
  x.arcTo(l + w, t, l + w, t + h, r);
  x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r);
  x.arcTo(l, t, l + w, t, r);
  x.closePath();
}

/** Wi-Fi symbol in a soft accent circle of radius `r`, centred on (cx, cy) */
function wifiIcon(
  x: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
) {
  x.save();
  x.globalAlpha = 0.14;
  x.fillStyle = color;
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.fill();
  x.restore();
  const by = cy + r * 0.38;
  x.strokeStyle = color;
  x.fillStyle = color;
  x.lineWidth = r * 0.13;
  x.lineCap = "round";
  for (const f of [0.3, 0.54, 0.78]) {
    x.beginPath();
    x.arc(cx, by, r * f, Math.PI * 1.25, Math.PI * 1.75);
    x.stroke();
  }
  x.beginPath();
  x.arc(cx, by, r * 0.09, 0, Math.PI * 2);
  x.fill();
}

/* ---------- PDF (one page, the card as a lossless image) ---------- */

function pdfOf(c: HTMLCanvasElement, wMm: number, hMm: number): Blob {
  const px = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  const rgb = new Uint8Array(c.width * c.height * 3);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
    rgb[j] = px[i]!;
    rgb[j + 1] = px[i + 1]!;
    rgb[j + 2] = px[i + 2]!;
  }
  const img = zlibSync(rgb, { level: 6 });
  const pt = (mm: number) => +((mm * 72) / 25.4).toFixed(2);
  const W = pt(wMm);
  const H = pt(hMm);
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const put = (p: string | Uint8Array) => {
    const b = typeof p === "string" ? enc.encode(p) : p;
    parts.push(b);
    len += b.length;
  };
  const obj = (n: number, body: string) => {
    offsets[n] = len;
    put(`${n} 0 obj\n${body}\nendobj\n`);
  };
  put("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  offsets[4] = len;
  put(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.length} >>\nstream\n`,
  );
  put(img);
  put("\nendstream\nendobj\n");
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(6, "<< /Producer (kmra.dev) /Title (Wi-Fi card) >>");
  const xref = len;
  let t = "xref\n0 7\n0000000000 65535 f \n";
  for (let n = 1; n <= 6; n++)
    t += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  put(
    `${t}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}
