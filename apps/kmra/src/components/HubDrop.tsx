import { useEffect, useRef, useState } from "react";
import type { IconName } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { LangProvider, useT } from "@kmra/ui/lib/i18n-react";
import type { Locale } from "@kmra/ui/lib/i18n";
import { toast } from "@kmra/ui/lib/toast";
import { sendFiles } from "../lib/send";

export interface DropTool {
  name: string;
  href: string;
  icon: IconName;
}
export interface DropApp {
  id: string;
  brand: [string, string];
  color: string;
  mark: string;
  tools: DropTool[];
}
export interface DropKind {
  key: string;
  label: string;
  mime: string[];
  ext: string[];
  apps: DropApp[];
}

const SHOWN = 6;

function kindOf(file: File, kinds: DropKind[]): DropKind | undefined {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const type = file.type.toLowerCase();
  // Extensions first (a .json may come as text/plain), then the MIME type
  return (
    kinds.find((k) => k.ext.includes(ext)) ??
    kinds.find((k) =>
      k.mime.some((m) => (m.endsWith("/") ? type.startsWith(m) : type === m)),
    )
  );
}

const size = (b: number) =>
  b >= 1e9
    ? `${(b / 1e9).toFixed(1)} GB`
    : b >= 1e6
      ? `${(b / 1e6).toFixed(1)} MB`
      : `${Math.max(1, Math.round(b / 1e3))} KB`;

function Drop({
  kinds,
  formats,
  marks,
}: {
  kinds: DropKind[];
  formats: string[];
  /** Every app's logo, in app order */
  marks: string[];
}) {
  const T = useT();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [more, setMore] = useState<string[]>([]);
  const [opening, setOpening] = useState<string | null>(null);
  const [failed, setFailed] = useState<DropTool | null>(null);
  /** Counts drops and sends, so a send overtaken by a new drop doesn't navigate */
  const sending = useRef(0);

  const take = (list: FileList | File[]) => {
    const all = [...list];
    if (!all.length) return;
    // Files of the first file's kind travel together (several PDFs to merge, a batch of photos)
    const k = kindOf(all[0]!, kinds);
    const kept = k ? all.filter((f) => kindOf(f, kinds) === k) : all.slice(0, 1);
    setFiles(kept);
    // Say what didn't come along, rather than dropping it quietly
    const left = all.filter((f) => !kept.includes(f));
    if (left.length)
      toast(
        T("Left out {list}: one kind of file at a time.", {
          list: left.map((f) => f.name).join(", "),
        }),
      );
    sending.current++;
    setMore([]);
    setFailed(null);
    setOpening(null);
  };

  useEffect(() => {
    const onOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      setOver(true);
    };
    const onLeave = (e: DragEvent) => !e.relatedTarget && setOver(false);
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      setOver(false);
      take(e.dataTransfer.files);
    };
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])];
      if (f.length) take(f);
    };
    addEventListener("dragover", onOver);
    addEventListener("dragleave", onLeave);
    addEventListener("drop", onDrop);
    addEventListener("paste", onPaste);
    // Back from a tool (bfcache): ready for the next file
    const onShow = (e: PageTransitionEvent) => e.persisted && setOpening(null);
    addEventListener("pageshow", onShow);
    return () => {
      removeEventListener("dragover", onOver);
      removeEventListener("dragleave", onLeave);
      removeEventListener("drop", onDrop);
      removeEventListener("paste", onPaste);
      removeEventListener("pageshow", onShow);
    };
  }, []);

  async function open(t: DropTool) {
    setOpening(t.href);
    setFailed(null);
    const mine = ++sending.current;
    const ok = await sendFiles(files, t.href);
    // Other files were dropped meanwhile: this send is out of date
    if (mine !== sending.current) return;
    if (ok) location.href = t.href;
    else {
      setOpening(null);
      setFailed(t);
    }
  }

  const kind = files[0] ? kindOf(files[0], kinds) : undefined;
  const total = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="dropcard lg hubdrop">
      {!files.length ? (
        <div
          className={`dropzone${over ? " over" : ""}`}
          onClick={() => input.current?.click()}
        >
          <div className="hub-kinds" aria-hidden="true">
            {marks.map((m, i) => (
              <span key={i} dangerouslySetInnerHTML={{ __html: m }} />
            ))}
          </div>
          <strong>
            {over ? T("Drop to see your tools") : T("Drop any file")}
          </strong>
          <span className="muted">
            {T(
              "A photo, a PDF, a video, a song or a JSON file. You'll see every tool that opens it.",
            )}
          </span>
          <div className="row">
            <button
              className="btn acc lg"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                input.current?.click();
              }}
            >
              <Icon name="upload" />
              {T("Choose files")}
            </button>
          </div>
          <div className="formats">
            {formats.map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="hub-picked">
          <div className="hub-file">
            <span className="tile">
              <Icon name="file" />
            </span>
            <span>
              <strong>
                {files.length === 1
                  ? files[0]!.name
                  : T("{n} files", { n: files.length })}
              </strong>
              <small>
                {kind ? T(kind.label) : T("File")} · {size(total)} ·{" "}
                {T("stays on your device")}
              </small>
            </span>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setFiles([]);
                setFailed(null);
              }}
            >
              {T("Other files")}
            </button>
          </div>
          {failed && (
            <p className="note warn" role="alert">
              {T("{tool} didn't get the file.", { tool: failed.name })}{" "}
              <a href={failed.href}>{T("Open it and add the file there")}</a>
            </p>
          )}
          {kind ? (
            kind.apps.map((a) => {
              const all = more.includes(a.id);
              const list = all ? a.tools : a.tools.slice(0, SHOWN);
              return (
                <div
                  className="hub-match"
                  key={a.id}
                  style={{ ["--app" as string]: a.color }}
                >
                  <h3>
                    <span
                      className="hub-match-mark"
                      dangerouslySetInnerHTML={{ __html: a.mark }}
                    />
                    <span>
                      <span style={{ color: a.color }}>{a.brand[0]}</span>
                      {a.brand[1]}
                    </span>
                  </h3>
                  <div className="hub-match-tools">
                    {list.map((t) => (
                      <a
                        key={t.href}
                        href={t.href}
                        aria-busy={opening === t.href || undefined}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                          e.preventDefault();
                          if (!opening) void open(t);
                        }}
                      >
                        <Icon name={t.icon} />
                        {opening === t.href ? T("Opening…") : t.name}
                      </a>
                    ))}
                    {a.tools.length > SHOWN && !all && (
                      <button
                        type="button"
                        className="hub-more"
                        onClick={() => setMore((m) => [...m, a.id])}
                      >
                        {T("{n} more", { n: a.tools.length - SHOWN })}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="hub-none">
              {T(
                "There's no kmra tool for this kind of file yet. Try an image, a PDF, a video, an audio file, a GIF, or a JSON, CSV, YAML, XML, SQL, Markdown, HTML, CSS, JavaScript or text file.",
              )}
            </p>
          )}
        </div>
      )}
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) take(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * One drop box for every kind of file: it reads the type and offers the tools that open it, from
 * whichever app has them. Picking a tool hands the files to that app (lib/send) and opens it.
 */
export default function HubDrop({
  lang = "en",
  ...props
}: {
  lang?: Locale;
  kinds: DropKind[];
  formats: string[];
  marks: string[];
}) {
  return (
    <LangProvider lang={lang}>
      <Drop {...props} />
    </LangProvider>
  );
}
