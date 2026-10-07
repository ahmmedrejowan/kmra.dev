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

const FORMATS: { type: ImageFormat; label: string }[] = [
  { type: "image/jpeg", label: "JPEG" },
  { type: "image/png", label: "PNG" },
  { type: "image/webp", label: "WebP" },
];

interface Result {
  name: string;
  before: number;
  after: number;
}

export default function Convert() {
  const [target, setTarget] = useState<ImageFormat>("image/webp");
  const [quality, setQuality] = useState(90);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<File[]>([]);

  // Pick up images dropped on the landing page.
  useEffect(() => {
    void takeFiles().then((files) => files.length && setQueue(files));
  }, []);

  async function convert(files: File[]) {
    setBusy(true);
    setError(null);
    const done: Result[] = [];
    for (const file of files) {
      try {
        const bmp = await decodeImage(file);
        const blob = await encodeImage(bmp, {
          width: bmp.width,
          height: bmp.height,
          type: target,
          quality: quality / 100,
        });
        bmp.close();
        const name = replaceExtension(file.name, FORMAT_EXT[target]);
        downloadBlob(blob, name);
        done.push({ name, before: file.size, after: blob.size });
      } catch {
        setError(
          `${file.name} couldn't be converted. It may be damaged or in an unsupported format.`,
        );
      }
    }
    setResults(done);
    setQueue([]);
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-6">
        <fieldset className="flex gap-2">
          <legend className="mb-1 text-sm text-muted">Convert to</legend>
          {FORMATS.map((f) => (
            <button
              key={f.type}
              type="button"
              onClick={() => setTarget(f.type)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                target === f.type
                  ? "border-ink bg-ink text-paper"
                  : "border-line hover:border-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </fieldset>
        {target !== "image/png" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Quality: {quality}</span>
            <input
              type="range"
              min={10}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
            />
          </label>
        )}
      </div>

      <Dropzone
        accept="image/*"
        multiple
        label="Drop images or click to choose"
        onFiles={(files) => {
          setResults([]);
          setQueue((q) => [...q, ...files]);
        }}
      />

      {queue.length > 0 && (
        <div className="rounded-lg border border-line bg-surface">
          <ul className="divide-y divide-line text-sm">
            {queue.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex justify-between gap-4 px-4 py-2"
              >
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-muted">
                  {formatBytes(f.size)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-3 border-t border-line p-4">
            <button
              type="button"
              onClick={() => void convert(queue)}
              disabled={busy}
              className="rounded-md bg-marker px-4 py-2 font-semibold text-[#16201c] hover:brightness-95 disabled:opacity-50"
            >
              {busy
                ? "Converting…"
                : `Convert & download ${queue.length > 1 ? `${queue.length} images` : ""}`.trim()}
            </button>
            <button
              type="button"
              onClick={() => setQueue([])}
              className="rounded-md border border-line px-4 py-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}

      {results.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          {results.map((r) => (
            <li key={r.name} className="flex justify-between gap-4 px-4 py-2">
              <span className="truncate">{r.name}</span>
              <span className="shrink-0 text-muted">
                {formatBytes(r.before)} → {formatBytes(r.after)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
