import { useEffect, useState } from "react";
import { Dropzone } from "@kmra/ui/components/Dropzone";
import { takeFiles } from "@kmra/ui/lib/handoff";
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

  // Pick up an image dropped on the landing page.
  useEffect(() => {
    void takeFiles().then(([f]) => f && load(f));
  }, []);

  async function load(f: File) {
    setError(null);
    try {
      const bmp = await decodeImage(f);
      setFile(f);
      setBitmap(bmp);
      setWidth(bmp.width);
      setHeight(bmp.height);
    } catch {
      setError(`${f.name} couldn't be opened. Try a JPEG, PNG, WebP or GIF.`);
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
      setError(
        "Resizing failed. The image may be too large for this device's memory. Try a smaller size.",
      );
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
        {error && (
          <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="truncate font-medium">{file.name}</span>
        <span className="text-muted">
          {bitmap.width} × {bitmap.height}, {formatBytes(file.size)}
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
            className="rounded-md border border-line px-3 py-1 text-sm hover:border-ink"
          >
            {pct}%
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-md bg-marker px-4 py-2 font-semibold text-[#16201c] hover:brightness-95 disabled:opacity-50"
        >
          {busy ? "Resizing…" : "Resize & download"}
        </button>
        <button
          type="button"
          onClick={() => {
            setFile(null);
            setBitmap(null);
          }}
          className="rounded-md border border-line px-4 py-2"
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
        className="w-32 rounded-md border border-line bg-paper px-3 py-2"
      />
    </label>
  );
}
