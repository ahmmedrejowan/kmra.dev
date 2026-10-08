import { useEffect, useMemo, useRef, useState } from "react";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { Colors, Seg, Toggle } from "@kmra/ui/components/controls";
import { CopyBtn, FileInput, useFiles } from "@kmra/ui/components/kit";
import { downloadBlob, IMAGE_ACCEPT } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useLp, useT } from "@kmra/ui/lib/i18n-react";
import { DEFAULT_STYLE, lowContrast, png, svg, type Style } from "../lib/qr";
import {
  boxOf,
  KIND_LABEL,
  parse,
  pixelsOf,
  readDetailed,
  type Detail,
} from "../lib/scan";

/**
 * QR code cleaner: read a code from a blurry photo or screenshot and draw it again from its
 * content, with clean square modules. Everything runs on this device.
 */

const SIZES = [512, 1024, 2048, 4096];
type Ecc = Style["ecc"];

const isQr = (format: string) => format === "QRCode";
const isMatrix = (format: string) =>
  /QRCode|DataMatrix|Aztec|PDF417|MaxiCode/.test(format);
const fmtName = (format: string) =>
  format.replace(/([a-z])([A-Z])/g, "$1 $2").replace("QRCode", "QR Code");

export default function FixQr({ lang }: { lang?: Locale; preset?: Preset }) {
  return (
    <LangProvider lang={lang}>
      <FixQrView />
    </LangProvider>
  );
}

function FixQrView() {
  const T = useT();
  const lp = useLp();
  const [codes, setCodes] = useState<Detail[] | null>(null);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [style, setStyle] = useState<Style>({ ...DEFAULT_STYLE, margin: 4 });
  const [px, setPx] = useState(2048);
  const urlRef = useRef<string | null>(null);
  /** The decoded original, to show just the code next to the redraw */
  const [srcCanvas, setSrcCanvas] = useState<HTMLCanvasElement | null>(null);

  async function load(files: File[]) {
    const file = files[0]!;
    setBusy(true);
    try {
      const { canvas, pixels } = await pixelsOf(file);
      const found = await readDetailed(pixels);
      setSrcCanvas(canvas);
      // QR codes first: they're the ones redrawn here
      found.sort((a, b) => +isQr(b.format) - +isQr(a.format));
      const url = URL.createObjectURL(file);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setSource(url);
      setCodes(found);
      pick0(found[0]);
      if (!found.length)
        toast(T("No code found. Try a sharper or closer picture."));
    } catch {
      toast(T("That image couldn't be read."));
    } finally {
      setBusy(false);
    }
  }

  // Match the original's error correction, so the new code is as sturdy
  function pick0(c: Detail | undefined, i = 0) {
    setSel(i);
    if (!c) return;
    const ecc = /^[LMQH]$/.test(c.ecLevel) ? (c.ecLevel as Ecc) : "M";
    setStyle((s) => ({ ...s, ecc }));
  }

  const { dragging, pickRef, pick, take } = useFiles({
    onFiles: (f) => void load(f),
  });
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const code = codes?.[sel];
  const qr = code && isQr(code.format);
  const preview = useMemo(() => {
    if (!code || !qr) return null;
    try {
      return svg(code.text, style, null, 320);
    } catch {
      return null;
    }
  }, [code, qr, style]);
  // The original, cropped to the selected code with a little margin
  const crop = useMemo(() => {
    if (!code || !srcCanvas) return source;
    const b = boxOf(code.corners);
    const pad = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.12;
    const x0 = Math.max(0, Math.floor(b.x0 - pad));
    const y0 = Math.max(0, Math.floor(b.y0 - pad));
    const x1 = Math.min(srcCanvas.width, Math.ceil(b.x1 + pad));
    const y1 = Math.min(srcCanvas.height, Math.ceil(b.y1 + pad));
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 8 || h < 8) return source;
    const k = Math.min(1, 640 / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    c.getContext("2d")!.drawImage(
      srcCanvas,
      x0,
      y0,
      w,
      h,
      0,
      0,
      c.width,
      c.height,
    );
    return c.toDataURL("image/png");
  }, [code, srcCanvas, source]);
  const put = (p: Partial<Style>) => setStyle((s) => ({ ...s, ...p }));
  const name = "qr-code-clean";

  async function savePng() {
    if (!code) return;
    downloadBlob(await png(code.text, style, null, px), `${name}.png`);
  }
  function saveSvg() {
    if (!code) return;
    downloadBlob(
      new Blob([svg(code.text, style, null, px)], { type: "image/svg+xml" }),
      `${name}.svg`,
    );
  }

  const kind = code ? parse(code.text).kind : "text";
  const originalEcc = code && /^[LMQH]$/.test(code.ecLevel) ? code.ecLevel : "";
  const eccOptions: [Ecc, string][] = [
    ["L", T("Low")],
    ["M", T("Medium")],
    ["Q", T("High")],
    ["H", T("Max")],
  ];

  return (
    <div className="toolcard qrcard">
      <div className={`stage qr-stage fq-stage${dragging ? " over" : ""}`}>
        {preview ? (
          <>
            <div className="fq-pair">
              {crop && (
                <figure className="fq-old">
                  <div className="fq-tile">
                    <img src={crop} alt={T("Original image")} />
                  </div>
                  <figcaption>{T("Original")}</figcaption>
                </figure>
              )}
              <span className="fq-arrow" aria-hidden="true">
                <Icon name="right" />
              </span>
              <figure className="fq-new">
                <div
                  className={`fq-tile${style.bg ? "" : " clear"}`}
                  dangerouslySetInnerHTML={{ __html: preview }}
                />
                <figcaption>{T("Redrawn")}</figcaption>
              </figure>
            </div>
            <p className="qr-caption">
              <Icon name="check" />{" "}
              {T("Same content, clean edges. Ready to print.")}
            </p>
          </>
        ) : code && !qr ? (
          <div className="fq-other">
            {source && (
              <img src={source} alt={T("Original image")} className="still" />
            )}
          </div>
        ) : (
          <div className="dropzone scan-drop" onClick={pick}>
            {codes && source ? (
              <img src={source} alt={T("Original image")} className="still" />
            ) : (
              <>
                <div className="big">
                  <Icon name="upload" />
                </div>
                <strong>
                  {busy
                    ? T("Reading…")
                    : T("Drop a photo or screenshot of a QR code")}
                </strong>
                <span className="muted">
                  {T("Or paste a screenshot, or click to choose.")}
                </span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="controls">
        {codes && (
          <button type="button" className="btn sm" onClick={pick}>
            <Icon name="upload" />
            {T("Use another image")}
          </button>
        )}
        {codes && codes.length > 1 && (
          <div className="ctl">
            <span className="lbl">
              {T("{n} codes found. Redraw:", { n: codes.length })}
            </span>
            <div className="chips">
              {codes.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={i === sel}
                  onClick={() => pick0(c, i)}
                >
                  {T("Code {n}", { n: i + 1 })}
                </button>
              ))}
            </div>
          </div>
        )}
        {codes && !codes.length && (
          <p className="warn small">
            {T(
              "No code could be read. Try a sharper photo, taken straight on, with the code filling more of the picture.",
            )}
          </p>
        )}
        {code && (
          <div className="scan-result">
            <div className="scan-head">
              <span className="tag">
                {fmtName(code.format)} · {T(KIND_LABEL[kind] ?? "Text")}
              </span>
              <CopyBtn text={code.text} what="Copied" />
            </div>
            <p className="scan-text qc-content">{code.text}</p>
          </div>
        )}
        {code && !qr && (
          <div className="note">
            <Icon name="info" />
            <div>
              <p className="small fq-note">
                {T(
                  "This is a {f}, not a QR code. Its content was read; copy it, or make a fresh one from it.",
                ).replace("{f}", fmtName(code.format))}
              </p>
              <a
                className="btn sm"
                href={lp(isMatrix(code.format) ? "/codes-2d" : "/barcode")}
              >
                {isMatrix(code.format)
                  ? T("Open the 2D code generator")
                  : T("Open the barcode generator")}
              </a>
            </div>
          </div>
        )}
        {qr && (
          <>
            <Colors
              label={T("Colour")}
              value={style.fg}
              onPick={(v) => put({ fg: v })}
              list={["#111111", "#1a3d9c", "#0b6e4f", "#7a1fa2", "#c2410c"]}
            />
            {style.bg && (
              <Colors
                label={T("Background")}
                value={style.bg}
                onPick={(v) => put({ bg: v })}
                list={["#ffffff", "#fff7ed", "#eef4ff", "#f0fdf4"]}
              />
            )}
            <Toggle
              label={T("Transparent background")}
              on={!style.bg}
              onChange={(v) => put({ bg: v ? "" : "#ffffff" })}
            />
            <Seg<number>
              label={T("Quiet zone")}
              options={[
                [2, T("Tight")],
                [4, T("Normal")],
                [6, T("Wide")],
              ]}
              value={style.margin}
              onPick={(v) => put({ margin: v })}
            />
            <Seg<Ecc>
              label={T("Error correction")}
              options={eccOptions}
              value={style.ecc}
              onPick={(v) => put({ ecc: v })}
            />
            {originalEcc && (
              <small className="muted">
                {style.ecc === originalEcc
                  ? T("Same as the original.")
                  : T("The original used {e}.").replace(
                      "{e}",
                      eccOptions.find(([k]) => k === originalEcc)?.[1] ?? "",
                    )}
              </small>
            )}
            {lowContrast(style.fg, style.bg) && (
              <small className="warn">
                {T(
                  "Low contrast. Use a dark code on a light background, or some phones won't read it.",
                )}
              </small>
            )}
            <div className="note">
              <Icon name="info" />
              <span>
                {T(
                  "The code is redrawn from its content as plain squares. Colours, rounded dots and logos of the original design aren't kept.",
                )}
              </span>
            </div>
            <div className="result">
              <Seg<number>
                label={T("PNG size")}
                options={SIZES.map(
                  (v) => [v, T("{n} px", { n: v })] as [number, string],
                )}
                value={px}
                onPick={setPx}
              />
              <div className="acts">
                <button
                  type="button"
                  className="btn acc"
                  disabled={!preview}
                  onClick={() => void savePng()}
                >
                  <Icon name="download" />
                  {T("Download PNG")}
                </button>
                <div className="dl-row">
                  <button
                    type="button"
                    className="btn sm"
                    disabled={!preview}
                    onClick={saveSvg}
                  >
                    SVG
                  </button>
                  <CopyBtn
                    text={code.text}
                    label={T("Copy text")}
                    what="Code text copied"
                  />
                </div>
              </div>
            </div>
          </>
        )}
        {!codes && (
          <div className="result">
            <small>
              {T(
                "Drop a blurry or low-resolution QR code to get a sharp copy you can print at any size.",
              )}
            </small>
          </div>
        )}
      </div>
      <FileInput
        inputRef={pickRef}
        onFiles={take}
        accept={IMAGE_ACCEPT}
        multiple={false}
      />
    </div>
  );
}
