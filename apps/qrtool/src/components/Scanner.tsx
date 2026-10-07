import { useCallback, useEffect, useRef, useState } from "react";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { Seg } from "@kmra/ui/components/controls";
import { CopyBtn, FileInput, useFiles } from "@kmra/ui/components/kit";
import { downloadBlob, IMAGE_ACCEPT } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import { linkWarnings, parse, read, type Found } from "../lib/scan";

/** Scan QR codes and barcodes from the camera or an image. Everything is read on this device. */
type Mode = "camera" | "image";

function Result({ f }: { f: Found }) {
  const p = parse(f.text);
  const fmt = f.format.replace(/([a-z])([A-Z])/g, "$1 $2");
  return (
    <div className="scan-result">
      <div className="scan-head">
        <span className="tag">{fmt}</span>
        <CopyBtn text={f.text} label="Copy" what="Copied" />
      </div>
      {p.kind === "url" ? (
        <>
          <p className="scan-host">{p.url.hostname}</p>
          <p className="scan-text mono">{f.text}</p>
          {linkWarnings(p.url).map((w) => (
            <small key={w} className="warn block">
              {w}
            </small>
          ))}
          <a
            className="btn acc sm"
            href={p.url.toString()}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            Open link
          </a>
        </>
      ) : p.kind === "wifi" ? (
        <dl className="kv">
          <div>
            <dt>Network</dt>
            <dd>{p.ssid || "(hidden)"}</dd>
          </div>
          <div>
            <dt>Password</dt>
            <dd>
              {p.password ? (
                <>
                  <span className="mono">{p.password}</span>{" "}
                  <CopyBtn
                    text={p.password}
                    label="Copy"
                    what="Password copied"
                    className="linkbtn"
                  />
                </>
              ) : (
                "None"
              )}
            </dd>
          </div>
          <div>
            <dt>Security</dt>
            <dd>
              {p.security === "nopass" || !p.security ? "Open" : p.security}
            </dd>
          </div>
        </dl>
      ) : p.kind === "vcard" ? (
        <>
          <dl className="kv">
            <div>
              <dt>Name</dt>
              <dd>{p.name}</dd>
            </div>
            {p.phone && (
              <div>
                <dt>Phone</dt>
                <dd>{p.phone}</dd>
              </div>
            )}
            {p.email && (
              <div>
                <dt>Email</dt>
                <dd>{p.email}</dd>
              </div>
            )}
            {p.org && (
              <div>
                <dt>Company</dt>
                <dd>{p.org}</dd>
              </div>
            )}
          </dl>
          <button
            type="button"
            className="btn sm"
            onClick={() =>
              downloadBlob(
                new Blob([p.raw], { type: "text/vcard" }),
                `${p.name.replace(/\W+/g, "-") || "contact"}.vcf`,
              )
            }
          >
            <Icon name="download" />
            Save contact (.vcf)
          </button>
        </>
      ) : p.kind === "email" ? (
        <>
          <p className="scan-text">
            Email to <b>{p.to}</b>
            {p.subject ? `, subject “${p.subject}”` : ""}
          </p>
          <a className="btn sm" href={f.text}>
            Write email
          </a>
        </>
      ) : p.kind === "phone" ? (
        <a className="btn sm" href={f.text}>
          Call {p.number}
        </a>
      ) : p.kind === "sms" ? (
        <p className="scan-text">
          Text {p.number}
          {p.message ? `: “${p.message}”` : ""}
        </p>
      ) : p.kind === "geo" ? (
        <>
          <p className="scan-text mono">
            {p.lat}, {p.lng}
          </p>
          <a
            className="btn sm"
            href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=16/${p.lat}/${p.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            See on a map
          </a>
        </>
      ) : (
        <p className="scan-text">{f.text}</p>
      )}
    </div>
  );
}

export default function Scanner({ preset }: { preset?: Preset }) {
  const [mode, setMode] = useState<Mode>((preset?.mode as Mode) ?? "camera");
  const [found, setFound] = useState<Found[]>([]);
  const [busy, setBusy] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const readImage = useCallback(async (files: File[]) => {
    setMode("image");
    stop();
    setBusy(true);
    try {
      const all: Found[] = [];
      for (const f of files) all.push(...(await read(f)));
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(files[0]!);
      });
      setFound(all);
      if (!all.length) toast("No code found. Try a sharper or closer picture.");
    } catch {
      toast("That image couldn't be read.");
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { dragging, pickRef, pick, take } = useFiles({
    onFiles: (f) => void readImage(f),
  });

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRunning(false);
  }

  async function start() {
    setCamError(null);
    setFound([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setRunning(true);
    } catch (err) {
      const name = (err as { name?: string }).name;
      setCamError(
        name === "NotAllowedError"
          ? "Camera access was blocked. Allow it in your browser's site settings, or use an image instead."
          : name === "NotFoundError"
            ? "No camera found. Use an image instead."
            : "The camera couldn't start. Use an image instead.",
      );
    }
  }

  // Read frames while the camera runs: a few times a second, stop at the first code
  useEffect(() => {
    if (!running) return;
    let live = true;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const tick = async () => {
      const v = videoRef.current;
      if (!live || !v || v.readyState < 2) return void setTimeout(tick, 200);
      const scale = Math.min(1, 960 / Math.max(v.videoWidth, v.videoHeight));
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      try {
        const res = await read(
          ctx.getImageData(0, 0, canvas.width, canvas.height),
        );
        if (res.length && live) {
          setFound(res);
          navigator.vibrate?.(60);
          stop();
          return;
        }
      } catch {}
      if (live) setTimeout(tick, 250);
    };
    void tick();
    return () => {
      live = false;
    };
  }, [running]);

  useEffect(() => () => stop(), []);
  useEffect(() => {
    if (mode !== "camera") stop();
  }, [mode]);

  const input = (
    <FileInput inputRef={pickRef} onFiles={take} accept={IMAGE_ACCEPT} />
  );
  return (
    <div className="toolcard qrcard">
      <div className={`stage qr-stage${dragging ? " over" : ""}`}>
        {mode === "camera" ? (
          <div className="cam">
            <video
              ref={videoRef}
              playsInline
              muted
              className={running ? "" : "off"}
            />
            {running && <span className="cam-frame" aria-hidden="true" />}
            {!running && (
              <div className="cam-idle">
                {camError ? (
                  <p className="warn">{camError}</p>
                ) : found.length ? (
                  <p className="muted">Code read. Scan another?</p>
                ) : (
                  <p className="muted">
                    The camera is used only on this device. Nothing is recorded
                    or sent.
                  </p>
                )}
                <button
                  type="button"
                  className="btn acc"
                  onClick={() => void start()}
                >
                  <Icon name="camera" />
                  {found.length ? "Scan another" : "Start camera"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="dropzone scan-drop" onClick={pick}>
            {preview ? (
              <img src={preview} alt="Scanned image" className="still" />
            ) : (
              <>
                <div className="big">
                  <Icon name="upload" />
                </div>
                <strong>
                  {busy ? "Reading…" : "Drop an image with a code"}
                </strong>
                <span className="muted">
                  Or paste a screenshot, or click to choose.
                </span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="controls">
        <Seg<Mode>
          label="Scan from"
          options={[
            ["camera", "Camera"],
            ["image", "Image or screenshot"],
          ]}
          value={mode}
          onPick={setMode}
        />
        {mode === "image" && (
          <button type="button" className="btn sm" onClick={pick}>
            <Icon name="upload" />
            Choose an image
          </button>
        )}
        {running && (
          <button type="button" className="btn sm" onClick={stop}>
            Stop camera
          </button>
        )}
        <div className="result scan-results" aria-live="polite">
          {found.length ? (
            <>
              <small>
                {found.length} code{found.length > 1 ? "s" : ""} found
              </small>
              {found.map((f, i) => (
                <Result key={i} f={f} />
              ))}
            </>
          ) : (
            <small>
              {busy
                ? "Reading…"
                : "Results appear here. Links are never opened without you."}
            </small>
          )}
        </div>
      </div>
      {input}
    </div>
  );
}
