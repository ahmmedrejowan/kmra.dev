import { useEffect, useRef, useState, type ReactNode } from "react";
import { zipSync } from "fflate";
import { Icon } from "./Icon";
import { downloadBlob, IMAGE_ACCEPT, isImageFile, tagged } from "../lib/files";
import { takeFiles } from "../lib/handoff";
import { pasteHint } from "../lib/keys";
import { toast } from "../lib/toast";
import { useLang, useT } from "../lib/i18n-react";

/**
 * Shared pieces for the tools that aren't a single-image pipeline (analyze, collage, split,
 * favicon, Base64, GIF frames): file intake, the empty drop card, copy and zip helpers.
 */

/** Files dropped anywhere on the page, pasted, picked, or handed over from another page. */
export function useFiles(opts: {
  onFiles: (files: File[]) => void;
  accept?: (f: File) => boolean;
  /** Message when nothing usable was dropped */
  reject?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const tt = useT();
  const cb = useRef(opts);
  cb.current = opts;

  const take = (list: FileList | File[]) => {
    const ok = [...list].filter(cb.current.accept ?? isImageFile);
    if (!ok.length) {
      toast(
        cb.current.reject ??
          tt("That isn't an image. Try JPEG, PNG, WebP, GIF or AVIF."),
      );
      return;
    }
    cb.current.onFiles(ok);
  };

  useEffect(() => {
    void takeFiles().then((f) => f.length && take(f));
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      setDragging(true);
    };
    const leave = (e: DragEvent) => !e.relatedTarget && setDragging(false);
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      setDragging(false);
      take(e.dataTransfer.files);
    };
    const paste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) take(files);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", paste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { dragging, pickRef, pick: () => pickRef.current?.click(), take };
}

export function FileInput({
  inputRef,
  onFiles,
  multiple = true,
  accept = IMAGE_ACCEPT,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (f: FileList) => void;
  multiple?: boolean;
  accept?: string;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      multiple={multiple}
      hidden
      onChange={(e) => {
        if (e.target.files?.length) onFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );
}

/** The big empty-state drop card used by every tool. */
export function DropCard({
  title,
  button,
  formats = ["JPG", "PNG", "WebP", "GIF", "AVIF"],
  dragging,
  onPick,
  children,
}: {
  title?: string;
  button?: string;
  formats?: string[];
  dragging: boolean;
  onPick: () => void;
  children?: ReactNode;
}) {
  const tt = useT();
  const lang = useLang();
  const [hint, setHint] = useState(
    tt("or paste with ⌘V. Your files stay on your device."),
  );
  useEffect(() => setHint(pasteHint(lang)), [lang]);
  return (
    <div className="dropcard lg">
      <div className={`dropzone${dragging ? " over" : ""}`} onClick={onPick}>
        <div className="big">
          <Icon name="upload" />
        </div>
        <strong>{title ?? tt("Drop images here")}</strong>
        <span className="muted">{hint}</span>
        <div className="row">
          <button
            className="btn acc lg"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPick();
            }}
          >
            <Icon name="upload" />
            {button ?? tt("Choose images")}
          </button>
        </div>
        <div className="formats">
          {formats.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

export async function copyText(
  text: string,
  what = "Copied",
  failed = "Couldn't copy. Select the text and copy it yourself.",
) {
  try {
    await navigator.clipboard.writeText(text);
    toast(what);
  } catch {
    toast(failed);
  }
}

export function CopyBtn({
  text,
  label,
  what,
  className = "btn sm",
}: {
  text: string;
  label?: string;
  what?: string;
  className?: string;
}) {
  const tt = useT();
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        void copyText(
          text,
          tt(what ?? "Copied"),
          tt("Couldn't copy. Select the text and copy it yourself."),
        )
      }
    >
      <Icon name="copy" />
      {label ?? tt("Copy")}
    </button>
  );
}

/** Zip files without re-compressing (images are already compressed). The zip and every file in it carry the kmra.dev tag. */
export async function downloadZip(
  files: { name: string; blob: Blob }[],
  zipName: string,
  /** Files whose exact names matter (a favicon set a website looks for) keep them */
  opts: { keepNames?: boolean } = {},
) {
  const entries = Object.fromEntries(
    await Promise.all(
      files.map(
        async (f) =>
          [opts.keepNames ? f.name : tagged(f.name), new Uint8Array(await f.blob.arrayBuffer())] as const,
      ),
    ),
  );
  downloadBlob(
    new Blob([zipSync(entries, { level: 0 })], { type: "application/zip" }),
    zipName,
  );
}

export function canvasBlob(
  c: HTMLCanvasElement | OffscreenCanvas,
  type = "image/png",
  quality = 0.92,
): Promise<Blob> {
  if (c instanceof OffscreenCanvas) return c.convertToBlob({ type, quality });
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), type, quality),
  );
}

/**
 * Decode any image the browser can show (SVG included) to a bitmap. `svgSide` draws SVGs at least
 * that many pixels on the long side (vectors stay sharp when scaled up).
 */
export async function decode(file: Blob, svgSide = 0): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // SVG and a few others only decode through an <img>
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      // An SVG with only a viewBox has no size of its own, which createImageBitmap refuses
      // without one, so always give it a size.
      const w = img.naturalWidth || 300;
      const h = img.naturalHeight || 150;
      const k = Math.max(1, svgSide / Math.max(w, h));
      return await createImageBitmap(img, {
        resizeWidth: Math.round(w * k),
        resizeHeight: Math.round(h * k),
        resizeQuality: "high",
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "") || "image";
}

/** Card layout shared by the standalone tools: stage on the left, panel on the right. */
export function ToolCard({
  stage,
  panel,
  dragging,
  wide,
}: {
  stage: ReactNode;
  panel: ReactNode;
  dragging?: boolean;
  /** Give the panel more room (tables, code) */
  wide?: boolean;
}) {
  return (
    <div className={`toolcard${wide ? " wide-panel" : ""}`}>
      <div className={`stage${dragging ? " over" : ""}`}>{stage}</div>
      <div className="controls">{panel}</div>
    </div>
  );
}
