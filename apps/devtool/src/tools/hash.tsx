import { useEffect, useRef, useState, type DragEvent } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { useT } from "@kmra/ui/lib/i18n-react";
import { formatBytes } from "@kmra/ui/lib/files";
import type { ToolProps } from ".";
import {
  BarField,
  BarSeg,
  Pane,
  Workspace,
  textBytes,
  useInput,
} from "../lib/kit";
import { Rows, type Row } from "../lib/rows";
import type { Algo, HashReply, HashRequest } from "../lib/hash.worker";

const ALGOS: Algo[] = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"];
type Out = "hex" | "base64";
type Digests = Record<Algo, Uint8Array>;

const toHex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const toB64 = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};

/** The text's hashes: SHA family through WebCrypto, MD5 through hash-wasm (loaded on demand). */
async function hashText(text: string, key: string | null): Promise<Digests> {
  const data = new TextEncoder().encode(text);
  const subtle = crypto.subtle;
  const sha = async (a: Algo) => {
    if (key === null) return new Uint8Array(await subtle.digest(a, data));
    const k = await subtle.importKey(
      "raw",
      new TextEncoder().encode(key),
      { name: "HMAC", hash: a },
      false,
      ["sign"],
    );
    return new Uint8Array(await subtle.sign("HMAC", k, data));
  };
  const md5 = async () => {
    const { createMD5, createHMAC } = await import("hash-wasm");
    const h =
      key === null ? await createMD5() : await createHMAC(createMD5(), key);
    h.init();
    h.update(data);
    return h.digest("binary");
  };
  const out = await Promise.all(
    ALGOS.map((a) => (a === "MD5" ? md5() : sha(a))),
  );
  return Object.fromEntries(ALGOS.map((a, i) => [a, out[i]])) as Digests;
}

let worker: Worker | null = null;
let seq = 0;
function getWorker() {
  worker ??= new Worker(new URL("../lib/hash.worker.ts", import.meta.url), {
    type: "module",
  });
  return worker;
}

/** A checksum as typed: trimmed, spaces gone, an "sha256:"-style prefix dropped */
function normalize(c: string) {
  return c
    .trim()
    .replace(/^[a-z0-9-]+:/i, "")
    .replace(/\s+/g, "");
}

export default function HashTool({ preset }: ToolProps) {
  const T = useT();
  const [text, setText] = useInput("hash");
  const [file, setFile] = useState<File | null>(null);
  const [out, setOut] = useState<Out>("hex");
  const [key, setKey] = useState("");
  const [compare, setCompare] = useState("");
  const [digests, setDigests] = useState<Digests | null>(null);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pref = ALGOS.find((a) => a === preset?.algo);
  const hmac = key === "" ? null : key;

  // Text: hash on every change (cancelled if a newer change lands first)
  useEffect(() => {
    if (file) return;
    let live = true;
    setFailed(false);
    hashText(text, hmac).then(
      (d) => live && setDigests(d),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [text, hmac, file]);

  // File: hash in the worker, in chunks, with progress
  useEffect(() => {
    if (!file) return;
    const id = ++seq;
    const w = getWorker();
    setDigests(null);
    setDone(0);
    setFailed(false);
    const onMsg = ({ data }: MessageEvent<HashReply>) => {
      if (data.id !== id) return;
      if (data.type === "progress") setDone(data.done);
      else if (data.type === "done") setDigests(data.digests);
      else setFailed(true);
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ id, file, key: hmac } satisfies HashRequest);
    return () => w.removeEventListener("message", onMsg);
  }, [file, hmac]);

  const want = normalize(compare);
  const rows: Row[] = ALGOS.map((a) => {
    const d = digests?.[a];
    const hex = d ? toHex(d) : "";
    const b64 = d ? toB64(d) : "";
    const match =
      !!want &&
      !!d &&
      (want.toLowerCase() === hex ||
        want.replace(/=+$/, "") === b64.replace(/=+$/, "") ||
        want ===
          b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    return {
      id: a,
      label: hmac === null ? a : `HMAC-${a}`,
      value: d ? (out === "hex" ? hex : b64) : "",
      on: a === pref,
      match,
      note: match ? T("Matches") : undefined,
    };
  });
  const matched = rows.find((r) => r.match);
  const working = !!file && !digests && !failed;
  const pct = file?.size ? Math.round((done / file.size) * 100) : 0;

  function pickFile(f: File | undefined) {
    if (f) setFile(f);
  }
  function onDrop(e: DragEvent) {
    const f = e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault();
    pickFile(f);
  }

  const fileBtn = (
    <>
      <button
        type="button"
        className="btn xs"
        onClick={() => fileRef.current?.click()}
      >
        <Icon name="upload" />
        {T(file ? "Choose another file" : "Hash a file")}
      </button>
      <input
        ref={fileRef}
        type="file"
        hidden
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );

  return (
    <div
      className="dev-drop"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={onDrop}
    >
      <Workspace
        bar={
          <>
            <BarSeg<Out>
              label={T("Output")}
              options={[
                ["hex", T("Hex")],
                ["base64", "Base64"],
              ]}
              value={out}
              onPick={setOut}
            />
            <BarField
              label={T("HMAC key")}
              value={key}
              width={150}
              placeholder={T("Optional")}
              onChange={setKey}
            />
            <BarField
              label={T("Compare with")}
              value={compare}
              width={260}
              placeholder={T("Paste a checksum")}
              onChange={setCompare}
            />
          </>
        }
        status={
          <>
            {file ? (
              <span>
                {file.name} · {formatBytes(file.size)}
              </span>
            ) : (
              <span>{formatBytes(textBytes(text))} · UTF-8</span>
            )}
            {working && <span>{T("Hashing… {n}%", { n: pct })}</span>}
            {failed && (
              <span className="bad">{T("Couldn't hash this. Try again.")}</span>
            )}
            {want &&
              digests &&
              (matched ? (
                <span className="ok">
                  {T("The checksum matches:")} {matched.label}
                </span>
              ) : (
                <span className="bad">
                  {T("No hash matches the checksum.")}
                </span>
              ))}
            {hmac !== null && <span>{T("HMAC with your key")}</span>}
          </>
        }
      >
        {file ? (
          <Pane
            label={T("File")}
            value=""
            actions={
              <>
                {fileBtn}
                <button
                  type="button"
                  className="btn xs"
                  onClick={() => setFile(null)}
                >
                  {T("Back to text")}
                </button>
              </>
            }
          >
            <div className="hash-file">
              <Icon name="file" />
              <strong>{file.name}</strong>
              <span className="muted">{formatBytes(file.size)}</span>
              <div
                className="hash-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={digests ? 100 : pct}
              >
                <i style={{ width: `${digests ? 100 : pct}%` }} />
              </div>
              <span className="muted">
                {digests
                  ? T("Hashed on your device.")
                  : T("Hashing… {n}%", { n: pct })}
              </span>
            </div>
          </Pane>
        ) : (
          <Pane
            label={T("Text")}
            value={text}
            onChange={setText}
            placeholder={T("Type or paste text, or drop a file")}
            actions={fileBtn}
            wrap
          />
        )}
        <Pane
          label={T("Hashes")}
          value={
            digests ? rows.map((r) => `${r.label}  ${r.value}`).join("\n") : ""
          }
          readOnly
        >
          <div className="dev-list">
            <Rows rows={rows} />
            {!file && !text && (
              <p className="dev-note">
                {T(
                  "These are the hashes of empty text. Type something to hash it.",
                )}
              </p>
            )}
            {(pref === "MD5" || pref === "SHA-1") && (
              <p className="dev-note">
                {T(
                  "MD5 and SHA-1 are fine for checksums, but don't use them for passwords or signatures.",
                )}
              </p>
            )}
          </div>
        </Pane>
      </Workspace>
    </div>
  );
}
