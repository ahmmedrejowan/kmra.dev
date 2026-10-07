import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { downloadBlob } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import {
  baseName,
  canvasBlob,
  copyText,
  CopyBtn,
  decode,
  DropCard,
  FileInput,
  ToolCard,
  useFiles,
} from "./kit";

/** Colour palette extractor and colour picker. */
type Mode = "palette" | "picker";
type RGB = [number, number, number];

const hex = ([r, g, b]: RGB) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

function hsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h =
      max === r
        ? (g - b) / d + (g < b ? 6 : 0)
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function cmyk([r, g, b]: RGB): number[] {
  const k = 1 - Math.max(r, g, b) / 255;
  if (k >= 1) return [0, 0, 0, 100];
  return [
    (1 - r / 255 - k) / (1 - k),
    (1 - g / 255 - k) / (1 - k),
    (1 - b / 255 - k) / (1 - k),
    k,
  ].map((v) => Math.round(v * 100));
}

const formats = (c: RGB): [string, string][] => {
  const [h, s, l] = hsl(c);
  const [cc, m, y, k] = cmyk(c);
  return [
    ["HEX", hex(c)],
    ["RGB", `rgb(${c.map(Math.round).join(", ")})`],
    ["HSL", `hsl(${h}, ${s}%, ${l}%)`],
    ["CMYK", `${cc}, ${m}, ${y}, ${k}`],
  ];
};

const lum = ([r, g, b]: RGB) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Seeded k-means++ on a small copy of the image. Same image, same palette. */
function palette(
  px: Uint8ClampedArray,
  k: number,
): { c: RGB; share: number }[] {
  const pts: RGB[] = [];
  for (let i = 0; i < px.length; i += 4)
    if (px[i + 3]! > 200) pts.push([px[i]!, px[i + 1]!, px[i + 2]!]);
  if (!pts.length) return [];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const d2 = (a: RGB, b: RGB) =>
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const centers: RGB[] = [pts[Math.floor(rand() * pts.length)]!];
  while (centers.length < k) {
    const dist = pts.map((p) => Math.min(...centers.map((c) => d2(p, c))));
    const sum = dist.reduce((a, v) => a + v, 0);
    if (!sum) break;
    let t = rand() * sum;
    let i = 0;
    while ((t -= dist[i]!) > 0 && i < pts.length - 1) i++;
    centers.push([...pts[i]!] as RGB);
  }
  const owner = new Int32Array(pts.length);
  for (let iter = 0; iter < 12; iter++) {
    const sums = centers.map(
      () => [0, 0, 0, 0] as [number, number, number, number],
    );
    pts.forEach((p, i) => {
      let best = 0;
      let bd = Infinity;
      centers.forEach((c, j) => {
        const d = d2(p, c);
        if (d < bd) {
          bd = d;
          best = j;
        }
      });
      owner[i] = best;
      const s = sums[best]!;
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    });
    sums.forEach((s, j) => {
      if (s[3]) centers[j] = [s[0]! / s[3], s[1]! / s[3], s[2]! / s[3]];
    });
  }
  const counts = centers.map(() => 0);
  owner.forEach((o) => counts[o]!++);
  return centers
    .map((c, i) => ({
      c: c.map(Math.round) as RGB,
      share: counts[i]! / pts.length,
    }))
    .filter((x) => x.share > 0.002)
    .sort((a, b) => b.share - a.share);
}

interface Pic {
  file: File;
  url: string;
  bmp: ImageBitmap;
  /** Full-size pixels for the picker, small copy for the palette */
  full: OffscreenCanvasRenderingContext2D;
  small: Uint8ClampedArray;
}

export default function Colors({ mode }: { mode: Mode }) {
  const [pic, setPic] = useState<Pic | null>(null);
  const [count, setCount] = useState(6);

  async function open(files: File[]) {
    const file = files[0]!;
    try {
      const bmp = await decode(file);
      const scale = Math.min(1, 4096 / Math.max(bmp.width, bmp.height));
      const fc = new OffscreenCanvas(
        Math.round(bmp.width * scale),
        Math.round(bmp.height * scale),
      );
      const full = fc.getContext("2d", { willReadFrequently: true })!;
      full.drawImage(bmp, 0, 0, fc.width, fc.height);
      const ss = Math.min(1, 160 / Math.max(bmp.width, bmp.height));
      const sc = new OffscreenCanvas(
        Math.max(1, Math.round(bmp.width * ss)),
        Math.max(1, Math.round(bmp.height * ss)),
      );
      const sx = sc.getContext("2d")!;
      sx.drawImage(bmp, 0, 0, sc.width, sc.height);
      if (pic) URL.revokeObjectURL(pic.url);
      setPic({
        file,
        url: URL.createObjectURL(file),
        bmp,
        full,
        small: sx.getImageData(0, 0, sc.width, sc.height).data,
      });
    } catch {
      toast(`${file.name} couldn't be opened. Try a JPEG, PNG or WebP.`);
    }
  }

  const { dragging, pickRef, pick, take } = useFiles({
    onFiles: (f) => void open(f),
  });
  const input = (
    <FileInput inputRef={pickRef} onFiles={take} multiple={false} />
  );

  if (!pic)
    return (
      <>
        <DropCard
          dragging={dragging}
          onPick={pick}
          title="Drop an image here"
          button="Choose an image"
        />
        {input}
      </>
    );

  return (
    <>
      {mode === "palette" ? (
        <PaletteView
          pic={pic}
          count={count}
          setCount={setCount}
          onPick={pick}
          dragging={dragging}
        />
      ) : (
        <PickerView pic={pic} onPick={pick} dragging={dragging} />
      )}
      {input}
    </>
  );
}

function Swatch({ c, share }: { c: RGB; share?: number }) {
  const h = hex(c);
  return (
    <button
      type="button"
      className="swatch"
      style={{ background: h, color: lum(c) > 150 ? "#111" : "#fff" }}
      onClick={() => void copyText(h, `${h} copied`)}
      title="Copy"
    >
      <b>{h}</b>
      {share !== undefined && <small>{Math.round(share * 100)}%</small>}
    </button>
  );
}

function PaletteView({
  pic,
  count,
  setCount,
  onPick,
  dragging,
}: {
  pic: Pic;
  count: number;
  setCount: (n: number) => void;
  onPick: () => void;
  dragging: boolean;
}) {
  const colors = useMemo(() => palette(pic.small, count), [pic, count]);
  const hexes = colors.map((x) => hex(x.c));
  const css = `:root {\n${hexes.map((h, i) => `  --color-${i + 1}: ${h};`).join("\n")}\n}`;
  async function png() {
    const W = 1200;
    const H = 300;
    const c = new OffscreenCanvas(W, H);
    const x = c.getContext("2d")!;
    let at = 0;
    colors.forEach((col, i) => {
      const w =
        i === colors.length - 1 ? W - at : Math.round(W / colors.length);
      x.fillStyle = hex(col.c);
      x.fillRect(at, 0, w, H);
      x.fillStyle = lum(col.c) > 150 ? "#111" : "#fff";
      x.font = "600 22px system-ui, sans-serif";
      x.fillText(hex(col.c), at + 16, H - 22);
      at += w;
    });
    downloadBlob(await canvasBlob(c), `${baseName(pic.file.name)}-palette.png`);
  }
  return (
    <ToolCard
      dragging={dragging}
      stage={
        <>
          <img className="still" src={pic.url} alt={pic.file.name} />
          <div className="filebar">
            <button type="button" className="fchip add" onClick={onPick}>
              Use another image
            </button>
          </div>
        </>
      }
      panel={
        <div className="panel-stack">
          <div className="ctl">
            <label>
              Colours <span>{count}</span>
            </label>
            <input
              type="range"
              min={3}
              max={12}
              value={count}
              onChange={(e) => setCount(+e.target.value)}
              aria-label="Number of colours"
            />
          </div>
          <div className="palette">
            {colors.map((x) => (
              <Swatch key={hex(x.c)} c={x.c} share={x.share} />
            ))}
          </div>
          <small className="muted">
            Click a colour to copy it. Sorted by how much of the image it
            covers.
          </small>
          <div className="acts-row">
            <CopyBtn
              text={hexes.join(", ")}
              label="HEX list"
              what="Colours copied"
            />
            <CopyBtn text={css} label="CSS" what="CSS variables copied" />
            <CopyBtn
              text={JSON.stringify(hexes)}
              label="JSON"
              what="JSON copied"
            />
            <button type="button" className="btn sm" onClick={() => void png()}>
              <Icon name="download" />
              PNG
            </button>
          </div>
        </div>
      }
    />
  );
}

function PickerView({
  pic,
  onPick,
  dragging,
}: {
  pic: Pic;
  onPick: () => void;
  dragging: boolean;
}) {
  const [hover, setHover] = useState<{ c: RGB; x: number; y: number } | null>(
    null,
  );
  const [picked, setPicked] = useState<RGB[]>([]);
  const [current, setCurrent] = useState<RGB | null>(null);
  const loupe = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const W = pic.full.canvas.width;
  const H = pic.full.canvas.height;

  function at(e: PointerEvent): {
    c: RGB;
    x: number;
    y: number;
    px: number;
    py: number;
  } {
    const r = imgRef.current!.getBoundingClientRect();
    const px = Math.min(
      W - 1,
      Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * W)),
    );
    const py = Math.min(
      H - 1,
      Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * H)),
    );
    const d = pic.full.getImageData(px, py, 1, 1).data;
    return {
      c: [d[0]!, d[1]!, d[2]!],
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      px,
      py,
    };
  }

  function move(e: PointerEvent) {
    const p = at(e);
    setHover({ c: p.c, x: p.x, y: p.y });
    const l = loupe.current;
    if (!l) return;
    const x = l.getContext("2d")!;
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, l.width, l.height);
    const n = 11;
    x.drawImage(
      pic.full.canvas,
      p.px - 5,
      p.py - 5,
      n,
      n,
      0,
      0,
      l.width,
      l.height,
    );
    const cell = l.width / n;
    x.strokeStyle = lum(p.c) > 150 ? "#000" : "#fff";
    x.lineWidth = 2;
    x.strokeRect(cell * 5, cell * 5, cell, cell);
  }

  function choose(e: PointerEvent) {
    const p = at(e);
    setCurrent(p.c);
    setPicked((list) =>
      [p.c, ...list.filter((c) => hex(c) !== hex(p.c))].slice(0, 12),
    );
  }

  // Pick from anywhere on screen where the browser supports it (Chrome, Edge)
  const [canDrop, setCanDrop] = useState(false);
  useEffect(() => setCanDrop("EyeDropper" in window), []);
  async function screenPick() {
    try {
      const ED = (
        window as unknown as {
          EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> };
        }
      ).EyeDropper;
      const { sRGBHex } = await new ED().open();
      const c = [1, 3, 5].map((i) =>
        parseInt(sRGBHex.slice(i, i + 2), 16),
      ) as RGB;
      setCurrent(c);
      setPicked((list) => [c, ...list].slice(0, 12));
    } catch {
      /* cancelled */
    }
  }

  const show = hover?.c ?? current;
  return (
    <ToolCard
      dragging={dragging}
      stage={
        <>
          <div
            className="picker"
            onPointerMove={move}
            onPointerLeave={() => setHover(null)}
            onPointerDown={choose}
          >
            <img
              ref={imgRef}
              src={pic.url}
              alt={pic.file.name}
              draggable={false}
            />
            {hover && (
              <canvas
                ref={loupe}
                className="loupe"
                width={110}
                height={110}
                style={{ left: hover.x + 18, top: hover.y + 18 }}
              />
            )}
          </div>
          <div className="filebar">
            <button type="button" className="fchip add" onClick={onPick}>
              Use another image
            </button>
          </div>
        </>
      }
      panel={
        <div className="panel-stack">
          <div className="pick-now">
            <i style={{ background: show ? hex(show) : "transparent" }} />
            <span className="muted">
              {hover
                ? "Click to keep this colour"
                : current
                  ? "Picked"
                  : "Move over the image, click to pick"}
            </span>
          </div>
          {show && (
            <dl className="kv">
              {formats(show).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>
                    <button
                      type="button"
                      className="linkbtn mono"
                      onClick={() => void copyText(v, `${v} copied`)}
                    >
                      {v}
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {canDrop && (
            <button
              type="button"
              className="btn sm"
              onClick={() => void screenPick()}
            >
              <Icon name="pipette" />
              Pick from anywhere on screen
            </button>
          )}
          {picked.length > 0 && (
            <div className="ctl">
              <span className="lbl">
                Kept <span>{picked.length}</span>
              </span>
              <div className="palette sm">
                {picked.map((c) => (
                  <Swatch key={hex(c)} c={c} />
                ))}
              </div>
              <div className="acts-row">
                <CopyBtn
                  text={picked.map(hex).join(", ")}
                  label="Copy all"
                  what="Colours copied"
                />
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setPicked([])}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}
