import { useCallback, useEffect, useRef, useState } from "react";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { Seg } from "@kmra/ui/components/controls";
import { CopyBtn, FileInput, useFiles } from "@kmra/ui/components/kit";
import { downloadBlob, IMAGE_ACCEPT } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useLang, useT } from "@kmra/ui/lib/i18n-react";
import { linkWarnings, parse, pixelsOf, read, type Found } from "../lib/scan";

/** Scan QR codes and barcodes from the camera or an image. Everything is read on this device. */
type Mode = "camera" | "image";

/** RFC 5545 lines are folded at 75 octets */
function fold(line: string): string {
  const enc = new TextEncoder();
  let out = "";
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out ? 74 : 75)) {
      out += (out ? "\r\n " : "") + cur;
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  return out ? `${out}\r\n ${cur}` : cur;
}

/** A calendar file around a scanned VEVENT, with the fields calendar apps insist on */
function icsFile(vevent: string): Blob {
  const lines = vevent
    .replace(/\r?\n[ \t]/g, "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!/^END:VEVENT/i.test(lines.at(-1) ?? "")) lines.push("END:VEVENT");
  const stamp =
    new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const extra: string[] = [];
  if (!lines.some((l) => /^UID[;:]/i.test(l)))
    extra.push(`UID:${crypto.randomUUID()}@qrtool.kmra.dev`);
  if (!lines.some((l) => /^DTSTAMP[;:]/i.test(l)))
    extra.push(`DTSTAMP:${stamp}`);
  lines.splice(1, 0, ...extra);
  const file = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//kmra.dev//QR Tool//EN",
    ...lines,
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n");
  return new Blob([file + "\r\n"], { type: "text/calendar" });
}

function Result({ f }: { f: Found }) {
  // Scanned values (numbers, subjects) are filled in with .replace(), not T()'s vars, so their
  // digits stay exactly as encoded.
  const T = useT();
  const lang = useLang();
  const p = parse(f.text);
  const loc = lang === "bn" ? "bn-BD" : undefined;
  const when = (d: Date, day: boolean) =>
    day
      ? d.toLocaleDateString(loc, { dateStyle: "full" })
      : d.toLocaleString(loc, { dateStyle: "full", timeStyle: "short" });
  const fmt = f.format
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace("QRCode", "QR Code");
  return (
    <div className="scan-result">
      <div className="scan-head">
        <span className="tag">{fmt}</span>
        <CopyBtn text={f.text} what="Copied" />
      </div>
      {p.kind === "url" ? (
        <>
          <p className="scan-host">{p.url.hostname}</p>
          <p className="scan-text mono">{f.text}</p>
          {linkWarnings(p.url).map((w) => (
            <small key={w} className="warn block">
              {T(w)}
            </small>
          ))}
          <a
            className="btn acc sm"
            href={p.url.toString()}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {T("Open link")}
          </a>
        </>
      ) : p.kind === "wifi" ? (
        <dl className="kv">
          <div>
            <dt>{T("Network")}</dt>
            <dd>{p.ssid || T("(hidden)")}</dd>
          </div>
          <div>
            <dt>{T("Password")}</dt>
            <dd>
              {p.password ? (
                <>
                  <span className="mono">{p.password}</span>{" "}
                  <CopyBtn
                    text={p.password}
                    what="Password copied"
                    className="linkbtn"
                  />
                </>
              ) : (
                T("None")
              )}
            </dd>
          </div>
          <div>
            <dt>{T("Security")}</dt>
            <dd>
              {p.security === "nopass" || !p.security ? T("Open") : p.security}
            </dd>
          </div>
        </dl>
      ) : p.kind === "vcard" ? (
        <>
          <dl className="kv">
            <div>
              <dt>{T("Name")}</dt>
              <dd>{p.name === "Contact" ? T("Contact") : p.name}</dd>
            </div>
            {p.phone && (
              <div>
                <dt>{T("Phone")}</dt>
                <dd>{p.phone}</dd>
              </div>
            )}
            {p.email && (
              <div>
                <dt>{T("Email")}</dt>
                <dd>{p.email}</dd>
              </div>
            )}
            {p.org && (
              <div>
                <dt>{T("Company")}</dt>
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
            {T("Save contact (.vcf)")}
          </button>
        </>
      ) : p.kind === "email" ? (
        <>
          <p className="scan-text">
            {T("Email to")} <b>{p.to}</b>
            {p.subject ? T(", subject “{s}”").replace("{s}", p.subject) : ""}
          </p>
          <a className="btn sm" href={f.text}>
            {T("Write email")}
          </a>
        </>
      ) : p.kind === "phone" ? (
        <a className="btn sm" href={f.text}>
          {T("Call {n}").replace("{n}", p.number)}
        </a>
      ) : p.kind === "sms" ? (
        <p className="scan-text">
          {T("Text {n}").replace("{n}", p.number)}
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
            {T("See on a map")}
          </a>
        </>
      ) : p.kind === "event" ? (
        <>
          <dl className="kv">
            <div>
              <dt>{T("Event")}</dt>
              <dd>{p.title || T("(no name)")}</dd>
            </div>
            {p.start && (
              <div>
                <dt>{T("Starts")}</dt>
                <dd>{when(p.start, p.allDay)}</dd>
              </div>
            )}
            {p.end && (
              <div>
                <dt>{T("Ends")}</dt>
                <dd>{when(p.end, p.allDay)}</dd>
              </div>
            )}
            {p.location && (
              <div>
                <dt>{T("Place")}</dt>
                <dd>{p.location}</dd>
              </div>
            )}
          </dl>
          {p.notes && <p className="scan-text">{p.notes}</p>}
          <button
            type="button"
            className="btn sm"
            onClick={() =>
              downloadBlob(
                icsFile(p.raw),
                `${p.title.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "event"}.ics`,
              )
            }
          >
            <Icon name="download" />
            {T("Add to calendar (.ics)")}
          </button>
        </>
      ) : p.kind === "upi" ? (
        <>
          <dl className="kv">
            <div>
              <dt>{T("Pay to")}</dt>
              <dd>{p.pn || T("(no name)")}</dd>
            </div>
            <div>
              <dt>{T("UPI ID")}</dt>
              <dd>
                <span className="mono">{p.pa}</span>{" "}
                <CopyBtn text={p.pa} what="Copied" className="linkbtn" />
              </dd>
            </div>
            {p.amount && (
              <div>
                <dt>{T("Amount")}</dt>
                <dd>
                  {p.amount} {p.currency || "INR"}
                </dd>
              </div>
            )}
            {p.note && (
              <div>
                <dt>{T("Note")}</dt>
                <dd>{p.note}</dd>
              </div>
            )}
          </dl>
          <small className="warn block">
            {T(
              "Anyone can write any name in a payment code. Check that your UPI app shows the payee you expect before you pay.",
            )}
          </small>
        </>
      ) : p.kind === "epc" ? (
        <>
          <dl className="kv">
            <div>
              <dt>{T("Pay to")}</dt>
              <dd>{p.name || T("(no name)")}</dd>
            </div>
            <div>
              <dt>IBAN</dt>
              <dd>
                <span className="mono">
                  {p.iban.replace(/(.{4})(?=.)/g, "$1 ")}
                </span>{" "}
                <CopyBtn text={p.iban} what="Copied" className="linkbtn" />
              </dd>
            </div>
            {p.bic && (
              <div>
                <dt>BIC</dt>
                <dd className="mono">{p.bic}</dd>
              </div>
            )}
            {p.amount && (
              <div>
                <dt>{T("Amount")}</dt>
                <dd>{p.amount} EUR</dd>
              </div>
            )}
            {p.reference && (
              <div>
                <dt>{T("Reference")}</dt>
                <dd>{p.reference}</dd>
              </div>
            )}
          </dl>
          <small className="muted block">
            {T(
              "A SEPA bank transfer code. Scan it with your banking app to fill in the transfer.",
            )}
          </small>
        </>
      ) : p.kind === "bitcoin" ? (
        <>
          <dl className="kv">
            <div>
              <dt>{T("Address")}</dt>
              <dd>
                <span className="mono">{p.address}</span>{" "}
                <CopyBtn text={p.address} what="Copied" className="linkbtn" />
              </dd>
            </div>
            {p.amount && (
              <div>
                <dt>{T("Amount")}</dt>
                <dd>{p.amount} BTC</dd>
              </div>
            )}
            {(p.label || p.message) && (
              <div>
                <dt>{T("Note")}</dt>
                <dd>{[p.label, p.message].filter(Boolean).join(" · ")}</dd>
              </div>
            )}
          </dl>
          <small className="warn block">
            {T(
              "Check the address in your wallet before sending. Bitcoin payments can't be undone.",
            )}
          </small>
        </>
      ) : (
        <p className="scan-text">{f.text}</p>
      )}
    </div>
  );
}

export default function Scanner({
  preset,
  lang,
}: {
  preset?: Preset;
  lang?: Locale;
}) {
  return (
    <LangProvider lang={lang}>
      <ScannerView preset={preset} />
    </LangProvider>
  );
}

function ScannerView({ preset }: { preset?: Preset }) {
  const T = useT();
  const [mode, setMode] = useState<Mode>((preset?.mode as Mode) ?? "camera");
  const [found, setFound] = useState<Found[]>([]);
  const [busy, setBusy] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  /** Outlines of the codes found in the shown image, and its size in pixels */
  const [marks, setMarks] = useState<{ x: number; y: number }[][]>([]);
  const [dims, setDims] = useState<[number, number] | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /** Back to the empty state: no codes, no image */
  function clearResults() {
    setFound([]);
    setMarks([]);
    setDims(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  function switchMode(m: Mode) {
    if (m === mode) return;
    // Results belong to the mode that found them
    clearResults();
    setMode(m);
  }

  const readImage = useCallback(async (files: File[]) => {
    setMode("image");
    stop();
    setBusy(true);
    const all: Found[] = [];
    const failed: string[] = [];
    let shown: { file: File; codes: Found[]; size: [number, number] } | null =
      null;
    // Each image on its own, so one unreadable file doesn't cancel the others
    for (const f of files) {
      try {
        // Decode in the browser first: the reader alone can't open WebP, AVIF or SVG, and
        // ignores a phone photo's EXIF rotation
        const { canvas, pixels } = await pixelsOf(f);
        const r = await read(pixels);
        if (!shown)
          shown = { file: f, codes: r, size: [canvas.width, canvas.height] };
        all.push(...r);
      } catch {
        failed.push(f.name);
      }
    }
    if (!shown) {
      // Nothing readable: don't leave an earlier image's codes on screen
      clearResults();
    } else {
      const first = shown;
      setMarks(first.codes.flatMap((c) => (c.corners ? [c.corners] : [])));
      // Outlines are in the decoded image's pixels, which keep the shown image's shape
      setDims(first.size);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(first.file);
      });
      setFound(all);
    }
    if (failed.length)
      toast(
        files.length === 1
          ? T("That image couldn't be read.")
          : T("Couldn't read {names}.").replace("{names}", failed.join(", ")),
      );
    else if (!all.length)
      toast(T("No code found. Try a sharper or closer picture."));
    setBusy(false);
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
    clearResults();
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
          ? T(
              "Camera access was blocked. Allow it in your browser's site settings, or use an image instead.",
            )
          : name === "NotFoundError"
            ? T("No camera found. Use an image instead.")
            : T("The camera couldn't start. Use an image instead."),
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
      <div className={`stage qr-stage scan-stage${dragging ? " over" : ""}`}>
        {mode === "camera" ? (
          <div className="cam">
            <video
              ref={videoRef}
              playsInline
              muted
              className={running ? "" : "off"}
            />
            <span
              className={`cam-frame${running ? " live" : ""}`}
              aria-hidden="true"
            >
              {running && <span className="cam-line" />}
            </span>
            {!running && (
              <div className="cam-idle">
                {camError ? (
                  <p className="warn">{camError}</p>
                ) : found.length ? (
                  <p className="muted">{T("Code read. Scan another?")}</p>
                ) : (
                  <p className="muted">
                    {T(
                      "The camera is used only on this device. Nothing is recorded or sent.",
                    )}
                  </p>
                )}
                <button
                  type="button"
                  className="btn acc"
                  onClick={() => void start()}
                >
                  <Icon name="camera" />
                  {found.length ? T("Scan another") : T("Start camera")}
                </button>
              </div>
            )}
          </div>
        ) : preview ? (
          <div className="scan-view" onClick={pick}>
            <img src={preview} alt={T("Scanned image")} />
            {dims && marks.length > 0 && (
              <svg
                viewBox={`0 0 ${dims[0]} ${dims[1]}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {marks.map((c, i) => (
                  <polygon
                    key={i}
                    points={c.map((p) => `${p.x},${p.y}`).join(" ")}
                    style={{ strokeWidth: Math.max(dims[0], dims[1]) / 140 }}
                  />
                ))}
              </svg>
            )}
          </div>
        ) : (
          <div className="dropzone scan-drop" onClick={pick}>
            <div className="big">
              <Icon name="upload" />
            </div>
            <strong>
              {busy ? T("Reading…") : T("Drop an image with a code")}
            </strong>
            <span className="muted">
              {T("Or paste a screenshot, or click to choose.")}
            </span>
          </div>
        )}
      </div>
      <div className="controls">
        <Seg<Mode>
          label={T("Scan from")}
          options={[
            ["camera", T("Camera")],
            ["image", T("Image or screenshot")],
          ]}
          value={mode}
          onPick={switchMode}
        />
        {mode === "image" && (
          <button type="button" className="btn sm" onClick={pick}>
            <Icon name="upload" />
            {T("Choose an image")}
          </button>
        )}
        {running && (
          <button type="button" className="btn sm" onClick={stop}>
            {T("Stop camera")}
          </button>
        )}
        <div className="result scan-results" aria-live="polite">
          {found.length ? (
            <>
              <small>
                {found.length > 1
                  ? T("{n} codes found", { n: found.length })
                  : T("1 code found")}
              </small>
              {found.map((f, i) => (
                <Result key={i} f={f} />
              ))}
            </>
          ) : (
            <small>
              {busy
                ? T("Reading…")
                : T("Results appear here. Links are never opened without you.")}
            </small>
          )}
        </div>
      </div>
      {input}
    </div>
  );
}
