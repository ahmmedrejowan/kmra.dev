import { useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { downloadBlob, formatBytes } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import { Seg } from "./FxControls";
import {
  baseName,
  canvasBlob,
  DropCard,
  downloadZip,
  FileInput,
  ToolCard,
  useFiles,
} from "./kit";

/** Split an animated GIF into its frames. */
interface Frame {
  url: string;
  blob: Blob;
  delay: number;
}

interface Gif {
  file: File;
  w: number;
  h: number;
  frames: Frame[];
  canvases: OffscreenCanvas[];
}

const isGif = (f: File) => f.type === "image/gif" || /\.gif$/i.test(f.name);

/** Full frames, applying each frame's disposal the way browsers play the GIF */
async function decodeGif(file: File): Promise<Gif> {
  const { parseGIF, decompressFrames } = await import("gifuct-js");
  const gif = parseGIF(await file.arrayBuffer());
  const raw = decompressFrames(gif, true);
  const W = gif.lsd.width;
  const H = gif.lsd.height;
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext("2d")!;
  const patch = new OffscreenCanvas(1, 1);
  const pctx = patch.getContext("2d")!;
  const frames: Frame[] = [];
  const canvases: OffscreenCanvas[] = [];
  let restore: ImageData | null = null;
  for (const f of raw) {
    const { width, height, top, left } = f.dims;
    if (f.disposalType === 3) restore = ctx.getImageData(0, 0, W, H);
    patch.width = width;
    patch.height = height;
    pctx.putImageData(
      new ImageData(new Uint8ClampedArray(f.patch), width, height),
      0,
      0,
    );
    ctx.drawImage(patch, left, top);
    const snap = new OffscreenCanvas(W, H);
    snap.getContext("2d")!.drawImage(canvas, 0, 0);
    canvases.push(snap);
    const blob = await snap.convertToBlob({ type: "image/png" });
    frames.push({
      url: URL.createObjectURL(blob),
      blob,
      delay: (f.delay || 100) as number,
    });
    if (f.disposalType === 2) ctx.clearRect(left, top, width, height);
    else if (f.disposalType === 3 && restore) ctx.putImageData(restore, 0, 0);
  }
  return { file, w: W, h: H, frames, canvases };
}

export default function GifFrames() {
  const [gif, setGif] = useState<Gif | null>(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [type, setType] = useState("image/png");
  const [saving, setSaving] = useState(false);

  async function open(files: File[]) {
    setBusy(true);
    try {
      gif?.frames.forEach((f) => URL.revokeObjectURL(f.url));
      const g = await decodeGif(files[0]!);
      setGif(g);
      setSel(new Set(g.frames.map((_, i) => i)));
    } catch {
      toast("This GIF couldn't be read. It may be damaged.");
    } finally {
      setBusy(false);
    }
  }
  const { dragging, pickRef, pick, take } = useFiles({
    onFiles: (f) => void open(f),
    accept: isGif,
    reject: "That isn't a GIF. Drop an animated .gif file.",
  });

  async function out(i: number) {
    if (type === "image/png") return gif!.frames[i]!.blob;
    const c = new OffscreenCanvas(gif!.w, gif!.h);
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(gif!.canvases[i]!, 0, 0);
    return canvasBlob(c, "image/jpeg", 0.92);
  }

  async function saveZip() {
    setSaving(true);
    try {
      const ext = type === "image/png" ? "png" : "jpg";
      const base = baseName(gif!.file.name);
      const pad = String(gif!.frames.length).length;
      const files = [];
      for (const i of [...sel].sort((a, b) => a - b))
        files.push({
          name: `${base}-frame-${String(i + 1).padStart(pad, "0")}.${ext}`,
          blob: await out(i),
        });
      await downloadZip(files, `${base}-frames.zip`);
    } finally {
      setSaving(false);
    }
  }

  /** All selected frames side by side in one image (for CSS sprites) */
  async function saveSheet() {
    const list = [...sel].sort((a, b) => a - b);
    const per = Math.min(list.length, Math.max(1, Math.floor(8192 / gif!.w)));
    const rows = Math.ceil(list.length / per);
    const c = new OffscreenCanvas(per * gif!.w, rows * gif!.h);
    const x = c.getContext("2d")!;
    list.forEach((i, k) =>
      x.drawImage(
        gif!.canvases[i]!,
        (k % per) * gif!.w,
        Math.floor(k / per) * gif!.h,
      ),
    );
    downloadBlob(await canvasBlob(c), `${baseName(gif!.file.name)}-sprite.png`);
  }

  const input = (
    <FileInput
      inputRef={pickRef}
      onFiles={take}
      multiple={false}
      accept="image/gif"
    />
  );
  if (!gif)
    return (
      <>
        <DropCard
          dragging={dragging}
          onPick={pick}
          title={busy ? "Reading frames…" : "Drop a GIF here"}
          button="Choose a GIF"
          formats={["GIF"]}
        />
        {input}
      </>
    );

  const total = gif.frames.reduce((a, f) => a + f.delay, 0);
  const toggle = (i: number) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  return (
    <>
      <ToolCard
        dragging={dragging}
        stage={
          <>
            <div className="frames">
              {gif.frames.map((f, i) => (
                <button
                  key={f.url}
                  type="button"
                  className="frame"
                  aria-pressed={sel.has(i)}
                  onClick={() => toggle(i)}
                >
                  <img src={f.url} alt={`Frame ${i + 1}`} />
                  <span>
                    {i + 1}
                    <small>{f.delay} ms</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="filebar">
              <button type="button" className="fchip add" onClick={pick}>
                Use another GIF
              </button>
            </div>
          </>
        }
        panel={
          <>
            <dl className="kv">
              <div>
                <dt>Frames</dt>
                <dd>{gif.frames.length}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>
                  {gif.w} × {gif.h}, {formatBytes(gif.file.size)}
                </dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>{(total / 1000).toFixed(2)} s</dd>
              </div>
              <div>
                <dt>Frame rate</dt>
                <dd>
                  about {Math.round((gif.frames.length / total) * 1000)} fps
                </dd>
              </div>
            </dl>
            <div className="ctl">
              <span className="lbl">
                Selected <span>{sel.size}</span>
              </span>
              <div className="chips">
                <button
                  type="button"
                  onClick={() => setSel(new Set(gif.frames.map((_, i) => i)))}
                >
                  All
                </button>
                <button type="button" onClick={() => setSel(new Set())}>
                  None
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSel(
                      new Set(
                        gif.frames.map((_, i) => i).filter((i) => i % 2 === 0),
                      ),
                    )
                  }
                >
                  Every 2nd
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSel(
                      new Set(
                        gif.frames.map((_, i) => i).filter((i) => i % 5 === 0),
                      ),
                    )
                  }
                >
                  Every 5th
                </button>
              </div>
            </div>
            <Seg<string>
              label="Save frames as"
              options={[
                ["image/png", "PNG"],
                ["image/jpeg", "JPEG"],
              ]}
              value={type}
              onPick={setType}
            />
            <div className="result">
              <small>
                Click frames on the left to pick which ones to save.
              </small>
              <div className="acts">
                <button
                  type="button"
                  className="btn acc"
                  disabled={!sel.size || saving}
                  onClick={() => void saveZip()}
                >
                  <Icon name="download" />
                  {saving ? "Preparing…" : `Download ${sel.size} frames as zip`}
                </button>
                <button
                  type="button"
                  className="btn sm"
                  disabled={!sel.size}
                  onClick={() => void saveSheet()}
                >
                  Sprite sheet (one PNG)
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
