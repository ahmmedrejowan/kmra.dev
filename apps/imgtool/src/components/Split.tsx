import { useMemo, useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { downloadBlob } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import { Seg } from "./FxControls";
import {
  baseName,
  canvasBlob,
  decode,
  DropCard,
  downloadZip,
  FileInput,
  ToolCard,
  useFiles,
} from "@kmra/ui/components/kit";

/** Cut one image into a grid of tiles (Instagram grids and carousels, print tiles). */
const PRESETS: {
  id: string;
  label: string;
  rows: number;
  cols: number;
  square?: boolean;
}[] = [
  { id: "carousel", label: "Carousel 1 × 3", rows: 1, cols: 3 },
  {
    id: "ig-grid",
    label: "Instagram grid 3 × 3",
    rows: 3,
    cols: 3,
    square: true,
  },
  { id: "2x2", label: "2 × 2", rows: 2, cols: 2 },
  { id: "1x2", label: "Halves 1 × 2", rows: 1, cols: 2 },
  { id: "2x1", label: "Top / bottom 2 × 1", rows: 2, cols: 1 },
];

interface Pic {
  file: File;
  url: string;
  bmp: ImageBitmap;
}

export default function Split() {
  const [pic, setPic] = useState<Pic | null>(null);
  const [rows, setRows] = useState(1);
  const [cols, setCols] = useState(3);
  const [square, setSquare] = useState(false);
  const [type, setType] = useState("image/jpeg");
  const [order, setOrder] = useState<"read" | "post">("read");
  const [saving, setSaving] = useState(false);

  async function open(files: File[]) {
    try {
      const bmp = await decode(files[0]!);
      if (pic) URL.revokeObjectURL(pic.url);
      setPic({ file: files[0]!, url: URL.createObjectURL(files[0]!), bmp });
    } catch {
      toast(`${files[0]!.name} couldn't be opened.`);
    }
  }
  const { dragging, pickRef, pick, take } = useFiles({
    onFiles: (f) => void open(f),
  });

  /** Area of the image that gets cut: centred and cropped to square tiles when asked */
  const area = useMemo(() => {
    if (!pic) return { x: 0, y: 0, w: 1, h: 1 };
    const { width: W, height: H } = pic.bmp;
    if (!square) return { x: 0, y: 0, w: W, h: H };
    const want = cols / rows;
    if (W / H > want) {
      const w = Math.round(H * want);
      return { x: Math.round((W - w) / 2), y: 0, w, h: H };
    }
    const h = Math.round(W / want);
    return { x: 0, y: Math.round((H - h) / 2), w: W, h };
  }, [pic, rows, cols, square]);

  const tileW = Math.floor(area.w / cols);
  const tileH = Math.floor(area.h / rows);

  async function tiles() {
    const out: { name: string; blob: Blob }[] = [];
    const ext = type === "image/png" ? "png" : "jpg";
    const base = baseName(pic!.file.name);
    const total = rows * cols;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const cv = new OffscreenCanvas(tileW, tileH);
        const x = cv.getContext("2d")!;
        if (type === "image/jpeg") {
          x.fillStyle = "#fff";
          x.fillRect(0, 0, tileW, tileH);
        }
        x.drawImage(
          pic!.bmp,
          area.x + c * tileW,
          area.y + r * tileH,
          tileW,
          tileH,
          0,
          0,
          tileW,
          tileH,
        );
        const n = r * cols + c + 1;
        // Instagram shows the newest post first, so posting order is the reverse of reading order
        const num = order === "post" ? total - n + 1 : n;
        out.push({
          name: `${base}-${String(num).padStart(2, "0")}.${ext}`,
          blob: await canvasBlob(cv, type, 0.92),
        });
      }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function save(asZip: boolean) {
    setSaving(true);
    try {
      const files = await tiles();
      if (asZip)
        await downloadZip(files, `${baseName(pic!.file.name)}-tiles.zip`);
      else
        for (const f of files) {
          downloadBlob(f.blob, f.name);
          await new Promise((r) => setTimeout(r, 300));
        }
    } finally {
      setSaving(false);
    }
  }

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

  const preset = PRESETS.find(
    (p) => p.rows === rows && p.cols === cols && !!p.square === square,
  );
  const { width: W, height: H } = pic.bmp;
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <>
      <ToolCard
        dragging={dragging}
        stage={
          <>
            <div className="splitview">
              <img src={pic.url} alt={pic.file.name} />
              {/* Dim what gets cropped away, then draw the cut lines */}
              <div
                className="split-area"
                style={{
                  left: pct(area.x, W),
                  top: pct(area.y, H),
                  width: pct(tileW * cols, W),
                  height: pct(tileH * rows, H),
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                }}
              >
                {Array.from({ length: rows * cols }, (_, i) => (
                  <span key={i}>
                    {order === "post" ? rows * cols - i : i + 1}
                  </span>
                ))}
              </div>
            </div>
            <div className="filebar">
              <button type="button" className="fchip add" onClick={pick}>
                Use another image
              </button>
            </div>
          </>
        }
        panel={
          <>
            <div className="ctl">
              <span className="lbl">Presets</span>
              <div className="chips">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={preset?.id === p.id}
                    onClick={() => {
                      setRows(p.rows);
                      setCols(p.cols);
                      setSquare(!!p.square);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ctl">
              <span className="lbl">Rows and columns</span>
              <div className="row2">
                <input
                  className="num"
                  type="number"
                  min={1}
                  max={12}
                  value={rows}
                  onChange={(e) =>
                    setRows(Math.min(12, Math.max(1, +e.target.value || 1)))
                  }
                  aria-label="Rows"
                />
                <span className="muted">×</span>
                <input
                  className="num"
                  type="number"
                  min={1}
                  max={12}
                  value={cols}
                  onChange={(e) =>
                    setCols(Math.min(12, Math.max(1, +e.target.value || 1)))
                  }
                  aria-label="Columns"
                />
              </div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={square}
                onChange={(e) => setSquare(e.target.checked)}
              />
              <span>Square tiles (crops the edges evenly)</span>
            </label>
            <Seg<"read" | "post">
              label="Numbering"
              options={[
                ["read", "Reading order"],
                ["post", "Posting order"],
              ]}
              value={order}
              onPick={setOrder}
            />
            <Seg<string>
              label="Save as"
              options={[
                ["image/jpeg", "JPEG"],
                ["image/png", "PNG"],
              ]}
              value={type}
              onPick={setType}
            />
            <div className="result">
              <small>
                {rows * cols} tiles of {tileW} × {tileH}
              </small>
              <div className="acts">
                <button
                  type="button"
                  className="btn acc"
                  disabled={saving}
                  onClick={() => void save(true)}
                >
                  <Icon name="download" />
                  {saving
                    ? "Preparing…"
                    : `Download ${rows * cols} tiles as zip`}
                </button>
                <button
                  type="button"
                  className="btn sm"
                  disabled={saving}
                  onClick={() => void save(false)}
                >
                  Save each separately
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
