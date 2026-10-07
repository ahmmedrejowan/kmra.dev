import { useRef, useState, type DragEvent } from "react";

interface Props {
  accept: string;
  multiple?: boolean;
  label?: string;
  onFiles: (files: File[]) => void;
}

export function Dropzone({
  accept,
  multiple = false,
  label = "Drop files here or click to choose",
  onFiles,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function handle(list: FileList | null) {
    if (!list?.length) return;
    onFiles(multiple ? Array.from(list) : [list[0]!]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    handle(e.dataTransfer.files);
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-12 text-center transition ${
        over ? "border-ink bg-surface" : "border-line hover:border-ink"
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className="mt-1 text-sm text-muted">Nothing is uploaded</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
      />
    </button>
  );
}
