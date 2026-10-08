import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { Seg, Toggle } from "@kmra/ui/components/controls";
import { downloadBlob } from "@kmra/ui/lib/files";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useT } from "@kmra/ui/lib/i18n-react";

/** Barcodes (JsBarcode, MIT). Check digits for EAN/UPC are added automatically. */
const FORMATS: {
  id: string;
  label: string;
  hint: string;
  sample: string;
  test: RegExp;
}[] = [
  {
    id: "CODE128",
    label: "Code 128",
    hint: "Letters and numbers. Labels, shipping, inventory.",
    sample: "KMRA-2026-001",
    test: /^[\x00-\x7f]+$/,
  },
  {
    id: "EAN13",
    label: "EAN-13",
    hint: "Retail products. 12 digits; the 13th is added.",
    sample: "590123412345",
    test: /^\d{12,13}$/,
  },
  {
    id: "UPC",
    label: "UPC-A",
    hint: "Retail in the US and Canada. 11 digits; the 12th is added.",
    sample: "01234567890",
    test: /^\d{11,12}$/,
  },
  {
    id: "EAN8",
    label: "EAN-8",
    hint: "Small products. 7 digits; the 8th is added.",
    sample: "9638507",
    test: /^\d{7,8}$/,
  },
  {
    id: "CODE39",
    label: "Code 39",
    hint: "Capital letters, digits and - . $ / + %. Older systems, ID badges.",
    sample: "KMRA 39",
    test: /^[0-9A-Z\-. $/+%]+$/,
  },
  {
    id: "ITF14",
    label: "ITF-14",
    hint: "Cartons and cases. 13 digits; the 14th is added.",
    sample: "1540014128876",
    test: /^\d{13,14}$/,
  },
  {
    id: "codabar",
    label: "Codabar",
    hint: "Libraries and blood banks.",
    sample: "A40156B",
    test: /^[A-D]?[0-9\-$:/.+]+[A-D]?$/i,
  },
];

export default function Barcode({
  preset,
  lang,
}: {
  preset?: Preset;
  lang?: Locale;
}) {
  return (
    <LangProvider lang={lang}>
      <BarcodeView preset={preset} />
    </LangProvider>
  );
}

function BarcodeView({ preset }: { preset?: Preset }) {
  const T = useT();
  const [format, setFormat] = useState((preset?.format as string) ?? "CODE128");
  const f = FORMATS.find((x) => x.id === format)!;
  const [value, setValue] = useState(f.sample);
  const [showText, setShowText] = useState(true);
  const [height, setHeight] = useState(100);
  const [color, setColor] = useState("#000000");
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Number-only formats accept spaces and dashes as typed (e.g. ISBN 978-1-4028-9462-6)
  const code = /^(EAN13|EAN8|UPC|ITF14)$/.test(format)
    ? value.replace(/[\s-]/g, "")
    : value;

  const opts = (scale = 1) => ({
    format,
    displayValue: showText,
    height: height * scale,
    width: 2 * scale,
    margin: 10 * scale,
    fontSize: 18 * scale,
    lineColor: color,
    background: "#ffffff",
  });

  useEffect(() => {
    if (!svgRef.current) return;
    const misfit = `${T("That doesn't fit this barcode type.")} ${T(f.hint)}`;
    if (!f.test.test(code)) {
      setError(misfit);
      return;
    }
    try {
      let ok = true;
      JsBarcode(svgRef.current, code, {
        ...opts(),
        valid: (v: boolean) => (ok = v),
      });
      setError(ok ? null : misfit);
    } catch {
      setError(misfit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, value, showText, height, color]);

  function savePng() {
    const c = document.createElement("canvas");
    JsBarcode(c, code, opts(3));
    c.toBlob(
      (b) => b && downloadBlob(b, `barcode-${format.toLowerCase()}.png`),
      "image/png",
    );
  }
  function saveSvg() {
    const s = new XMLSerializer().serializeToString(svgRef.current!);
    downloadBlob(
      new Blob([s], { type: "image/svg+xml" }),
      `barcode-${format.toLowerCase()}.svg`,
    );
  }

  return (
    <div className="toolcard qrcard">
      <div className="stage qr-stage">
        <div className="barcode-wrap">
          <svg
            ref={svgRef}
            className={error ? "dim" : ""}
            role="img"
            aria-label={T("{format} barcode for {value}")
              .replace("{format}", f.label)
              .replace("{value}", code)}
          />
        </div>
        {error && <p className="warn">{error}</p>}
      </div>
      <div className="controls">
        <div className="ctl">
          <span className="lbl">{T("Type")}</span>
          <div className="chips">
            {FORMATS.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={format === x.id}
                onClick={() => {
                  setFormat(x.id);
                  if (!x.test.test(value)) setValue(x.sample);
                }}
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
          <label htmlFor="bc-val">{T("Number or text")}</label>
          <input
            id="bc-val"
            className="num mono"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Seg<number>
          label={T("Height")}
          options={[
            [60, T("Short")],
            [100, T("Normal")],
            [150, T("Tall")],
          ]}
          value={height}
          onPick={setHeight}
        />
        <Seg<string>
          label={T("Colour")}
          options={[
            ["#000000", T("Black")],
            ["#1a3d9c", T("Navy")],
          ]}
          value={color}
          onPick={setColor}
        />
        <Toggle
          label={T("Show the number under the bars")}
          on={showText}
          onChange={setShowText}
        />
        <div className="result">
          <div className="acts">
            <button
              type="button"
              className="btn acc"
              disabled={!!error}
              onClick={savePng}
            >
              <Icon name="download" />
              {T("Download PNG")}
            </button>
            <button
              type="button"
              className="btn sm"
              disabled={!!error}
              onClick={saveSvg}
            >
              {T("Download SVG")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
