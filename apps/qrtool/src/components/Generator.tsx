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
  btcValid,
  DEFAULT_STYLE,
  EPC_MAX,
  ibanValid,
  inputDate,
  KINDS,
  localDate,
  lowContrast,
  PAY_METHODS,
  payload,
  PLATFORMS,
  type PayMethod,
  type Platform,
  upiValid,
  png,
  shape,
  svg,
  type Dots,
  type Eyes,
  type Fields,
  type Kind,
  type Logo,
  type Style,
} from "../lib/qr";

/** QR code generator: pick a type, fill it in, style it, download. */
interface Field {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  area?: boolean;
  /** Checkbox stored as "1" / "" */
  toggle?: boolean;
  /** Number typed as text, so commas and empty values work */
  decimal?: boolean;
  max?: number;
}

const PAY_FIELDS: Record<PayMethod, Field[]> = {
  upi: [
    { key: "upi", label: "UPI ID", placeholder: "name@bank" },
    { key: "payee", label: "Payee name" },
    {
      key: "upi_amount",
      label: "Amount in rupees (optional)",
      decimal: true,
      placeholder: "250.00",
    },
    { key: "upi_note", label: "Note (optional)", max: 80 },
  ],
  epc: [
    { key: "payee", label: "Account holder name", max: 70 },
    { key: "iban", label: "IBAN", placeholder: "DE89 3704 0044 0532 0130 00" },
    { key: "bic", label: "BIC (optional)", max: 11 },
    {
      key: "eur",
      label: "Amount in euros (optional)",
      decimal: true,
      placeholder: "12.50",
    },
    { key: "ref", label: "Reference (optional)", max: 140 },
  ],
  bitcoin: [
    { key: "btc", label: "Bitcoin address", placeholder: "bc1q…" },
    {
      key: "btc_amount",
      label: "Amount in BTC (optional)",
      decimal: true,
      placeholder: "0.001",
    },
    { key: "btc_label", label: "Label (optional)" },
    { key: "btc_message", label: "Message (optional)" },
  ],
  paypal: [
    { key: "paypal", label: "PayPal.me username", placeholder: "yourname" },
    {
      key: "pp_amount",
      label: "Amount (optional)",
      decimal: true,
      placeholder: "10.00",
    },
  ],
};

function fieldsFor(kind: Kind, f: Fields): Field[] {
  if (kind === "pay") return PAY_FIELDS[(f.method as PayMethod) || "upi"];
  if (kind === "event") {
    const type = f.allday === "1" ? "date" : "datetime-local";
    return [
      { key: "title", label: "Event name", placeholder: "Team meeting" },
      { key: "allday", label: "All day", toggle: true },
      { key: "start", label: "Starts", type },
      { key: "end", label: "Ends", type },
      { key: "location", label: "Place (optional)" },
      { key: "notes", label: "Details (optional)", area: true },
    ];
  }
  return FIELDS[kind];
}

/** Tomorrow at 10:00, for a new event */
function tomorrow(): Fields {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return {
    start: inputDate(d),
    end: inputDate(new Date(d.getTime() + 3600_000)),
  };
}

const FIELDS: Record<Exclude<Kind, "event" | "pay">, Field[]> = {
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
  social: [
    {
      key: "handle",
      label: "Username or profile link",
      placeholder: "yourname",
    },
  ],
};

const amountOf = (s: string | undefined) =>
  Number((s ?? "").replace(",", ".").trim());

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
  const [fields, setFields] = useState<Fields>(() => ({
    security: "WPA",
    platform: (preset?.platform as Platform) ?? "instagram",
    method: (preset?.method as PayMethod) ?? "upi",
    ...tomorrow(),
  }));
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
  const method = (fields.method as PayMethod) || "upi";
  const epc = kind === "pay" && method === "epc";
  // A logo needs High; EPC bank transfer codes require at least Medium
  const eff: Style = logo
    ? { ...style, ecc: "H" }
    : epc && style.ecc === "L"
      ? { ...style, ecc: "M" }
      : style;
  const preview = useMemo(() => {
    try {
      return svg(sample, eff, logo, 320);
    } catch {
      return null;
    }
  }, [sample, eff.fg, eff.bg, eff.dots, eff.eyes, eff.margin, eff.ecc, logo]);
  const tooLong = preview === null;
  // Grid size for the proof caption: version 1 is 21 modules, each version adds 4
  const grid = useMemo(() => {
    try {
      return shape(sample, eff).n;
    } catch {
      return 0;
    }
  }, [sample, eff.ecc]);
  const ECC_NAME = {
    L: "Low (7%)",
    M: "Medium (15%)",
    Q: "High (25%)",
    H: "Max (30%)",
  } as const;

  const put = (k: string, v: string) =>
    setFields((f) => {
      if (k !== "start") return { ...f, [k]: v };
      // Moving the start moves the end too, keeping the length (1 hour by default)
      const s0 = localDate(f.start ?? "");
      const e0 = localDate(f.end ?? "");
      const s1 = localDate(v);
      const len = s0 && e0 && e0 > s0 ? e0.getTime() - s0.getTime() : 3600_000;
      return {
        ...f,
        start: v,
        end: s1 ? inputDate(new Date(s1.getTime() + len)) : (f.end ?? ""),
      };
    });
  const putStyle = (p: Partial<Style>) => setStyle((s) => ({ ...s, ...p }));
  const name = `qr-${
    kind === "social"
      ? fields.platform || "social"
      : kind === "pay"
        ? method
        : kind
  }`;

  // Gentle checks: a warning, never a block
  const warns: string[] = [];
  const has = (k: string) => !!fields[k]?.trim();
  if (kind === "social" && has("handle")) {
    const h = fields.handle!.trim();
    if (!/[./]/.test(h) && !/^@?[\w.\-]+$/.test(h))
      warns.push(
        "A username has no spaces. Check it, or paste the profile link.",
      );
  }
  if (
    kind === "pay" &&
    method === "upi" &&
    has("upi") &&
    !upiValid(fields.upi!)
  )
    warns.push("Enter a UPI ID like name@bank.");
  if (epc) {
    if (has("iban") && !ibanValid(fields.iban!))
      warns.push("This IBAN doesn't add up. Check it for typos.");
    if (has("eur")) {
      const a = amountOf(fields.eur);
      if (!(a >= 0.01 && a <= EPC_MAX))
        warns.push("Amounts go from 0.01 to 999,999,999.99 euros.");
    }
  }
  if (kind === "pay" && method === "bitcoin" && has("btc")) {
    if (!btcValid(fields.btc!.replace(/^bitcoin:/i, "")))
      warns.push(
        "This doesn't look like a Bitcoin address. Check it carefully: payments can't be undone.",
      );
  }

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
      <div className="stage qr-stage qr-print">
        <figure className={`qr-proof${text ? "" : " placeholder"}`}>
          <div className="qr-sheet">
            <span className="qr-marks" aria-hidden="true" />
            {preview ? (
              <div
                className="qr-preview"
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            ) : (
              <p className="muted qr-long">
                {T("Too much text for one QR code. Shorten it a little.")}
              </p>
            )}
          </div>
          {grid > 0 && (
            <figcaption className="qr-spec">
              <span>{T(KINDS.find((k) => k.id === kind)!.label)}</span>
              <span>{T("Version {v}", { v: (grid - 17) / 4 })}</span>
              <span>{T("{a} × {b} modules", { a: grid, b: grid })}</span>
              <span>
                {T("Error correction {e}", { e: T(ECC_NAME[eff.ecc]) })}
              </span>
            </figcaption>
          )}
        </figure>
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
        {kind === "social" && (
          <div className="ctl">
            <span className="lbl">{T("Platform")}</span>
            <div className="chips">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={fields.platform === p.id}
                  onClick={() => put("platform", p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {kind === "pay" && (
          <Seg<PayMethod>
            label={T("Payment type")}
            options={PAY_METHODS.map(
              (m) => [m.id, m.label] as [PayMethod, string],
            )}
            value={method}
            onPick={(v) => put("method", v)}
          />
        )}
        {fieldsFor(kind, fields).map((f) =>
          f.toggle ? (
            <Toggle
              key={`${kind}-${f.key}`}
              label={T(f.label)}
              on={fields[f.key] === "1"}
              onChange={(v) => put(f.key, v ? "1" : "")}
            />
          ) : (
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
              ) : f.type === "date" ? (
                // All-day events keep the time part, so switching back restores it
                <input
                  id={`qf-${f.key}`}
                  className="num"
                  type="date"
                  value={(fields[f.key] ?? "").slice(0, 10)}
                  onChange={(e) =>
                    put(
                      f.key,
                      e.target.value &&
                        e.target.value +
                          ((fields[f.key] ?? "").slice(10) || "T10:00"),
                    )
                  }
                />
              ) : (
                <input
                  id={`qf-${f.key}`}
                  className="num"
                  type={f.type ?? "text"}
                  inputMode={f.decimal ? "decimal" : undefined}
                  maxLength={f.max}
                  value={fields[f.key] ?? ""}
                  placeholder={f.placeholder && T(f.placeholder)}
                  onChange={(e) => put(f.key, e.target.value)}
                />
              )}
            </div>
          ),
        )}
        {warns.map((w) => (
          <small key={w} className="warn">
            {T(w)}
          </small>
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
            {!logo && epc && style.ecc === "L" && (
              <small className="muted">
                {T("Bank transfer codes use at least Medium error correction.")}
              </small>
            )}
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
