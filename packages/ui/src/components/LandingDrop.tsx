import { useEffect, useRef, useState } from "react";
import { stashFiles } from "../lib/handoff";
import { toast } from "../lib/toast";
import { pasteHint } from "../lib/keys";
import { IMAGE_ACCEPT, isImageFile } from "../lib/files";
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
  /** Large hero version */
  large?: boolean;
  /** Labels for non-English pages */
  text?: { hint: string; button: string; over: string };
}

/**
 * Landing-page drop area. Files dropped or pasted anywhere on the page are handed to the tool page
 * through IndexedDB; nothing is uploaded.
 */
export default function LandingDrop({
  accept,
  label,
  formats,
  target,
  unavailable,
  large,
  text,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [hint, setHint] = useState("or paste with ⌘V. Nothing is uploaded.");
  useEffect(() => setHint(pasteHint()), []);
  const takeRef = useRef<(list: FileList | File[] | null) => Promise<void>>(
    async () => {},
  );

  takeRef.current = async (list) => {
    const files = [...(list ?? [])].filter(
      (f) =>
        f.type.startsWith(accept) ||
        f.type === accept ||
        (accept === "image/" && isImageFile(f)),
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
  };

  useEffect(() => {
    const open = () => inputRef.current?.click();
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) void takeRef.current(files);
    };
    const onOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      setOver(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setOver(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      setOver(false);
      void takeRef.current(e.dataTransfer.files);
    };
    window.addEventListener("kmra:upload", open);
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("kmra:upload", open);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div className={`dropcard${large ? " lg" : ""}`}>
      <div
        className={`dropzone${over ? " over" : ""}`}
        onClick={() => inputRef.current?.click()}
      >
        <div className="big">
          <Icon name="upload" />
        </div>
        <strong>{over ? (text?.over ?? "Drop to start") : label}</strong>
        <span className="muted">{text?.hint ?? hint}</span>
        <div className="row">
          <button
            className={`btn acc${large ? " lg" : ""}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            <Icon name="upload" />
            {text?.button ?? "Choose files"}
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
          accept={
            accept === "image/"
              ? IMAGE_ACCEPT
              : accept.endsWith("/")
                ? `${accept}*`
                : accept
          }
          multiple
          hidden
          onChange={(e) => {
            void takeRef.current(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
