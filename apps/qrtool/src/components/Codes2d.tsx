import { useEffect, useMemo, useState } from "react";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { Colors, Seg, Toggle } from "@kmra/ui/components/controls";
import { CopyBtn } from "@kmra/ui/components/kit";
import { downloadBlob } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useT } from "@kmra/ui/lib/i18n-react";
import {
  FORMATS_2D,
  formatOf,
  make,
  pngSize,
  toPng,
  toSvg,
  type Format2d,
  type Made,
  type Matrix,
} from "../lib/codes2d";
import { lowContrast } from "../lib/qr";

/** 2D codes: Data Matrix, PDF417, Aztec, Micro QR and rMQR. */
const SIZES = [512, 1024, 2048];

export default function Codes2d({
  preset,
  lang,
}: {
  preset?: Preset;
  lang?: Locale;
}) {
  return (
    <LangProvider lang={lang}>
      <Codes2dView preset={preset} />
    </LangProvider>
  );
}

function Codes2dView({ preset }: { preset?: Preset }) {
  const T = useT();
  const [format, setFormat] = useState<Format2d>(formatOf(preset?.format));
  const f = FORMATS_2D.find((x) => x.id === format)!;
  const [text, setText] = useState("");
  const [fg, setFg] = useState("#111111");
  const [bg, setBg] = useState("#ffffff");
  const [quiet, setQuiet] = useState(true);
  const [px, setPx] = useState(1024);
  const [made, setMade] = useState<Made | null>(null);
  const [failed, setFailed] = useState(false);
  /** Last good code, shown dimmed while the text doesn't fit */
  const [last, setLast] = useState<Matrix | null>(null);

  const value = text || f.sample;
  useEffect(() => {
    let live = true;
    make(value, format, quiet).then(
      (r) => {
        if (!live) return;
        setMade(r);
        setFailed(false);
        if (r.ok) setLast(r.m);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [value, format, quiet]);

  const m = made?.ok ? made.m : null;
  const shown = m ?? last;
  const preview = useMemo(
    () => (shown ? toSvg(shown, fg, bg) : ""),
    [shown, fg, bg],
  );
  const ready = !!text && !!m;
  const name = `${f.label.toLowerCase().replace(/\s+/g, "-")}`;

  let error: string | null = null;
  if (failed)
    error = T("The code maker didn't load. Reload the page and try again.");
  else if (made && !made.ok)
    error =
      made.reason === "long"
        ? T("Too much text for {format}. Shorten it or pick another type.", {
            format: f.label,
          })
        : made.reason === "chars"
          ? T(
              "{format} can't hold some of these characters. Use plain letters and numbers, or pick another type.",
              { format: f.label },
            )
          : T("This text can't be made into a {format} code.", {
              format: f.label,
            });

  async function savePng() {
    if (!text) return toast(T("Type some text first."));
    if (m) downloadBlob(await toPng(m, fg, bg, px), `${name}.png`);
  }
  function saveSvg() {
    if (!text) return toast(T("Type some text first."));
    if (m)
      downloadBlob(
        new Blob([toSvg(m, fg, bg, px)], { type: "image/svg+xml" }),
        `${name}.svg`,
      );
  }

  return (
    <div className="toolcard qrcard">
      <div className="stage qr-stage qr-print">
        <figure
          className={`qr-proof${ready ? "" : " placeholder"}${
            error ? " dim" : ""
          }`}
        >
          <div className="qr-sheet">
            <span className="qr-marks" aria-hidden="true" />
            {preview && (
              <div
                className={`c2d-wrap c2d-${format === "PDF417" || format === "RMQRCode" ? "wide" : "square"}`}
                role="img"
                aria-label={T("{format} code for {value}", {
                  format: f.label,
                  value,
                })}
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            )}
          </div>
          {shown?.cols ? (
            <figcaption className="qr-spec">
              <span>{f.label}</span>
              <span>
                {T("{a} × {b} modules", { a: shown.cols, b: shown.rows ?? 0 })}
              </span>
            </figcaption>
          ) : null}
        </figure>
        {error ? (
          <p className="warn c2d-error">{error}</p>
        ) : (
          <p className="qr-caption">
            {ready ? (
              <>
                <Icon name="check" />{" "}
                {T("Ready. The code updates as you type.")}
              </>
            ) : (
              T("Example code. Type your text to make yours.")
            )}
          </p>
        )}
      </div>
      <div className="controls">
        <div className="ctl">
          <span className="lbl">{T("Type")}</span>
          <div className="chips">
            {FORMATS_2D.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={format === x.id}
                onClick={() => setFormat(x.id)}
              >
                {x.label}
              </button>
            ))}
          </div>
          <small className="muted" style={{ display: "block", marginTop: 8 }}>
            {T(f.hint)}
          </small>
        </div>
        <div className="ctl">
          <label htmlFor="c2d-text">{T("Text or number")}</label>
          <textarea
            id="c2d-text"
            className="num"
            rows={3}
            value={text}
            placeholder={f.sample}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <Colors
          label={T("Colour")}
          value={fg}
          onPick={setFg}
          list={["#111111", "#1a3d9c", "#0b6e4f", "#7a1fa2", "#c2410c"]}
        />
        <Colors
          label={T("Background")}
          value={bg || "#ffffff"}
          onPick={setBg}
          list={["#ffffff", "#fff7ed", "#eef4ff", "#f0fdf4"]}
        />
        <Toggle
          label={T("Transparent background")}
          on={!bg}
          onChange={(v) => setBg(v ? "" : "#ffffff")}
        />
        <Toggle
          label={T("Blank border around the code (quiet zone)")}
          on={quiet}
          onChange={setQuiet}
        />
        {lowContrast(fg, bg) && (
          <small className="warn">
            {T(
              "Low contrast. Use a dark code on a light background, or some phones won't read it.",
            )}
          </small>
        )}
        <div className="result">
          <Seg<number>
            label={T("PNG size")}
            options={SIZES.map(
              (v) => [v, T("{n} px", { n: v })] as [number, string],
            )}
            value={px}
            onPick={setPx}
          />
          {m && (
            <small>
              {T("PNG: {w} × {h} px, sharp edges", {
                w: pngSize(m, px).w,
                h: pngSize(m, px).h,
              })}
            </small>
          )}
          <div className="acts">
            <button
              type="button"
              className="btn acc"
              disabled={!ready}
              onClick={() => void savePng()}
            >
              <Icon name="download" />
              {T("Download PNG")}
            </button>
            <div className="dl-row">
              <button
                type="button"
                className="btn sm"
                disabled={!ready}
                onClick={saveSvg}
              >
                SVG
              </button>
              {ready && m ? (
                <CopyBtn
                  text={toSvg(m, fg, bg, px)}
                  label={T("Copy SVG")}
                  what="SVG copied"
                />
              ) : (
                <button type="button" className="btn sm" disabled>
                  <Icon name="copy" />
                  {T("Copy SVG")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
