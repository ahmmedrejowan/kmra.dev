/**
 * Reading QR codes and barcodes with zxing-wasm (MIT; zxing-cpp, Apache-2.0). The wasm file is
 * served from this site instead of the library's default CDN.
 */
type Reader = typeof import("zxing-wasm/reader");
let reader: Promise<Reader> | null = null;

function zxing(): Promise<Reader> {
  reader ??= (async () => {
    const z = await import("zxing-wasm/reader");
    const wasm = (await import("zxing-wasm/reader/zxing_reader.wasm?url"))
      .default;
    z.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? wasm : prefix + path,
      },
      fireImmediately: true,
    });
    return z;
  })();
  return reader;
}

export interface Found {
  text: string;
  format: string;
}

/** Every code in an image (file, blob or frame). */
export async function read(input: Blob | ImageData): Promise<Found[]> {
  const z = await zxing();
  const results = await z.readBarcodes(input, {
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: true,
    maxNumberOfSymbols: 8,
  });
  return results
    .filter((r) => r.isValid && r.text)
    .map((r) => ({ text: r.text, format: r.format }));
}

/* ---------- Understanding what was read ---------- */

export type Parsed =
  | { kind: "url"; url: URL }
  | {
      kind: "wifi";
      ssid: string;
      password: string;
      security: string;
      hidden: boolean;
    }
  | {
      kind: "vcard";
      name: string;
      phone?: string;
      email?: string;
      org?: string;
      raw: string;
    }
  | { kind: "email"; to: string; subject?: string; body?: string }
  | { kind: "phone"; number: string }
  | { kind: "sms"; number: string; message?: string }
  | { kind: "geo"; lat: string; lng: string }
  | { kind: "text" };

/** Split "K:V;K:V;" with backslash escapes */
function fieldsOf(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let key = "";
  let cur = "";
  let inKey = true;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "\\" && i + 1 < s.length) {
      cur += s[++i];
    } else if (inKey && c === ":") {
      key = cur;
      cur = "";
      inKey = false;
    } else if (!inKey && c === ";") {
      out[key.toUpperCase()] = cur;
      cur = "";
      inKey = true;
    } else cur += c;
  }
  return out;
}

export function parse(text: string): Parsed {
  const t = text.trim();
  if (/^WIFI:/i.test(t)) {
    const f = fieldsOf(t.slice(5));
    return {
      kind: "wifi",
      ssid: f.S ?? "",
      password: f.P ?? "",
      security: f.T ?? "",
      hidden: /true/i.test(f.H ?? ""),
    };
  }
  if (/^BEGIN:VCARD/i.test(t)) {
    const line = (k: string) =>
      new RegExp(`^${k}[^:\\n]*:(.*)$`, "im").exec(t)?.[1]?.trim();
    return {
      kind: "vcard",
      name:
        line("FN") ??
        line("N")?.split(";").reverse().join(" ").trim() ??
        "Contact",
      phone: line("TEL"),
      email: line("EMAIL"),
      org: line("ORG"),
      raw: t,
    };
  }
  if (/^MECARD:/i.test(t)) {
    const f = fieldsOf(t.slice(7));
    return {
      kind: "vcard",
      name: (f.N ?? "Contact").split(",").reverse().join(" ").trim(),
      phone: f.TEL,
      email: f.EMAIL,
      raw: t,
    };
  }
  const mail = /^mailto:([^?]+)(\?.*)?$/i.exec(t);
  if (mail) {
    const q = new URLSearchParams(mail[2]?.slice(1) ?? "");
    return {
      kind: "email",
      to: decodeURIComponent(mail[1]!),
      subject: q.get("subject") ?? undefined,
      body: q.get("body") ?? undefined,
    };
  }
  const tel = /^tel:(.+)$/i.exec(t);
  if (tel) return { kind: "phone", number: tel[1]! };
  const sms = /^(?:SMSTO|sms):([^:?]+)(?::|\?body=)?(.*)$/i.exec(t);
  if (sms)
    return {
      kind: "sms",
      number: sms[1]!,
      message: decodeURIComponent(sms[2] ?? "") || undefined,
    };
  const geo = /^geo:(-?[\d.]+),(-?[\d.]+)/i.exec(t);
  if (geo) return { kind: "geo", lat: geo[1]!, lng: geo[2]! };
  try {
    const u = new URL(t);
    if (/^https?:$/.test(u.protocol)) return { kind: "url", url: u };
  } catch {}
  return { kind: "text" };
}

/** Link shorteners hide where a link goes */
const SHORTENERS =
  /^(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|rb\.gy|tiny\.cc|qrco\.de|qr\.page|l\.ead\.me)$/i;

export function linkWarnings(u: URL): string[] {
  const w: string[] = [];
  if (u.protocol === "http:")
    w.push("Not secure (http). Don't enter passwords on this site.");
  if (SHORTENERS.test(u.hostname))
    w.push("A short link: it hides the real address.");
  if (/xn--/.test(u.hostname))
    w.push("The address uses look-alike characters.");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname))
    w.push("The address is a bare IP number, not a name.");
  if (u.username || u.password) w.push("The link contains a login.");
  return w;
}
