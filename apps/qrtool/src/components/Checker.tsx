import { useEffect, useRef, useState } from "react";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { CopyBtn, FileInput, useFiles } from "@kmra/ui/components/kit";
import { IMAGE_ACCEPT } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useLp, useT } from "@kmra/ui/lib/i18n-react";
import {
  boxBlur,
  boxOf,
  colours,
  KIND_LABEL,
  parse,
  pixelsOf,
  quietZone,
  readDetailed,
  type Detail,
  type Px,
} from "../lib/scan";

/**
 * QR code checker: reads a design or photo, then re-reads it smaller and blurred, measures the
 * contrast and the blank margin, and lists what to fix. Everything runs on this device.
 */

type Status = "pass" | "warn" | "fail" | "info";
interface Check {
  status: Status;
  title: string;
  detail: string;
  fix?: string;
  rows?: [string, string][];
}

/** Longest side the image is analysed at */
const MAX_SIDE = 4096;
/** Pixels per module tried when shrinking the code */
const SIZES = [4, 3, 2, 1.5, 1];

/** Blank margin a format needs, in modules (0 = no check) */
function quietNeed(format: string): number {
  if (/^(MicroQRCode|RMQRCode)$/.test(format)) return 2;
  if (/QRCode/.test(format)) return 4;
  if (format === "DataMatrix") return 1;
  return 0;
}

const isQr = (format: string) => /QRCode/.test(format);
const fmtName = (format: string) =>
  format.replace(/([a-z])([A-Z])/g, "$1 $2").replace("QRCode", "QR Code");

export default function Checker({ lang }: { lang?: Locale; preset?: Preset }) {
  return (
    <LangProvider lang={lang}>
      <CheckerView />
    </LangProvider>
  );
}

interface Loaded {
  url: string;
  canvas: HTMLCanvasElement;
  pixels: ImageData;
  codes: Detail[];
}

function CheckerView() {
  const T = useT();
  const lp = useLp();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const urlRef = useRef<string | null>(null);

  async function load(files: File[]) {
    const file = files[0]!;
    setBusy(T("Reading…"));
    setChecks(null);
    try {
      const { canvas, pixels } = await pixelsOf(file, MAX_SIDE);
      const codes = await readDetailed(pixels);
      // Show the image as decoded (also covers formats an <img> can't show)
      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/png"),
      );
      const url = blob ? URL.createObjectURL(blob) : "";
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      // QR codes first: this is a QR checker
      codes.sort((a, b) => +isQr(b.format) - +isQr(a.format));
      setSel(0);
      setLoaded({ url, canvas, pixels, codes });
      if (!codes.length) setBusy(null);
    } catch {
      setBusy(null);
      toast(T("That image couldn't be read."));
    }
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

  // Run the checks for the selected code
  useEffect(() => {
    if (!loaded) return;
    const code = loaded.codes[sel];
    if (!code) {
      setChecks([
        {
          status: "fail",
          title: T("No code could be read"),
          detail: T(
            "If there is a code in the image, it may be too blurry, too small, too low in contrast, or missing its blank margin.",
          ),
          fix: T(
            "Try the original design file or a sharper photo, taken straight on and close enough to fill a third of the picture.",
          ),
        },
      ]);
      return;
    }
    let live = true;
    void runChecks(loaded, code, T, (s) => live && setBusy(s)).then((c) => {
      if (!live) return;
      setChecks(c);
      setBusy(null);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, sel]);

  const code = loaded?.codes[sel];
  const kind = code ? parse(code.text).kind : "text";
  const counts = checks
    ? {
        fail: checks.filter((c) => c.status === "fail").length,
        warn: checks.filter((c) => c.status === "warn").length,
      }
    : null;

  return (
    <div className="toolcard qrcard wide-panel checker-card">
      <div className={`stage qr-stage${dragging ? " over" : ""}`}>
        {loaded ? (
          <div className="qc-view" onClick={pick}>
            <img src={loaded.url} alt={T("Checked image")} />
            <svg
              viewBox={`0 0 ${loaded.canvas.width} ${loaded.canvas.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {loaded.codes.map((c, i) => (
                <polygon
                  key={i}
                  className={i === sel ? "on" : ""}
                  points={c.corners.map((p) => `${p.x},${p.y}`).join(" ")}
                  style={{
                    strokeWidth:
                      Math.max(loaded.canvas.width, loaded.canvas.height) / 160,
                  }}
                />
              ))}
            </svg>
          </div>
        ) : (
          <div className="dropzone scan-drop" onClick={pick}>
            <div className="big">
              <Icon name="upload" />
            </div>
            <strong>
              {busy ? T("Reading…") : T("Drop your QR code design or photo")}
            </strong>
            <span className="muted">
              {T("Or paste a screenshot, or click to choose.")}
            </span>
          </div>
        )}
      </div>
      <div className="controls">
        {loaded && (
          <button type="button" className="btn sm" onClick={pick}>
            <Icon name="upload" />
            {T("Check another image")}
          </button>
        )}
        {loaded && loaded.codes.length > 1 && (
          <div className="ctl">
            <span className="lbl">
              {T("{n} codes found. Checking:", { n: loaded.codes.length })}
            </span>
            <div className="chips">
              {loaded.codes.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={i === sel}
                  onClick={() => setSel(i)}
                >
                  {T("Code {n}", { n: i + 1 })}
                </button>
              ))}
            </div>
          </div>
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
        {busy && loaded && (
          <p className="muted small" aria-live="polite">
            {busy}
          </p>
        )}
        {checks && (
          <>
            {counts && code && (
              <p className="qc-sum">
                {counts.fail
                  ? T("Fix the items marked in red before you print.")
                  : counts.warn
                    ? T("It works. A few things could make it more reliable.")
                    : T(
                        "Looks good. It should scan well in print and on screens.",
                      )}
              </p>
            )}
            <ul className="qc-list">
              {checks.map((c) => (
                <li key={c.title} className={`qc-item ${c.status}`}>
                  <span className="qc-mark" aria-hidden="true">
                    <Icon
                      name={
                        c.status === "pass"
                          ? "check"
                          : c.status === "info"
                            ? "info"
                            : c.status === "warn"
                              ? "info"
                              : "x"
                      }
                    />
                  </span>
                  <div>
                    <strong>
                      <span className="sr-only">
                        {c.status === "pass"
                          ? T("Passed:")
                          : c.status === "warn"
                            ? T("Warning:")
                            : c.status === "fail"
                              ? T("Problem:")
                              : ""}{" "}
                      </span>
                      {c.title}
                    </strong>
                    <p>{c.detail}</p>
                    {c.rows && (
                      <dl className="kv">
                        {c.rows.map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {c.fix && c.status !== "pass" && (
                      <p className="qc-fix">
                        <b>{T("Fix:")}</b> {c.fix}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {checks.some((c) => c.status !== "pass" && c.status !== "info") &&
              code &&
              isQr(code.format) && (
                <a className="btn sm" href={lp("/fix-qr")}>
                  <Icon name="magic" />
                  {T("Redraw it sharp with QR code cleaner")}
                </a>
              )}
          </>
        )}
        {!loaded && (
          <div className="result">
            <small>
              {T(
                "Drop a QR code to see if it scans, how small it can be printed, and whether the contrast and margin are right.",
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

/* ---------- The checks ---------- */

type TFn = (text: string, vars?: Record<string, string | number>) => string;

const pause = () => new Promise((r) => setTimeout(r, 0));

/**
 * Draw the code (with a padded margin in its background colour) at `ppm` pixels per module,
 * optionally blur it, and see if it still reads.
 */
async function readsAt(
  src: HTMLCanvasElement,
  code: Detail,
  modulePx: number,
  ppm: number,
  bg: [number, number, number],
  blur = 0,
): Promise<boolean> {
  const box = boxOf(code.corners);
  const pad = modulePx * 4;
  const sx = box.x0 - pad;
  const sy = box.y0 - pad;
  const sw = box.x1 - box.x0 + pad * 2;
  const sh = box.y1 - box.y0 + pad * 2;
  const k = ppm / modulePx;
  const c = document.createElement("canvas");
  c.width = Math.max(8, Math.round(sw * k));
  c.height = Math.max(8, Math.round(sh * k));
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.fillStyle = `rgb(${bg.join(",")})`;
  x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  // Only the part that's inside the image; the rest stays background
  const cx0 = Math.max(0, sx);
  const cy0 = Math.max(0, sy);
  const cx1 = Math.min(src.width, sx + sw);
  const cy1 = Math.min(src.height, sy + sh);
  x.drawImage(
    src,
    cx0,
    cy0,
    cx1 - cx0,
    cy1 - cy0,
    (cx0 - sx) * k,
    (cy0 - sy) * k,
    (cx1 - cx0) * k,
    (cy1 - cy0) * k,
  );
  let px: Px = x.getImageData(0, 0, c.width, c.height);
  if (blur) px = boxBlur(px, blur);
  const img = new ImageData(
    new Uint8ClampedArray(px.data),
    px.width,
    px.height,
  );
  try {
    const r = await readDetailed(img, { formats: [code.format], max: 1 });
    return r.some((f) => f.text === code.text);
  } catch {
    return false;
  }
}

const round1 = (v: number) => Math.round(v * 10) / 10;

async function runChecks(
  l: Loaded,
  code: Detail,
  T: TFn,
  progress: (s: string | null) => void,
): Promise<Check[]> {
  const out: Check[] = [];
  const qr = isQr(code.format);
  const matrix = code.rows > 1 && code.cols > 1;
  const [a, b, c, d] = code.corners;
  const len = (p: { x: number; y: number }, q: { x: number; y: number }) =>
    Math.hypot(q.x - p.x, q.y - p.y);
  // Pixels per module, from the width and height of the code
  const modulePx = matrix
    ? ((len(a, b) + len(d, c)) / 2 / code.cols +
        (len(a, d) + len(b, c)) / 2 / code.rows) /
      2
    : 0;
  const box = boxOf(code.corners);
  const col = colours(l.pixels, box);
  const bg = code.inverted ? col.dark : col.light;

  // 1. Scans
  out.push({
    status: code.mirrored ? "warn" : "pass",
    title: code.mirrored ? T("Scans, but it's mirrored") : T("Scans"),
    detail: code.mirrored
      ? T("The code is flipped like in a mirror. Many phones won't read it.")
      : T("Read at full size as a {f}.").replace("{f}", fmtName(code.format)),
    fix: T("Flip it back before you print or share it."),
  });

  if (!qr)
    out.push({
      status: "info",
      title: T("Not a QR code"),
      detail: T(
        "This checker is made for QR codes, so only some checks apply to this format.",
      ),
    });

  // 2. Smallest size that still reads
  if (matrix && modulePx > 0) {
    progress(T("Testing smaller sizes…"));
    let smallest = 0;
    for (const ppm of SIZES) {
      if (ppm > modulePx * 1.05) continue;
      await pause();
      if (await readsAt(l.canvas, code, modulePx, ppm, bg)) smallest = ppm;
      else break;
    }
    // When the image itself is small, the smallest tested size is what it already has
    if (!smallest && modulePx < SIZES[0]!) smallest = round1(modulePx);
    const need = quietNeed(code.format);
    const total = code.cols + need * 2;
    const factor = !smallest ? 2 : smallest <= 2 ? 1 : 1.5;
    const cm = Math.max(2, Math.ceil(total * 0.05 * factor * 2) / 2);
    const dpiPx = Math.ceil(((cm / 2.54) * 300) / 10) * 10;
    const screenPx =
      Math.ceil((total * Math.max(2, smallest || 4) * 1.5) / 10) * 10;
    const rows: [string, string][] = [
      [
        T("Size in this image"),
        T("{n} px per module", { n: round1(modulePx) }),
      ],
      [
        T("Smallest that reads"),
        smallest
          ? T("{n} px per module", { n: smallest })
          : T("Only at full size"),
      ],
      [T("Print at least"), T("{n} cm wide", { n: cm })],
      [T("File for print at 300 dpi"), T("{n} px wide or more", { n: dpiPx })],
      [T("On screens, show it at least"), T("{n} px wide", { n: screenPx })],
    ];
    out.push(
      !smallest
        ? {
            status: "fail",
            title: T("Breaks when smaller"),
            detail: T(
              "It reads at full size but not when shrunk, so a small print may not scan.",
            ),
            fix: T(
              "Use shorter content, more contrast or a wider margin, or redraw it sharp. Print it large.",
            ),
            rows,
          }
        : smallest > 2
          ? {
              status: "warn",
              title: T("Needs a fairly large print"),
              detail: T(
                "It stops reading below {n} px per module, which is more than a clean code needs.",
                { n: smallest },
              ),
              fix: T(
                "Print it at the size below or larger, or redraw it sharp so it holds up when small.",
              ),
              rows,
            }
          : {
              status: "pass",
              title: T("Holds up when small"),
              detail: T(
                "Still reads at {n} px per module. For scanning from further away, make it about a tenth of the distance: 30 cm wide for 3 m.",
                { n: smallest },
              ),
              rows,
            },
    );
  }

  // 3. Contrast
  const ratio = round1(col.ratio);
  const hex = (v: number[]) =>
    "#" + v.map((n) => n.toString(16).padStart(2, "0")).join("");
  out.push({
    status: col.ratio < 2.5 ? "fail" : col.ratio < 4 ? "warn" : "pass",
    title:
      col.ratio < 2.5
        ? T("Contrast too low")
        : col.ratio < 4
          ? T("Contrast on the low side")
          : T("Good contrast"),
    // Colour codes are filled in after translation so their digits stay as they are
    detail: T(
      "Contrast {r}:1 between {a} and {b}. Aim for 4:1 or more; black on white is 21:1.",
      { r: ratio },
    )
      .replace("{a}", hex(col.dark))
      .replace("{b}", hex(col.light)),
    fix: T(
      "Use a darker code colour or a lighter background. Avoid light greys, yellows and pastels for the code.",
    ),
  });

  // 4. Colours the right way round
  out.push(
    code.inverted
      ? {
          status: "warn",
          title: T("Light code on a dark background"),
          detail: T(
            "Inverted codes look stylish, but some scanners and older phones can't read them.",
          ),
          fix: T("Use a dark code on a light background."),
        }
      : {
          status: "pass",
          title: T("Dark code on a light background"),
          detail: T("The way every scanner expects it."),
        },
  );

  // 5. Quiet zone
  const need = quietNeed(code.format);
  if (need && modulePx > 0) {
    const q = quietZone(
      l.pixels,
      box,
      modulePx,
      col.threshold,
      !code.inverted,
      need + 2,
    );
    const m = Math.floor(q.min * 2) / 2;
    const edge = q.atEdge
      ? " " +
        T(
          "The margin reaches the edge of the image, so keep that space clear when you place it in a design.",
        )
      : "";
    out.push({
      status: m >= need - 0.25 ? "pass" : m >= need / 2 ? "warn" : "fail",
      title:
        m >= need - 0.25
          ? T("Enough blank margin")
          : m >= need / 2
            ? T("Narrow blank margin")
            : T("Almost no blank margin"),
      detail:
        T(
          "About {n} modules of blank space around the code; {need} is the standard.",
          {
            n: m,
            need,
          },
        ) + edge,
      fix: T(
        "Leave at least {need} modules of plain background on every side, with no text, lines or pictures.",
        { need },
      ),
    });
  }

  // 6. Version, density and error correction
  if (qr && code.cols) {
    const v = parseInt(code.version, 10);
    const ecc = code.ecLevel;
    const eccName: Record<string, string> = {
      L: T("Low (7%)"),
      M: T("Medium (15%)"),
      Q: T("High (25%)"),
      H: T("Max (30%)"),
    };
    const rows: [string, string][] = [
      [T("Grid"), T("{a} × {b} modules", { a: code.cols, b: code.rows })],
    ];
    if (v && code.format === "QRCode") rows.unshift([T("Version"), String(v)]);
    if (ecc) rows.push([T("Error correction"), eccName[ecc] ?? ecc]);
    const dense = code.format === "QRCode" && v >= 7;
    out.push({
      status: dense ? "warn" : "pass",
      title: dense ? T("A dense code") : T("Simple enough"),
      detail: dense
        ? T(
            "Version {v} packs many small modules. Each one gets smaller at a given print size, so it's harder to scan.",
            { v },
          )
        : T("Few, large modules: easy for cameras to read."),
      fix: T(
        "Shorten the content: a shorter link, fewer contact fields, or no extra text.",
      ),
      rows,
    });
    if (ecc === "L")
      out.push({
        status: "warn",
        title: T("Low error correction"),
        detail: T(
          "Only 7% of the code can be damaged or covered before it stops reading.",
        ),
        fix: T(
          "Use Medium or higher so a smudge, fold or logo doesn't stop it.",
        ),
      });
  }

  // 7. Blur
  if (matrix && modulePx > 0) {
    progress(T("Testing with blur…"));
    await pause();
    const light = await readsAt(l.canvas, code, modulePx, 8, bg, 2);
    await pause();
    const strong = light && (await readsAt(l.canvas, code, modulePx, 8, bg, 3));
    out.push(
      strong
        ? {
            status: "pass",
            title: T("Copes with blur"),
            detail: T(
              "Still reads when blurred, like a shaky or out-of-focus phone camera.",
            ),
          }
        : light
          ? {
              status: "warn",
              title: T("Copes with a little blur"),
              detail: T("Reads with a little blur, but not with more."),
              fix: T(
                "More contrast, a wider margin or shorter content make it sturdier.",
              ),
            }
          : {
              status: "fail",
              title: T("Fails with slight blur"),
              detail: T(
                "A little camera shake or poor focus is enough to stop it reading.",
              ),
              fix: T(
                "Raise the contrast, widen the margin, shorten the content, or print it larger.",
              ),
            },
    );
  }
  progress(null);
  return out;
}
