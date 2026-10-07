import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { toast } from "@kmra/ui/lib/toast";
import { Colors as ColorPick, Seg, Slider } from "./FxControls";
import {
  canvasBlob,
  CopyBtn,
  decode,
  DropCard,
  downloadZip,
  FileInput,
  ToolCard,
  useFiles,
} from "./kit";

/** Favicon generator: every icon a website needs, plus the HTML to paste. */
const PNGS: { name: string; size: number; solid?: boolean }[] = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  // iOS ignores transparency and shows black, so this one always gets a background
  { name: "apple-touch-icon.png", size: 180, solid: true },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 },
];
const ICO_SIZES = [16, 32, 48];

/** ICO file holding PNG images (supported by every current browser and Windows) */
async function ico(images: { size: number; blob: Blob }[]): Promise<Blob> {
  const datas = await Promise.all(
    images.map(async (i) => new Uint8Array(await i.blob.arrayBuffer())),
  );
  const head = 6 + 16 * images.length;
  const total = head + datas.reduce((a, d) => a + d.length, 0);
  const buf = new Uint8Array(total);
  const v = new DataView(buf.buffer);
  v.setUint16(2, 1, true);
  v.setUint16(4, images.length, true);
  let offset = head;
  images.forEach((img, i) => {
    const e = 6 + i * 16;
    v.setUint8(e, img.size >= 256 ? 0 : img.size);
    v.setUint8(e + 1, img.size >= 256 ? 0 : img.size);
    v.setUint16(e + 4, 1, true);
    v.setUint16(e + 6, 32, true);
    v.setUint32(e + 8, datas[i]!.length, true);
    v.setUint32(e + 12, offset, true);
    buf.set(datas[i]!, offset);
    offset += datas[i]!.length;
  });
  return new Blob([buf], { type: "image/x-icon" });
}

interface Opts {
  fit: "cover" | "contain";
  pad: number;
  radius: number;
  bg: string;
  transparent: boolean;
}

function paint(
  src: ImageBitmap,
  size: number,
  o: Opts,
  solid = false,
): OffscreenCanvas {
  const c = new OffscreenCanvas(size, size);
  const x = c.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  const r = (size * o.radius) / 100;
  x.beginPath();
  x.roundRect(0, 0, size, size, r);
  x.clip();
  if (!o.transparent || solid) {
    x.fillStyle = o.transparent ? "#ffffff" : o.bg;
    x.fillRect(0, 0, size, size);
  }
  const pad = (size * o.pad) / 100;
  const box = size - pad * 2;
  const scale =
    o.fit === "cover"
      ? Math.max(box / src.width, box / src.height)
      : Math.min(box / src.width, box / src.height);
  const w = src.width * scale;
  const h = src.height * scale;
  x.save();
  x.beginPath();
  x.rect(pad, pad, box, box);
  x.clip();
  x.drawImage(src, (size - w) / 2, (size - h) / 2, w, h);
  x.restore();
  return c;
}

const SNIPPET = `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;

export default function Favicon() {
  const [src, setSrc] = useState<{ file: File; bmp: ImageBitmap } | null>(null);
  const [o, setO] = useState<Opts>({
    fit: "contain",
    pad: 6,
    radius: 0,
    bg: "#ffffff",
    transparent: true,
  });
  const [name, setName] = useState("My site");
  const [saving, setSaving] = useState(false);
  const put = (p: Partial<Opts>) => setO((v) => ({ ...v, ...p }));

  async function open(files: File[]) {
    try {
      setSrc({ file: files[0]!, bmp: await decode(files[0]!) });
    } catch {
      toast(`${files[0]!.name} couldn't be opened.`);
    }
  }
  const { dragging, pickRef, pick, take } = useFiles({
    onFiles: (f) => void open(f),
  });

  const svg = src && /svg/i.test(src.file.type + src.file.name);
  const snippet = svg
    ? SNIPPET.replace(
        'sizes="48x48">',
        'sizes="48x48">\n<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
      )
    : SNIPPET;

  // Live previews at real sizes
  const previews = useMemo(
    () => (src ? [16, 32, 48, 180].map((s) => ({ s, url: "" })) : []),
    [src],
  );
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  const tabRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!src) return;
    previews.forEach(({ s }, i) => {
      const c = refs.current[i];
      if (!c) return;
      c.width = s;
      c.height = s;
      const x = c.getContext("2d")!;
      x.clearRect(0, 0, s, s);
      x.drawImage(paint(src.bmp, s, o, s === 180), 0, 0);
    });
    const t = tabRef.current;
    if (t) {
      t.width = 32;
      t.height = 32;
      t.getContext("2d")!.drawImage(paint(src.bmp, 32, o), 0, 0);
    }
  }, [src, o, previews]);

  async function save() {
    if (!src) return;
    setSaving(true);
    try {
      const files: { name: string; blob: Blob }[] = [];
      for (const p of PNGS)
        files.push({
          name: p.name,
          blob: await canvasBlob(paint(src.bmp, p.size, o, p.solid)),
        });
      files.push({
        name: "favicon.ico",
        blob: await ico(
          await Promise.all(
            ICO_SIZES.map(async (s) => ({
              size: s,
              blob: await canvasBlob(paint(src.bmp, s, o)),
            })),
          ),
        ),
      });
      if (svg) files.push({ name: "favicon.svg", blob: src.file });
      const manifest = {
        name,
        short_name: name.slice(0, 12),
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
        theme_color: o.transparent ? "#ffffff" : o.bg,
        background_color: o.transparent ? "#ffffff" : o.bg,
        display: "standalone",
      };
      files.push({
        name: "site.webmanifest",
        blob: new Blob([JSON.stringify(manifest, null, 2)], {
          type: "application/manifest+json",
        }),
      });
      files.push({
        name: "favicon-snippet.html",
        blob: new Blob([snippet + "\n"], { type: "text/html" }),
      });
      await downloadZip(files, "favicons.zip");
    } finally {
      setSaving(false);
    }
  }

  const input = (
    <FileInput
      inputRef={pickRef}
      onFiles={take}
      multiple={false}
      accept="image/*,.svg"
    />
  );
  if (!src)
    return (
      <>
        <DropCard
          dragging={dragging}
          onPick={pick}
          title="Drop your logo"
          button="Choose a logo"
          formats={["SVG", "PNG", "JPG", "WebP"]}
        >
          <span className="muted small">
            A square logo, at least 512 × 512, works best.
          </span>
        </DropCard>
        {input}
      </>
    );

  return (
    <>
      <ToolCard
        dragging={dragging}
        stage={
          <>
            <div className="fav-preview">
              <div className="fav-tab">
                <canvas ref={tabRef} aria-hidden="true" />
                <span>{name || "My site"}</span>
                <Icon name="x" />
              </div>
              <div className="fav-sizes">
                {previews.map(({ s }, i) => (
                  <figure key={s}>
                    <canvas
                      ref={(el) => {
                        refs.current[i] = el;
                      }}
                      style={{
                        width: Math.min(s, 120),
                        height: Math.min(s, 120),
                      }}
                      className={s < 64 ? "pixel" : undefined}
                    />
                    <figcaption>{s} px</figcaption>
                  </figure>
                ))}
              </div>
            </div>
            <div className="filebar">
              <button type="button" className="fchip add" onClick={pick}>
                Use another logo
              </button>
            </div>
          </>
        }
        panel={
          <>
            <Seg<Opts["fit"]>
              label="Fit"
              options={[
                ["contain", "Whole logo"],
                ["cover", "Fill the square"],
              ]}
              value={o.fit}
              onPick={(v) => put({ fit: v })}
            />
            <Slider
              label="Padding"
              value={o.pad}
              max={30}
              unit="%"
              onChange={(v) => put({ pad: v })}
            />
            <Slider
              label="Rounded corners"
              value={o.radius}
              max={50}
              unit="%"
              onChange={(v) => put({ radius: v })}
            />
            <Seg<boolean>
              label="Background"
              options={[
                [true, "Transparent"],
                [false, "Colour"],
              ]}
              value={o.transparent}
              onPick={(v) => put({ transparent: v })}
            />
            {!o.transparent && (
              <ColorPick
                label="Colour"
                value={o.bg}
                onPick={(v) => put({ bg: v })}
              />
            )}
            <div className="ctl">
              <label htmlFor="fav-name">Site name (for the app manifest)</label>
              <input
                id="fav-name"
                className="num"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="ctl">
              <span className="lbl">
                Paste into your page's &lt;head&gt;
                <CopyBtn
                  text={snippet}
                  what="HTML copied"
                  className="linkbtn"
                />
              </span>
              <pre className="code">{snippet}</pre>
            </div>
            <div className="result">
              <small>
                favicon.ico (16, 32, 48), 5 PNGs, site.webmanifest
                {svg ? ", favicon.svg" : ""}
              </small>
              <div className="acts">
                <button
                  type="button"
                  className="btn acc"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  <Icon name="download" />
                  {saving ? "Preparing…" : "Download favicon pack"}
                </button>
              </div>
            </div>
          </>
        }
      />
      {input}
    </>
  );
}
