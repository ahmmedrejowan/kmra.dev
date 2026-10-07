import { useEffect, useMemo, useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { downloadBlob, formatBytes } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import { Seg } from "./FxControls";
import {
  baseName,
  CopyBtn,
  DropCard,
  FileInput,
  ToolCard,
  useFiles,
} from "@kmra/ui/components/kit";

/** Image to Base64 (data URI, CSS, HTML) and back. */
type Out = "uri" | "raw" | "css" | "html" | "md";

function toDataUri(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

const MAGIC: [RegExp, string][] = [
  [/^\/9j\//, "image/jpeg"],
  [/^iVBORw0KGgo/, "image/png"],
  [/^R0lGOD/, "image/gif"],
  [/^UklGR/, "image/webp"],
  [/^PHN2Z|^PD94bWw/, "image/svg+xml"],
  [/^Qk/, "image/bmp"],
  [/^AAABAA/, "image/x-icon"],
];
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
};

/** Accepts a data URI or bare Base64; returns the decoded image or a reason it isn't one */
function parse(
  text: string,
): { blob: Blob; type: string } | { error: string } | null {
  const t = text
    .trim()
    .replace(/^url\(["']?|["']?\)$/g, "")
    .replace(/^src=["']|["']$/g, "");
  if (!t) return null;
  const m = /^data:([\w/+.-]+)?(;[^,]*)?,(.*)$/s.exec(t);
  const b64 = (m ? m[3]! : t).replace(/\s+/g, "");
  if (m && !/;base64/.test(m[2] ?? ""))
    return { error: "This data URI isn't Base64-encoded." };
  if (!/^[A-Za-z0-9+/_-]+=*$/.test(b64))
    return {
      error: "That isn't valid Base64. Check that nothing was cut off.",
    };
  try {
    const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const type = m?.[1] ?? MAGIC.find(([re]) => re.test(b64))?.[1] ?? "";
    if (!type.startsWith("image/"))
      return { error: "This decodes, but it doesn't look like an image." };
    return { blob: new Blob([bytes], { type }), type };
  } catch {
    return {
      error: "That isn't valid Base64. Check that nothing was cut off.",
    };
  }
}

export default function Base64() {
  const [dir, setDir] = useState<"encode" | "decode">("encode");
  const [file, setFile] = useState<File | null>(null);
  const [uri, setUri] = useState("");
  const [out, setOut] = useState<Out>("uri");
  const [text, setText] = useState("");

  async function open(files: File[]) {
    setDir("encode");
    setFile(files[0]!);
    setUri(await toDataUri(files[0]!));
  }
  const { dragging, pickRef, pick, take } = useFiles({
    onFiles: (f) => void open(f),
  });

  const raw = uri.slice(uri.indexOf(",") + 1);
  const value =
    out === "uri"
      ? uri
      : out === "raw"
        ? raw
        : out === "css"
          ? `background-image: url("${uri}");`
          : out === "html"
            ? `<img src="${uri}" alt="">`
            : `![image](${uri})`;

  const decoded = useMemo(() => parse(text), [text]);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!decoded || "error" in decoded) return setPreview("");
    const u = URL.createObjectURL(decoded.blob);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [decoded]);

  const input = (
    <FileInput
      inputRef={pickRef}
      onFiles={take}
      multiple={false}
      accept="image/*,.svg,.ico"
    />
  );
  const modeSwitch = (
    <Seg<"encode" | "decode">
      label="Direction"
      options={[
        ["encode", "Image to Base64"],
        ["decode", "Base64 to image"],
      ]}
      value={dir}
      onPick={setDir}
    />
  );

  if (dir === "encode" && !file)
    return (
      <>
        <div className="mode-strip">{modeSwitch}</div>
        <DropCard
          dragging={dragging}
          onPick={pick}
          title="Drop an image here"
          button="Choose an image"
          formats={["JPG", "PNG", "WebP", "GIF", "SVG", "ICO"]}
        />
        {input}
      </>
    );

  if (dir === "decode")
    return (
      <>
        <ToolCard
          stage={
            preview ? (
              <img className="still" src={preview} alt="Decoded image" />
            ) : (
              <p className="muted">
                {decoded && "error" in decoded
                  ? decoded.error
                  : "Paste Base64 on the right to see the image here."}
              </p>
            )
          }
          panel={
            <>
              {modeSwitch}
              <div className="ctl">
                <label htmlFor="b64-in">Base64 or data URI</label>
                <textarea
                  id="b64-in"
                  className="num code-in"
                  rows={10}
                  value={text}
                  placeholder="data:image/png;base64,iVBORw0KGgo…"
                  onChange={(e) => setText(e.target.value)}
                  spellCheck={false}
                />
              </div>
              {decoded && !("error" in decoded) && (
                <div className="result">
                  <small>
                    {decoded.type.replace("image/", "").toUpperCase()},{" "}
                    {formatBytes(decoded.blob.size)}
                  </small>
                  <div className="acts">
                    <button
                      type="button"
                      className="btn acc"
                      onClick={() =>
                        downloadBlob(
                          decoded.blob,
                          `decoded-kmra.${EXT[decoded.type] ?? "img"}`,
                        )
                      }
                    >
                      <Icon name="download" />
                      Download image
                    </button>
                  </div>
                </div>
              )}
            </>
          }
        />
      </>
    );

  const grow = file ? Math.round((uri.length / file.size - 1) * 100) : 0;
  return (
    <>
      <ToolCard
        dragging={dragging}
        wide
        stage={
          <>
            <img className="still" src={uri} alt={file!.name} />
            <div className="filebar">
              <button type="button" className="fchip add" onClick={pick}>
                Use another image
              </button>
            </div>
          </>
        }
        panel={
          <>
            {modeSwitch}
            <Seg<Out>
              label="Copy as"
              options={[
                ["uri", "Data URI"],
                ["raw", "Base64"],
                ["css", "CSS"],
                ["html", "HTML"],
                ["md", "Markdown"],
              ]}
              value={out}
              onPick={setOut}
            />
            <textarea
              className="num code-in"
              rows={9}
              readOnly
              value={value}
              onFocus={(e) => e.target.select()}
              aria-label="Base64 output"
            />
            <div className="result">
              <small>
                {formatBytes(file!.size)} image becomes{" "}
                {formatBytes(value.length)} of text ({grow}% larger)
              </small>
              {file!.size > 100 * 1024 && (
                <small className="warn">
                  Over 100 KB. Embedding images this big slows pages down; a
                  normal file is usually better.
                </small>
              )}
              <div className="acts">
                <CopyBtn
                  text={value}
                  label="Copy"
                  what="Copied"
                  className="btn acc"
                />
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    downloadBlob(
                      new Blob([value], { type: "text/plain" }),
                      `${baseName(file!.name)}-base64.txt`,
                    );
                    toast("Saved as a text file.");
                  }}
                >
                  <Icon name="download" />
                  Save as .txt
                </button>
              </div>
            </div>
          </>
        }
      />
      {input}
    </>
  );
}
