import { useEffect, useState } from "react";
import { Dropzone } from "@kmra/ui/components/Dropzone";
import {
  decodeImage,
  encodeImage,
  FORMAT_EXT,
  type ImageFormat,
} from "@kmra/ui/lib/image";
import {
  downloadBlob,
  formatBytes,
  replaceExtension,
} from "@kmra/ui/lib/files";

const OUTPUT_TYPES: ImageFormat[] = ["image/jpeg", "image/png", "image/webp"];

export default function Resize() {
  const [file, setFile] = useState<File | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [lockRatio, setLockRatio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => bitmap?.close(), [bitmap]);

  async function load(f: File) {
    setError(null);
    try {
      const bmp = await decodeImage(f);
      setFile(f);
      setBitmap(bmp);
      setWidth(bmp.width);
      setHeight(bmp.height);
    } catch {
      setError("Couldn't read that image.");
    }
  }

  function changeWidth(w: number) {
    setWidth(w);
    if (lockRatio && bitmap)
      setHeight(Math.max(1, Math.round((w * bitmap.height) / bitmap.width)));
  }

  function changeHeight(h: number) {
    setHeight(h);
    if (lockRatio && bitmap)
      setWidth(Math.max(1, Math.round((h * bitmap.width) / bitmap.height)));
  }

  function scale(pct: number) {
    if (!bitmap) return;
    setWidth(Math.max(1, Math.round((bitmap.width * pct) / 100)));
    setHeight(Math.max(1, Math.round((bitmap.height * pct) / 100)));
  }

  async function run() {
    if (!file || !bitmap || width < 1 || height < 1) return;
    setBusy(true);
    try {
      const type = OUTPUT_TYPES.includes(file.type as ImageFormat)
        ? (file.type as ImageFormat)
        : "image/png";
      const blob = await encodeImage(bitmap, {
        width,
        height,
        type,
        quality: 0.92,
      });
      downloadBlob(
        blob,
        replaceExtension(file.name, `${width}x${height}.${FORMAT_EXT[type]}`),
      );
    } catch {
      setError("Resizing failed. The image may be too large for this device.");
    } finally {
      setBusy(false);
    }
  }

  if (!file || !bitmap) {
    return (
      <div>
        <Dropzone
          accept="image/*"
          label="Drop an image or click to choose"
          onFiles={([f]) => f && load(f)}
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="truncate font-medium">{file.name}</span>
        <span className="text-muted">
          {bitmap.width} × {bitmap.height} · {formatBytes(file.size)}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <NumberField label="Width" value={width} onChange={changeWidth} />
        <NumberField label="Height" value={height} onChange={changeHeight} />
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={lockRatio}
            onChange={(e) => setLockRatio(e.target.checked)}
          />
          Keep aspect ratio
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {[25, 50, 75, 150, 200].map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => scale(pct)}
            className="rounded-md border border-border px-3 py-1 text-sm hover:border-accent"
          >
            {pct}%
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-50"
        >
          {busy ? "Resizing…" : "Resize & download"}
        </button>
        <button
          type="button"
          onClick={() => {
            setFile(null);
            setBitmap(null);
          }}
          className="rounded-md border border-border px-4 py-2"
        >
          Choose another
        </button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label} (px)</span>
      <input
        type="number"
        min={1}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 rounded-md border border-border bg-bg px-3 py-2"
      />
    </label>
  );
}
