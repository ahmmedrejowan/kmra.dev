import type { ReactNode } from "react";
import { DropCard, FileInput, useFiles } from "@kmra/ui/components/kit";
import { useT } from "@kmra/ui/lib/i18n-react";
import { isMediaFile, VIDEO_ACCEPT } from "../engine";
import type { Engine } from "../types";

/**
 * File intake for video/audio tools: files dropped anywhere on the page, pasted, picked, or handed
 * over from the home page (IndexedDB hand-off). Pair `useMediaFiles` with <MediaDrop> (the empty
 * state) and <MediaInput> (the hidden picker).
 */
export function useMediaFiles(
  onFiles: (files: File[]) => void,
  accept: (f: File) => boolean = isMediaFile,
  /** Message when nothing usable was dropped (default: "That isn't a video …") */
  reject?: string,
) {
  const T = useT();
  return useFiles({
    onFiles,
    accept,
    reject: reject ?? T("That isn't a video. Try MP4, MOV, WebM, MKV or AVI."),
  });
}

export function MediaInput({
  inputRef,
  onFiles,
  multiple = true,
  accept = VIDEO_ACCEPT,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (f: FileList) => void;
  multiple?: boolean;
  accept?: string;
}) {
  return (
    <FileInput
      inputRef={inputRef}
      onFiles={onFiles}
      multiple={multiple}
      accept={accept}
    />
  );
}

/** The big empty-state drop card for video tools */
export function MediaDrop({
  title,
  button,
  formats = ["MP4", "MOV", "WebM", "MKV", "AVI"],
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
  const T = useT();
  return (
    <DropCard
      title={title ?? T("Drop a video here")}
      button={button ?? T("Choose a video")}
      formats={formats}
      dragging={dragging}
      onPick={onPick}
    >
      {children}
    </DropCard>
  );
}

/** Which engine did (or will do) the job: "Hardware (fast)", "Compatible (slower)", "Lossless copy" */
export function EngineBadge({
  engine,
  reason,
}: {
  engine: Engine;
  reason?: string;
}) {
  const T = useT();
  const label =
    engine === "copy"
      ? T("Lossless copy (instant)")
      : engine === "webcodecs"
        ? T("Hardware (fast)")
        : T("Compatible (slower)");
  return (
    <span
      className={`mp-engine ${engine}`}
      title={reason ? T(reason) : undefined}
    >
      <i aria-hidden="true" />
      {label}
    </span>
  );
}
