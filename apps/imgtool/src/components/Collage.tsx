import { LangProvider, useT } from "@kmra/ui/lib/i18n-react";
import type { Locale } from "@kmra/ui/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { downloadBlob } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import { Colors as ColorPick, Seg, Slider } from "./FxControls";
import {
  canvasBlob,
  decode,
  DropCard,
  FileInput,
  ToolCard,
  useFiles,
} from "@kmra/ui/components/kit";

/** Photo collage: pick a layout, shape, spacing and background. */
interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Pic {
  key: string;
  name: string;
  url: string;
  bmp: ImageBitmap;
}

const MAX = 12;
const SHAPES: { id: string; label: string; r: number }[] = [
  { id: "1:1", label: "Square", r: 1 },
  { id: "4:5", label: "Portrait 4:5", r: 4 / 5 },
  { id: "9:16", label: "Story 9:16", r: 9 / 16 },
  { id: "3:2", label: "Landscape 3:2", r: 3 / 2 },
  { id: "16:9", label: "Wide 16:9", r: 16 / 9 },
];
const SIZES = [1080, 2048, 4096];

/** Rows of cells, with `perRow` items in each row */
function rows(perRow: number[]): Cell[] {
  const out: Cell[] = [];
  const h = 1 / perRow.length;
  perRow.forEach((n, r) => {
    for (let i = 0; i < n; i++) out.push({ x: i / n, y: r * h, w: 1 / n, h });
  });
  return out;
}
const cols = (perCol: number[]) =>
  rows(perCol).map((c) => ({ x: c.y, y: c.x, w: c.h, h: c.w }));

function layouts(n: number): { id: string; label: string; cells: Cell[] }[] {
  if (n <= 1) return [{ id: "single", label: "Single", cells: rows([1]) }];
  const gridCols = Math.ceil(Math.sqrt(n));
  const full = Math.floor(n / gridCols);
  const rest = n % gridCols;
  const grid = [...Array(full).fill(gridCols), ...(rest ? [rest] : [])];
  const list = [
    { id: "grid", label: "Grid", cells: rows(grid) },
    { id: "rows", label: "Stacked", cells: rows(Array(n).fill(1)) },
    { id: "cols", label: "Side by side", cells: cols(Array(n).fill(1)) },
  ];
  if (n >= 3) {
    const others = n - 1;
    list.push({
      id: "feature-left",
      label: "Big left",
      cells: [
        { x: 0, y: 0, w: 0.6, h: 1 },
        ...Array.from({ length: others }, (_, i) => ({
          x: 0.6,
          y: i / others,
          w: 0.4,
          h: 1 / others,
        })),
      ],
    });
    list.push({
      id: "feature-top",
      label: "Big top",
      cells: [
        { x: 0, y: 0, w: 1, h: 0.62 },
        ...Array.from({ length: others }, (_, i) => ({
          x: i / others,
          y: 0.62,
          w: 1 / others,
          h: 0.38,
        })),
      ],
    });
  }
  if (n === 4 || n === 6 || n === 9)
    list.push({ id: "mosaic", label: "Mosaic", cells: mosaic(n) });
  return list;
}

/** Brick-like rows that alternate widths */
function mosaic(n: number): Cell[] {
  const perRow = n === 4 ? [2, 2] : n === 6 ? [2, 2, 2] : [3, 3, 3];
  const h = 1 / perRow.length;
  const out: Cell[] = [];
  perRow.forEach((k, r) => {
    const big = r % 2 === 0 ? 0 : k - 1;
    const bw = k === 2 ? 0.62 : 0.46;
    const sw = (1 - bw) / (k - 1);
    let x = 0;
    for (let i = 0; i < k; i++) {
      const w = i === big ? bw : sw;
      out.push({ x, y: r * h, w, h });
      x += w;
    }
  });
  return out;
}

function draw(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  W: number,
  H: number,
  pics: Pic[],
  cells: Cell[],
  o: { gap: number; radius: number; bg: string; selected?: number },
) {
  const m = Math.min(W, H);
  const gap = (m * o.gap) / 100;
  const radius = (m * o.radius) / 100;
  ctx.fillStyle = o.bg;
  ctx.fillRect(0, 0, W, H);
  cells.forEach((c, i) => {
    const pic = pics[i];
    if (!pic) return;
    // Outer edges get a full gap, inner edges half each so all gaps match
    const x = c.x * W + (c.x === 0 ? gap : gap / 2);
    const y = c.y * H + (c.y === 0 ? gap : gap / 2);
    const right = c.x + c.w >= 0.999 ? gap : gap / 2;
    const bottom = c.y + c.h >= 0.999 ? gap : gap / 2;
    const w = Math.max(1, c.w * W - (x - c.x * W) - right);
    const h = Math.max(1, c.h * H - (y - c.y * H) - bottom);
    const b = pic.bmp;
    const scale = Math.max(w / b.width, h / b.height);
    const sw = w / scale;
    const sh = h / scale;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();
    ctx.drawImage(
      b,
      (b.width - sw) / 2,
      (b.height - sh) / 2,
      sw,
      sh,
      x,
      y,
      w,
      h,
    );
    ctx.restore();
    if (o.selected === i) {
      ctx.save();
      ctx.lineWidth = Math.max(3, m * 0.008);
      ctx.strokeStyle = "#0057ff";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.stroke();
      ctx.restore();
    }
  });
}

function CollageView() {
  const T = useT();
  const [pics, setPics] = useState<Pic[]>([]);
  const [layout, setLayout] = useState("grid");
  const [shape, setShape] = useState("1:1");
  const [size, setSize] = useState(2048);
  const [gap, setGap] = useState(1.5);
  const [radius, setRadius] = useState(0);
  const [bg, setBg] = useState("#ffffff");
  const [type, setType] = useState("image/jpeg");
  const [sel, setSel] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);

  async function add(files: File[]) {
    const room = MAX - pics.length;
    if (files.length > room)
      toast(
        T("A collage holds up to {max} photos. Added the first {n}.", {
          max: MAX,
          n: room,
        }),
      );
    const out: Pic[] = [];
    for (const f of files.slice(0, room)) {
      try {
        out.push({
          key: crypto.randomUUID(),
          name: f.name,
          url: URL.createObjectURL(f),
          bmp: await decode(f),
        });
      } catch {
        toast(T("{name} couldn't be opened.", { name: f.name }));
      }
    }
    setPics((p) => [...p, ...out]);
  }

  const { dragging, pickRef, pick, take } = useFiles({
    onFiles: (f) => void add(f),
  });
  const options = useMemo(() => layouts(pics.length), [pics.length]);
  const current = options.find((l) => l.id === layout) ?? options[0]!;
  const r = SHAPES.find((s) => s.id === shape)!.r;
  const [W, H] =
    r >= 1 ? [size, Math.round(size / r)] : [Math.round(size * r), size];

  useEffect(() => {
    const c = ref.current;
    if (!c || !pics.length) return;
    const scale = Math.min(1, 900 / Math.max(W, H));
    c.width = Math.round(W * scale);
    c.height = Math.round(H * scale);
    draw(c.getContext("2d")!, c.width, c.height, pics, current.cells, {
      gap,
      radius,
      bg,
      selected: sel ?? undefined,
    });
  }, [pics, current, W, H, gap, radius, bg, sel]);

  // Click one photo, then another, to swap them
  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const i = current.cells.findIndex(
      (c) => fx >= c.x && fx <= c.x + c.w && fy >= c.y && fy <= c.y + c.h,
    );
    if (i < 0 || i >= pics.length) return;
    if (sel === null || sel === i) {
      setSel(sel === i ? null : i);
      return;
    }
    setPics((p) => {
      const next = p.slice();
      [next[sel], next[i]] = [next[i]!, next[sel]!];
      return next;
    });
    setSel(null);
  }

  async function save() {
    setSaving(true);
    try {
      const c = new OffscreenCanvas(W, H);
      draw(c.getContext("2d")!, W, H, pics, current.cells, { gap, radius, bg });
      const blob = await canvasBlob(c, type, 0.92);
      downloadBlob(
        blob,
        `collage.${type === "image/png" ? "png" : "jpg"}`,
      );
    } finally {
      setSaving(false);
    }
  }

  const input = <FileInput inputRef={pickRef} onFiles={take} />;
  if (!pics.length)
    return (
      <>
        <DropCard
          dragging={dragging}
          onPick={pick}
          title={T("Drop 2 to 12 photos")}
          button={T("Choose photos")}
        />
        {input}
      </>
    );

  return (
    <>
      <ToolCard
        dragging={dragging}
        stage={
          <>
            <canvas
              ref={ref}
              className="still collage-canvas"
              onClick={onCanvasClick}
              aria-label={T("Collage preview. Click two photos to swap them.")}
            />
            <div className="filebar">
              {pics.map((p, i) => (
                <span key={p.key} className="fchip-wrap">
                  <button
                    type="button"
                    className="fchip"
                    aria-pressed={sel === i}
                    onClick={() => setSel(sel === i ? null : i)}
                  >
                    <img src={p.url} alt="" />
                    <span>{p.name}</span>
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    aria-label={T("Remove {name}", { name: p.name })}
                    onClick={() => {
                      setPics((list) => list.filter((x) => x.key !== p.key));
                      setSel(null);
                    }}
                  >
                    <Icon name="x" />
                  </button>
                </span>
              ))}
              {pics.length < MAX && (
                <button type="button" className="fchip add" onClick={pick}>
                  {T("+ Add")}
                </button>
              )}
            </div>
          </>
        }
        panel={
          <>
            <div className="ctl">
              <span className="lbl">{T("Layout")}</span>
              <div className="chips">
                {options.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={current.id === l.id}
                    onClick={() => setLayout(l.id)}
                  >
                    {T(l.label)}
                  </button>
                ))}
              </div>
              <small
                className="muted"
                style={{ display: "block", marginTop: 8 }}
              >
                {T("Click two photos in the preview to swap them.")}
              </small>
            </div>
            <div className="ctl">
              <span className="lbl">{T("Shape")}</span>
              <div className="chips">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={shape === s.id}
                    onClick={() => setShape(s.id)}
                  >
                    {T(s.label)}
                  </button>
                ))}
              </div>
            </div>
            <Slider
              label={T("Spacing")}
              value={gap}
              max={8}
              step={0.25}
              unit="%"
              onChange={setGap}
            />
            <Slider
              label={T("Rounded corners")}
              value={radius}
              max={10}
              step={0.25}
              unit="%"
              onChange={setRadius}
            />
            <ColorPick label={T("Background")} value={bg} onPick={setBg} />
            <Seg<number>
              label={T("Size (long side)")}
              options={SIZES.map((v) => [v, `${v}`] as [number, string])}
              value={size}
              onPick={setSize}
            />
            <Seg<string>
              label={T("Save as")}
              options={[
                ["image/jpeg", T("JPEG")],
                ["image/png", T("PNG")],
              ]}
              value={type}
              onPick={setType}
            />
            <div className="result">
              <small>
                {W} × {H}, {pics.length} photo{pics.length > 1 ? "s" : ""}
              </small>
              <div className="acts">
                <button
                  type="button"
                  className="btn acc"
                  disabled={saving || pics.length < 1}
                  onClick={() => void save()}
                >
                  <Icon name="download" />
                  {saving ? T("Preparing…") : T("Download collage")}
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

/** Island entry: sets the interface language for everything inside. */
export default function Collage(props: { lang?: Locale }) {
  return (
    <LangProvider lang={props.lang}>
      <CollageView />
    </LangProvider>
  );
}
