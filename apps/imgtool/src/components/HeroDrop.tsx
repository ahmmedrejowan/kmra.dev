import { useEffect, useRef, useState, type DragEvent } from "react";
import type { Tool } from "@kmra/registry";
import { formatBytes } from "@kmra/ui/lib/files";
import { stashFiles } from "@kmra/ui/lib/handoff";

interface Props {
  tools: readonly Pick<Tool, "slug" | "name">[];
}

interface Loaded {
  files: File[];
  url: string;
  width: number;
  height: number;
}

/** Landing-page mat: drop an image, see it measured, pick a tool. */
export default function HeroDrop({ tools }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (loaded) URL.revokeObjectURL(loaded.url);
    },
    [loaded],
  );

  async function load(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    const first = files[0];
    if (!first) {
      if (list?.length)
        setError("That file isn't an image. Try a JPEG, PNG, WebP or GIF.");
      return;
    }
    try {
      const bmp = await createImageBitmap(first, {
        imageOrientation: "from-image",
      });
      setLoaded({
        files,
        url: URL.createObjectURL(first),
        width: bmp.width,
        height: bmp.height,
      });
      bmp.close();
      setError(null);
    } catch {
      setError(
        `${first.name} couldn't be opened. It may be damaged or in an unsupported format.`,
      );
    }
  }

  async function openTool(slug: string) {
    if (!loaded) return;
    await stashFiles(loaded.files);
    window.location.href = `/${slug}`;
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    void load(e.dataTransfer.files);
  }

  const dragProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop,
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(e) => {
        void load(e.target.files);
        e.target.value = "";
      }}
    />
  );

  if (!loaded) {
    return (
      <div
        {...dragProps}
        className={`flex min-h-80 flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
          over ? "border-marker bg-white/10" : "border-on-mat-muted/60"
        }`}
      >
        <p className="font-wide text-xl font-bold tracking-tight">
          Drop an image on the mat
        </p>
        <p className="mt-2 text-on-mat-muted">
          We'll measure it and you can choose what to do next.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-6 rounded-md bg-marker px-5 py-2.5 font-semibold text-[#16201c] hover:brightness-95"
        >
          Choose an image
        </button>
        {error && (
          <p role="alert" className="mt-4 text-sm text-marker">
            {error}
          </p>
        )}
        {input}
      </div>
    );
  }

  const first = loaded.files[0]!;
  const extra = loaded.files.length - 1;

  return (
    <div
      {...dragProps}
      className="flex min-h-80 flex-col items-center justify-center py-4"
    >
      {/* Image with dimension lines measured against its rendered box */}
      <div className="relative mt-8 ml-10 inline-block max-w-[calc(100%-2.5rem)]">
        <div
          className="absolute inset-x-0 -top-7 flex items-center gap-2 text-sm text-on-mat-muted"
          aria-hidden="true"
        >
          <span className="h-3 w-px bg-current" />
          <span className="h-px flex-1 bg-current" />
          <span className="font-semibold text-on-mat">{loaded.width} px</span>
          <span className="h-px flex-1 bg-current" />
          <span className="h-3 w-px bg-current" />
        </div>
        <div
          className="absolute inset-y-0 -left-9 flex flex-col items-center gap-2 text-sm text-on-mat-muted"
          aria-hidden="true"
        >
          <span className="h-px w-3 bg-current" />
          <span className="w-px flex-1 bg-current" />
          <span className="rotate-180 font-semibold text-on-mat [writing-mode:vertical-rl]">
            {loaded.height} px
          </span>
          <span className="w-px flex-1 bg-current" />
          <span className="h-px w-3 bg-current" />
        </div>
        <img
          src={loaded.url}
          alt={`Preview of ${first.name}, ${loaded.width} by ${loaded.height} pixels`}
          className="animate-land block max-h-64 w-auto max-w-full bg-white object-contain"
        />
      </div>

      <p className="mt-5 max-w-full truncate text-sm text-on-mat-muted">
        {first.name}, {formatBytes(first.size)}
        {extra > 0 && ` and ${extra} more`}
      </p>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {tools.map((t, i) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => void openTool(t.slug)}
            className={
              i === 0
                ? "rounded-md bg-marker px-4 py-2 font-semibold text-[#16201c] hover:brightness-95"
                : "rounded-md px-4 py-2 font-semibold ring-1 ring-on-mat-muted/70 hover:bg-white/10"
            }
          >
            {t.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-md px-4 py-2 text-on-mat-muted hover:text-on-mat"
        >
          Use a different image
        </button>
      </div>
      {input}
    </div>
  );
}
