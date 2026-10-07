import { useEffect, useRef, useState, type DragEvent } from "react";
import { stashFiles } from "../lib/handoff";
import { toast } from "../lib/toast";
import { Icon } from "./Icon";

interface Props {
  /** MIME prefix or type the app accepts, e.g. "image/" or "application/pdf" */
  accept: string;
  label: string;
  formats: string[];
  /** Tool path to open with the files, e.g. "/compress". Omit when no tool is ready yet. */
  target?: string;
  /** Shown instead of opening a tool when `target` is missing */
  unavailable?: string;
}

/** Landing-page drop area: files are handed to the tool page through IndexedDB, never uploaded. */
export default function LandingDrop({
  accept,
  label,
  formats,
  target,
  unavailable,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  async function take(list: FileList | File[] | null) {
    const files = [...(list ?? [])].filter(
      (f) => f.type.startsWith(accept) || f.type === accept,
    );
    if (!files.length) {
      if (list && [...list].length)
        toast(
          `That file type isn't supported here. Try ${formats.join(", ")}.`,
        );
      return;
    }
    if (!target) {
      toast(unavailable ?? "This tool isn't ready yet.");
      return;
    }
    await stashFiles(files);
    window.location.href = target;
  }

  // "Upload" buttons elsewhere on the page open this picker.
  useEffect(() => {
    const open = () => inputRef.current?.click();
    window.addEventListener("kmra:upload", open);
    return () => window.removeEventListener("kmra:upload", open);
  }, []);

  // Paste anywhere on the landing page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) void take(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void take(e.dataTransfer.files);
  };

  return (
    <div className="dropcard">
      <div
        className={`dropzone${over ? " over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <div className="big">
          <Icon name="upload" />
        </div>
        <strong>{label}</strong>
        <span className="muted">or paste with ⌘V. Nothing is uploaded.</span>
        <div className="row">
          <button
            className="btn acc"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            Choose files
          </button>
        </div>
        <div className="formats">
          {formats.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept.endsWith("/") ? `${accept}*` : accept}
          multiple
          hidden
          onChange={(e) => {
            void take(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
