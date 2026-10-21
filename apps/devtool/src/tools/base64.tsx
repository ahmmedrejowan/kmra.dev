import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { downloadBlob, formatBytes, toolName } from "@kmra/ui/lib/files";
import type { ToolProps } from ".";
import {
  BarCheck,
  BarSeg,
  Pane,
  Workspace,
  useSource,
  type PaneError,
} from "../lib/kit";
import { takeText } from "../lib/handoff";
import {
  DecodeError,
  bytesTo,
  extOf,
  fromBase64,
  fromUtf8,
  isText,
  lineCol,
  sniff,
  toBase64,
  utf8,
} from "../lib/encode";

type Mode = "encode" | "decode";
type Wrap = 0 | 64 | 76;

const SAMPLE = "Hello from kmra.dev! Ünïcödé and emoji work too: 👋";

export default function Base64({ preset }: ToolProps) {
  const T = useT();
  const [mode, setMode] = useState<Mode>((preset?.mode as Mode) ?? "encode");
  const [input, setInput] = useState("");
  const [file, setFile] = useState<{
    name: string;
    type: string;
    bytes: Uint8Array;
  } | null>(null);
  const [urlSafe, setUrlSafe] = useState(false);
  const [pad, setPad] = useState(true);
  const [wrap, setWrap] = useState<Wrap>(0);
  const [dataUri, setDataUri] = useState(false);
  const [asFile, setAsFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Name of the file opened to decode (the encoded file's name is in `file`) */
  const source = useSource();

  // Text from the home page's smart paste is Base64 to decode
  useEffect(() => {
    const t = takeText("base64");
    if (t !== null) {
      setInput(t);
      setMode("decode");
    }
  }, []);

  // Files can be dropped anywhere on the page
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const f = e.dataTransfer?.files[0];
      if (!f) return;
      e.preventDefault();
      void open(f);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  });

  async function open(f: File) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (mode === "decode") {
      setFile(null);
      setInput(new TextDecoder().decode(bytes));
      source.setName(f.name);
    } else {
      setFile({ name: f.name, type: f.type, bytes });
      source.setName(null);
    }
  }

  const result = useMemo(() => {
    if (mode === "encode") {
      if (!file && !input) return null;
      const bytes = file ? file.bytes : utf8(input);
      let text = toBase64(bytes, { urlSafe, pad, wrap });
      if (dataUri) {
        const mime = file
          ? file.type || sniff(bytes).mime
          : "text/plain;charset=utf-8";
        text = `data:${mime};base64,${text}`;
      }
      return { ok: true as const, dir: "encode" as const, bytes, text };
    }
    if (!input.trim()) return null;
    try {
      const d = fromBase64(input);
      const kind = sniff(d.bytes);
      const text = isText(d.bytes) ? fromUtf8(d.bytes).text : null;
      return { ok: true as const, dir: "decode" as const, ...d, kind, text };
    } catch (e) {
      if (!(e instanceof DecodeError)) throw e;
      return { ok: false as const, error: e };
    }
  }, [mode, input, file, urlSafe, pad, wrap, dataUri]);

  const error: PaneError | null =
    result && !result.ok
      ? {
          message:
            T(result.error.message) +
            (result.error.detail ? ` “${result.error.detail}”` : ""),
          ...(result.error.index !== undefined
            ? lineCol(input, result.error.index)
            : {}),
        }
      : null;

  const encoded = result?.ok && result.dir === "encode" ? result : null;
  const decoded = result?.ok && result.dir === "decode" ? result : null;
  const binary = decoded && (decoded.text === null || asFile);
  const ext = decoded
    ? decoded.mime && decoded.kind.ext === "bin"
      ? extOf(decoded.mime)
      : decoded.kind.ext
    : "bin";
  const preview = useMemo(() => {
    if (!decoded || !binary || !/^image\//.test(decoded.kind.mime)) return null;
    return URL.createObjectURL(
      new Blob([decoded.bytes as Uint8Array<ArrayBuffer>], {
        type: decoded.kind.mime,
      }),
    );
  }, [decoded, binary]);
  useEffect(
    () => () => void (preview && URL.revokeObjectURL(preview)),
    [preview],
  );

  // Encoded: "<your file>-base64-kmra.txt". Decoded: the opened file's own name without its
  // Base64 extension ("photo.jpg.b64" saves as "photo-kmra.jpg"); typed input keeps plain names.
  const decodedStem = source.name
    ?.replace(/\.(b64|base64|txt)$/i, "")
    .replace(/\.[^.]+$/, "");
  const encodedName = file
    ? `${toolName(file.name, "base64")}.txt`
    : source.name
      ? `${toolName(source.name, "base64")}.txt`
      : "base64.txt";
  const decodedName = (ext: string) =>
    decodedStem ? `${decodedStem}.${ext}` : `decoded.${ext}`;

  function saveDecoded() {
    if (!decoded) return;
    downloadBlob(
      new Blob([decoded.bytes as Uint8Array<ArrayBuffer>], {
        type: decoded.mime ?? decoded.kind.mime,
      }),
      decodedName(ext),
    );
  }

  function swap() {
    if (encoded) {
      // Decoding what a file became gives that file back, under its own name
      source.setName(file ? file.name : null);
      setFile(null);
      setInput(encoded.text);
      setMode("decode");
    } else if (decoded && decoded.text !== null) {
      setInput(decoded.text);
      setMode("encode");
    }
  }

  const output = encoded?.text ?? decoded?.text ?? "";

  return (
    <Workspace
      bar={
        <>
          <BarSeg<Mode>
            label={T("Direction")}
            options={[
              ["encode", T("Encode")],
              ["decode", T("Decode")],
            ]}
            value={mode}
            onPick={(m) => {
              setMode(m);
              setFile(null);
            }}
          />
          {mode === "encode" ? (
            <>
              <BarSeg<boolean>
                label={T("Alphabet")}
                options={[
                  [false, T("Standard")],
                  [true, T("URL-safe")],
                ]}
                value={urlSafe}
                onPick={(v) => {
                  setUrlSafe(v);
                  setPad(!v);
                }}
              />
              <BarCheck label={T("Padding (=)")} on={pad} onChange={setPad} />
              <BarSeg<Wrap>
                label={T("Line length")}
                options={[
                  [0, T("One line")],
                  [64, "64"],
                  [76, "76"],
                ]}
                value={wrap}
                onPick={setWrap}
              />
              <BarCheck
                label={T("Data URI")}
                on={dataUri}
                onChange={setDataUri}
              />
            </>
          ) : (
            <BarCheck
              label={T("Show as file")}
              on={asFile}
              onChange={setAsFile}
            />
          )}
          {result?.ok && (mode === "encode" || decoded?.text !== null) && (
            <button type="button" className="btn xs" onClick={swap}>
              <Icon name="convert" />
              {T("Swap")}
            </button>
          )}
          {!input && !file && (
            <button
              type="button"
              className="btn xs bar-push"
              onClick={() =>
                setInput(mode === "encode" ? SAMPLE : toBase64(utf8(SAMPLE)))
              }
            >
              {T("Try a sample")}
            </button>
          )}
        </>
      }
      status={
        !result ? (
          <span>
            {mode === "encode"
              ? T("Type text or open a file to encode it.")
              : T("Paste Base64 or a data URI to decode it.")}
          </span>
        ) : !result.ok ? (
          <span className="bad">{T("Not valid Base64")}</span>
        ) : encoded ? (
          <>
            <span className="ok">
              {file ? T("File encoded") : T("Text encoded")}
            </span>
            <span>
              {formatBytes(encoded.bytes.length)} →{" "}
              {T("{n} characters", { n: encoded.text.length.toLocaleString() })}
            </span>
          </>
        ) : (
          <>
            <span className="ok">{T("Valid Base64")}</span>
            {decoded!.urlSafe && <span>{T("URL-safe")}</span>}
            <span>{T(decoded!.kind.label)}</span>
            <span>{formatBytes(decoded!.bytes.length)}</span>
          </>
        )
      }
    >
      <Pane
        label={mode === "encode" ? T("Text or file") : T("Base64")}
        value={input}
        onChange={(v) => {
          setFile(null);
          setInput(v);
        }}
        placeholder={
          mode === "encode"
            ? T("Type or paste text, or open a file")
            : T("Paste Base64 here")
        }
        error={error}
        wrap
        actions={
          <>
            <button
              type="button"
              className="btn xs"
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload" />
              {T("Open file")}
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void open(f);
              }}
            />
          </>
        }
      >
        {file ? (
          <div className="enc-file">
            <Icon name="file" />
            <strong>{file.name}</strong>
            <span className="muted">
              {formatBytes(file.bytes.length)} · {T(sniff(file.bytes).label)}
            </span>
            <button
              type="button"
              className="btn xs"
              onClick={() => setFile(null)}
            >
              {T("Remove file")}
            </button>
          </div>
        ) : undefined}
      </Pane>
      <Pane
        label={mode === "encode" ? T("Base64") : binary ? T("File") : T("Text")}
        value={output}
        readOnly
        wrap
        download={mode === "encode" ? encodedName : decodedName("txt")}
        keepName
        actions={
          decoded && !binary ? (
            <button type="button" className="btn xs" onClick={saveDecoded}>
              <Icon name="download" />
              {T("Save as file")}
            </button>
          ) : undefined
        }
      >
        {binary && decoded ? (
          <div className="enc-file">
            {preview ? (
              <img src={preview} alt={T("Decoded image")} />
            ) : (
              <Icon name="file" />
            )}
            <strong>{T(decoded.kind.label)}</strong>
            <span className="muted">
              {formatBytes(decoded.bytes.length)} ·{" "}
              {decoded.mime ?? decoded.kind.mime}
            </span>
            <code className="enc-hex">
              {bytesTo(decoded.bytes.subarray(0, 24), "hex")}
              {decoded.bytes.length > 24 ? " …" : ""}
            </code>
            <button type="button" className="btn acc sm" onClick={saveDecoded}>
              <Icon name="download" />
              {T("Download")} {decodedName(ext)}
            </button>
          </div>
        ) : undefined}
      </Pane>
    </Workspace>
  );
}
