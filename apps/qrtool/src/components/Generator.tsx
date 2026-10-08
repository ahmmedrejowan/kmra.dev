import { useEffect, useMemo, useRef, useState } from "react";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { Colors, Seg, Toggle } from "@kmra/ui/components/controls";
import { CopyBtn } from "@kmra/ui/components/kit";
import { downloadBlob } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useT } from "@kmra/ui/lib/i18n-react";
import {
  DEFAULT_STYLE,
  KINDS,
  lowContrast,
  payload,
  png,
  svg,
  type Dots,
  type Eyes,
  type Fields,
  type Kind,
  type Logo,
  type Style,
} from "../lib/qr";

/** QR code generator: pick a type, fill it in, style it, download. */
const FIELDS: Record<
  Kind,
  {
    key: string;
    label: string;
    type?: string;
    placeholder?: string;
    area?: boolean;
  }[]
> = {
  url: [
    {
      key: "url",
      label: "Link",
      type: "url",
      placeholder: "https://example.com",
    },
  ],
  text: [{ key: "text", label: "Text", area: true, placeholder: "Any text" }],
  wifi: [
    { key: "ssid", label: "Network name (SSID)", placeholder: "Home Wi-Fi" },
    { key: "password", label: "Password", placeholder: "Wi-Fi password" },
  ],
  vcard: [
    { key: "first", label: "First name" },
    { key: "last", label: "Last name" },
    { key: "phone", label: "Phone", type: "tel" },
    { key: "email", label: "Email", type: "email" },
    { key: "org", label: "Company" },
    { key: "title", label: "Job title" },
    { key: "website", label: "Website", type: "url" },
    { key: "address", label: "Address" },
  ],
  email: [
    { key: "email", label: "Email address", type: "email" },
    { key: "subject", label: "Subject" },
    { key: "body", label: "Message", area: true },
  ],
  phone: [
    {
      key: "phone",
      label: "Phone number",
      type: "tel",
      placeholder: "+8801712345678",
    },
  ],
  sms: [
    {
      key: "phone",
      label: "Phone number",
      type: "tel",
      placeholder: "+8801712345678",
    },
    { key: "message", label: "Message", area: true },
  ],
  whatsapp: [
    {
      key: "phone",
      label: "WhatsApp number with country code",
      type: "tel",
      placeholder: "8801712345678",
    },
    { key: "message", label: "Message (optional)", area: true },
  ],
  geo: [
    { key: "coords", label: "Coordinates", placeholder: "23.8103, 90.4125" },
  ],
};

const SIZES = [512, 1024, 2048];
const MODE_KEY = "kmra-mode";

export default function Generator({
  preset,
  lang,
}: {
  preset?: Preset;
  lang?: Locale;
}) {
  return (
    <LangProvider lang={lang}>
      <GeneratorView preset={preset} />
    </LangProvider>
  );
}

function GeneratorView({ preset }: { preset?: Preset }) {
  const T = useT();
  const [kind, setKind] = useState<Kind>((preset?.type as Kind) ?? "url");
  const [fields, setFields] = useState<Fields>({ security: "WPA" });
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [logo, setLogo] = useState<Logo | null>(null);
  const [px, setPx] = useState(1024);
  const [advanced, setAdvanced] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  // Simple/Advanced switch in the page header
  useEffect(() => {
    try {
      if (localStorage.getItem(MODE_KEY) === "advanced") setAdvanced(true);
    } catch {}
    const on = () => setMode(true);
    const off = () => setMode(false);
    window.addEventListener("kmra:advanced", on);
    window.addEventListener("kmra:simple", off);
    return () => {
      window.removeEventListener("kmra:advanced", on);
      window.removeEventListener("kmra:simple", off);
    };
  }, []);
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("kmra:mode", { detail: { advanced } }),
    );
  }, [advanced]);
  function setMode(a: boolean) {
    setAdvanced(a);
    try {
      localStorage.setItem(MODE_KEY, a ? "advanced" : "simple");
    } catch {}
  }

  const text = payload(kind, fields);
  const sample = text || (kind === "url" ? "https://kmra.dev" : "kmra.dev");
  const eff: Style = logo ? { ...style, ecc: "H" } : style;
  const preview = useMemo(() => {
    try {
      return svg(sample, eff, logo, 320);
    } catch {
      return null;
    }
  }, [sample, eff.fg, eff.bg, eff.dots, eff.eyes, eff.margin, eff.ecc, logo]);
  const tooLong = preview === null;

  const put = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));
  const putStyle = (p: Partial<Style>) => setStyle((s) => ({ ...s, ...p }));
  const name = `qr-${kind}`;

  async function savePng() {
    if (!text) return toast(T("Fill in the details first."));
    downloadBlob(await png(text, eff, logo, px), `${name}.png`);
  }
  function saveSvg() {
    if (!text) return toast(T("Fill in the details first."));
    downloadBlob(
      new Blob([svg(text, eff, logo, px)], { type: "image/svg+xml" }),
      `${name}.svg`,
    );
  }

  return (
    <div className="toolcard qrcard">
      <div className="stage qr-stage">
        <div className={`qr-preview${text ? "" : " placeholder"}`}>
          {preview ? (
            <div dangerouslySetInnerHTML={{ __html: preview }} />
          ) : (
            <p className="muted">
              {T("Too much text for one QR code. Shorten it a little.")}
            </p>
          )}
        </div>
        <p className="qr-caption">
          {text ? (
            <>
              <Icon name="check" />{" "}
              {T("Ready to scan. It never expires and has no tracking.")}
            </>
          ) : (
            T("Example code. Fill in the details to make yours.")
          )}
        </p>
      </div>
      <div className="controls">
        <div className="ctl">
          <span className="lbl">{T("QR code for")}</span>
          <div className="chips">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)}
              >
                {T(k.label)}
              </button>
            ))}
          </div>
        </div>
        {FIELDS[kind].map((f) => (
          <div className="ctl" key={`${kind}-${f.key}`}>
            <label htmlFor={`qf-${f.key}`}>{T(f.label)}</label>
            {f.area ? (
              <textarea
                id={`qf-${f.key}`}
                className="num"
                rows={3}
                value={fields[f.key] ?? ""}
                placeholder={f.placeholder && T(f.placeholder)}
                onChange={(e) => put(f.key, e.target.value)}
              />
            ) : (
              <input
                id={`qf-${f.key}`}
                className="num"
                type={f.type ?? "text"}
                value={fields[f.key] ?? ""}
                placeholder={f.placeholder && T(f.placeholder)}
                onChange={(e) => put(f.key, e.target.value)}
              />
            )}
          </div>
        ))}
        {kind === "wifi" && (
          <>
            <Seg<string>
              label={T("Security")}
              options={[
                ["WPA", "WPA/WPA2/WPA3"],
                ["WEP", "WEP"],
                ["none", T("None")],
              ]}
              value={fields.security ?? "WPA"}
              onPick={(v) => put("security", v)}
            />
            <Toggle
              label={T("Hidden network")}
              on={fields.hidden === "1"}
              onChange={(v) => put("hidden", v ? "1" : "")}
            />
          </>
        )}

        <Colors
          label={T("Colour")}
          value={style.fg}
          onPick={(v) => putStyle({ fg: v })}
          list={[
            "#111111",
            "#1a3d9c",
            "#0b6e4f",
            "#7a1fa2",
            "#c2410c",
            "#e5484d",
          ]}
        />
        {advanced && (
          <>
            <Colors
              label={T("Background")}
              value={style.bg || "#ffffff"}
              onPick={(v) => putStyle({ bg: v })}
              list={["#ffffff", "#fff7ed", "#eef4ff", "#f0fdf4"]}
            />
            <Toggle
              label={T("Transparent background")}
              on={!style.bg}
              onChange={(v) => putStyle({ bg: v ? "" : "#ffffff" })}
            />
            <Seg<Dots>
              label={T("Dots")}
              options={[
                ["square", T("Square")],
                ["rounded", T("Rounded")],
                ["dots", T("Dots")],
                ["fluid", T("Fluid")],
              ]}
              value={style.dots}
              onPick={(v) => putStyle({ dots: v })}
            />
            <Seg<Eyes>
              label={T("Corners")}
              options={[
                ["square", T("Square")],
                ["rounded", T("Rounded")],
                ["circle", T("Circle")],
              ]}
              value={style.eyes}
              onPick={(v) => putStyle({ eyes: v })}
            />
            <div className="ctl">
              <span className="lbl">{T("Logo in the middle")}</span>
              {logo ? (
                <div className="filepill">
                  <span>{T("Logo added")}</span>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => setLogo(null)}
                  >
                    {T("Remove")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => logoRef.current?.click()}
                >
                  <Icon name="upload" />
                  {T("Add a logo")}
                </button>
              )}
              <input
                ref={logoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = async () => {
                    const url = r.result as string;
                    const img = new Image();
                    img.src = url;
                    await img.decode();
                    setLogo({
                      url,
                      w: img.naturalWidth || 1,
                      h: img.naturalHeight || 1,
                    });
                  };
                  r.readAsDataURL(f);
                }}
              />
              {logo && (
                <small className="muted">
                  {T(
                    "Error correction is set to High so the code still scans.",
                  )}
                </small>
              )}
            </div>
            {!logo && (
              <Seg<Style["ecc"]>
                label={T("Error correction")}
                options={[
                  ["L", T("Low")],
                  ["M", T("Medium")],
                  ["Q", T("High")],
                  ["H", T("Max")],
                ]}
                value={style.ecc}
                onPick={(v) => putStyle({ ecc: v })}
              />
            )}
            <Seg<number>
              label={T("Quiet zone")}
              options={[
                [1, T("Tight")],
                [3, T("Normal")],
                [5, T("Wide")],
              ]}
              value={style.margin}
              onPick={(v) => putStyle({ margin: v })}
            />
          </>
        )}
        {lowContrast(eff.fg, eff.bg) && (
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
          <div className="acts">
            <button
              type="button"
              className="btn acc"
              disabled={!text || tooLong}
              onClick={() => void savePng()}
            >
              <Icon name="download" />
              {T("Download PNG")}
            </button>
            <div className="dl-row">
              <button
                type="button"
                className="btn sm"
                disabled={!text || tooLong}
                onClick={saveSvg}
              >
                SVG
              </button>
              <CopyBtn
                text={text}
                label={T("Copy text")}
                what="Code text copied"
              />
            </div>
            <button
              type="button"
              className="advlink"
              onClick={() => setMode(!advanced)}
            >
              <Icon name="sliders" />
              {advanced
                ? T("Fewer options")
                : T("Style, logo and more in Advanced")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
